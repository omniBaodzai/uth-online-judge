require "rubygems/version"
require "open3"
require "json"

class IsolateSandboxIdAllocator
  MIN_ID = 0
  MAX_ID = 999
  DEFAULT_LOCK_DIR = "/tmp/judge0-isolate-box-locks"

  class Lease
    attr_reader :id

    def initialize(id, file, lock_dir)
      @id = id
      @file = file
      @quarantine_path = File.join(lock_dir, "box-#{id}.quarantine")
    end

    def quarantine!(workdir: nil)
      flags = File::RDWR | File::CREAT
      flags |= File::NOFOLLOW if File.const_defined?(:NOFOLLOW)
      marker = File.open(@quarantine_path, flags, 0o600)
      stat = marker.stat
      unless stat.file? && stat.uid == Process.uid && (stat.mode & 0o077).zero?
        raise "Unsafe sandbox quarantine marker: #{@quarantine_path}"
      end

      marker.rewind
      contents = marker.read
      state = if contents.empty?
        { "id" => @id }
      else
        JSON.parse(contents)
      end
      unless state.is_a?(Hash) && state["id"] == @id
        raise "Invalid sandbox quarantine marker: #{@quarantine_path}"
      end

      state["workdir"] = workdir if workdir
      marker.rewind
      marker.truncate(0)
      marker.write(JSON.generate(state))
      marker.flush
      marker.fsync
      sync_lock_directory
      true
    ensure
      marker&.close
    end

    def quarantined_workdir
      state = JSON.parse(File.read(@quarantine_path))
      unless state.is_a?(Hash) && state["id"] == @id
        raise "Invalid sandbox quarantine marker: #{@quarantine_path}"
      end

      path = state["workdir"]
      return unless path

      unless path.is_a?(String) && path.start_with?(File::SEPARATOR) &&
          File.basename(path) == @id.to_s &&
          path != File::SEPARATOR
        raise "Invalid sandbox work directory in quarantine marker: #{@quarantine_path}"
      end

      path
    rescue Errno::ENOENT
      raise "Missing sandbox quarantine marker: #{@quarantine_path}"
    end

    def clear_quarantine!
      File.unlink(@quarantine_path)
      sync_lock_directory
      true
    rescue StandardError
      quarantine!
      raise
    end

    def release
      return unless @file

      file = @file
      @file = nil
      file.flock(File::LOCK_UN)
    ensure
      file&.close
    end

    private

    def sync_lock_directory
      File.open(File.dirname(@quarantine_path), File::RDONLY) { |directory| directory.fsync }
    end
  end

  def initialize(lock_dir: DEFAULT_LOCK_DIR, min_id: MIN_ID, max_id: MAX_ID, retry_interval: 0.05)
    raise ArgumentError, "Invalid sandbox ID range" unless min_id.between?(MIN_ID, MAX_ID) &&
      max_id.between?(min_id, MAX_ID)

    @lock_dir = lock_dir
    @min_id = min_id
    @max_id = max_id
    @retry_interval = retry_interval
  end

  def acquire
    prepare_lock_directory

    loop do
      (@min_id..@max_id).each do |id|
        file = nil
        begin
          file = open_lock_file(id)
          if file.flock(File::LOCK_EX | File::LOCK_NB)
            lease = Lease.new(id, file, @lock_dir)
            lease.quarantine!
            file = nil
            return lease
          end
        ensure
          file&.close
        end
      end

      sleep @retry_interval
    end
  end

  private

  def prepare_lock_directory
    begin
      Dir.mkdir(@lock_dir, 0o700)
    rescue Errno::EEXIST
      # Validate an existing directory before using any lockfile inside it.
    end

    stat = File.lstat(@lock_dir)
    unless stat.directory? && !stat.symlink? && stat.uid == Process.uid && (stat.mode & 0o077).zero?
      raise "Unsafe sandbox lock directory: #{@lock_dir}"
    end
  end

  def open_lock_file(id)
    path = File.join(@lock_dir, "box-#{id}.lock")
    flags = File::RDWR | File::CREAT
    flags |= File::NOFOLLOW if File.const_defined?(:NOFOLLOW)
    file = File.open(path, flags, 0o600)
    stat = file.stat
    unless stat.file? && stat.uid == Process.uid && (stat.mode & 0o077).zero?
      file.close
      raise "Unsafe sandbox lock file: #{path}"
    end
    file
  end
end

class IsolateJob < ApplicationJob
  retry_on RuntimeError, wait: 0.1.seconds, attempts: 100

  queue_as ENV["JUDGE0_VERSION"].to_sym

  MIN_VERSION_WITHOUT_CG_TIMING = Gem::Version.new("2.0.0")
  CG_TIMING_SUPPORTED = begin
    version_line = `isolate --version 2>/dev/null`.lines.first.to_s
    version_match = version_line[/\d+\.\d+(?:\.\d+)?/]
    if version_match
      Gem::Version.new(version_match) < MIN_VERSION_WITHOUT_CG_TIMING
    else
      true
    end
  rescue StandardError
    true
  end

  STDIN_FILE_NAME = "stdin.txt"
  STDOUT_FILE_NAME = "stdout.txt"
  STDERR_FILE_NAME = "stderr.txt"
  METADATA_FILE_NAME = "metadata.txt"
  ADDITIONAL_FILES_ARCHIVE_FILE_NAME = "additional_files.zip"

  attr_reader :submission, :cgroups,
              :box_id, :workdir, :boxdir, :tmpdir,
              :source_file, :stdin_file, :stdout_file,
              :stderr_file, :metadata_file, :additional_files_archive_file

  def perform(submission_id)
    @submission = Submission.find(submission_id)
    submission.update(status: Status.process, started_at: DateTime.now, execution_host: ENV["HOSTNAME"])
    @sandbox_lease = IsolateSandboxIdAllocator.new.acquire
    @box_id = @sandbox_lease.id
    @cgroups = (!submission.enable_per_process_and_thread_time_limit || !submission.enable_per_process_and_thread_memory_limit) ? "--cg" : ""
    recover_sandbox!

    time = []
    memory = []

    submission.number_of_runs.times do
      initialize_workdir
      if compile == :failure
        cleanup
        return
      end
      run
      verify

      time << submission.time
      memory << submission.memory

      cleanup
      break if submission.status != Status.ac
    end

    submission.time = time.inject(&:+).to_f / time.size
    submission.memory = memory.inject(&:+).to_f / memory.size
    submission.save

  rescue StandardError => e
    raise e.message unless submission
    submission.update(message: e.message, status: Status.boxerr, finished_at: DateTime.now)
    cleanup(false)
  ensure
    begin
      @sandbox_lease&.release
      @sandbox_lease = nil
    ensure
      call_callback
    end
  end

  private

  def initialize_workdir
    raise "Sandbox ID was not allocated" unless box_id&.between?(IsolateSandboxIdAllocator::MIN_ID, IsolateSandboxIdAllocator::MAX_ID)
    raise "Sandbox #{box_id} has not passed recovery checks" unless @sandbox_recovered

    @sandbox_initialized = false
    @sandbox_cleanup_needed = true
    @sandbox_lease.quarantine!
    output, error_output, status = run_isolate("--init")
    unless status.success?
      raise "Initialization of sandbox #{box_id} failed: #{error_output.to_s.strip}"
    end

    reported_workdir = output.to_s.strip
    unless output.to_s.lines.length == 1 && reported_workdir.start_with?(File::SEPARATOR)
      raise "Initialization of sandbox #{box_id} returned an invalid work directory"
    end

    @workdir = File.realpath(reported_workdir)
    unless File.basename(@workdir) == box_id.to_s &&
        @workdir != File::SEPARATOR &&
        @workdir != File.join(File::SEPARATOR, "box")
      raise "Initialization of sandbox #{box_id} returned an unsafe work directory"
    end

    @boxdir = File.join(workdir, "box")
    @tmpdir = File.join(workdir, "tmp")
    unless safe_sandbox_directory?(boxdir)
      raise "Initialization of sandbox #{box_id} did not create a valid box directory"
    end

    @sandbox_lease.quarantine!(workdir: workdir)
    ensure_sandbox_tmpdir!

    @sandbox_initialized = true
    @sandbox_cleanup_needed = true
    @source_file = boxdir + "/" + submission.language.source_file.to_s
    @stdin_file = workdir + "/" + STDIN_FILE_NAME
    @stdout_file = workdir + "/" + STDOUT_FILE_NAME
    @stderr_file = workdir + "/" + STDERR_FILE_NAME
    @metadata_file = workdir + "/" + METADATA_FILE_NAME
    @additional_files_archive_file = boxdir + "/" + ADDITIONAL_FILES_ARCHIVE_FILE_NAME

    [stdin_file, stdout_file, stderr_file, metadata_file].each do |f|
      initialize_file(f)
    end

    File.open(source_file, "wb") { |f| f.write(submission.source_code) } unless submission.is_project
    File.open(stdin_file, "wb") { |f| f.write(submission.stdin) }

    extract_archive
  end

  def initialize_file(file)
    sudo!("touch", "--", file)
    sudo!("chown", "#{Process.uid}:#{Process.gid}", "--", file)
  end

  def extract_archive
    return unless submission.additional_files?

    File.open(additional_files_archive_file, "wb") { |f| f.write(submission.additional_files) }

    command = "isolate #{cgroups} \
    -s \
    -b #{box_id} \
    --stderr-to-stdout \
    -t 2 \
    -x 1 \
    -w 4 \
    -k #{Config::MAX_STACK_LIMIT} \
    -p#{Config::MAX_MAX_PROCESSES_AND_OR_THREADS} \
    #{cg_timing_flag_for(submission)} \
    #{submission.enable_per_process_and_thread_memory_limit ? "-m " : "--cg-mem="}#{Config::MAX_MEMORY_LIMIT} \
    -f #{Config::MAX_EXTRACT_SIZE} \
    --run \
    -- /usr/bin/unzip -n -qq #{ADDITIONAL_FILES_ARCHIVE_FILE_NAME} \
    "

    puts "[#{DateTime.now}] Extracting archive for submission #{submission.token} (#{submission.id}):"
    puts command.gsub(/\s+/, " ")
    puts

    `#{command}`

    File.delete(additional_files_archive_file)
  end

  def compile
    unless submission.is_project
      return :success unless submission.language.compile_cmd
    end

    compile_script = boxdir + "/" + "compile.sh"

    acceptable_project_compile_scripts = [compile_script, boxdir + "/" + "compile"]
    if submission.is_project
      compile_file_exists = false
      acceptable_project_compile_scripts.each do |f|
        if File.file?(f)
          compile_script = f
          compile_file_exists = true
          break
        end
      end

      unless compile_file_exists
        return :success # If compile script does not exist then this project does not need to be compiled.
      end
    else
      # gsub can be skipped if compile script is used, but is kept for additional security.
      compiler_options = submission.compiler_options.to_s.strip.encode("UTF-8", invalid: :replace).gsub(/[$&;<>|`]/, "")
      File.open(compile_script, "w") { |f| f.write("#{submission.language.compile_cmd % compiler_options}") }
    end

    compile_output_file = workdir + "/" + "compile_output.txt"
    initialize_file(compile_output_file)

    command = "isolate #{cgroups} \
    -s \
    -b #{box_id} \
    -M #{metadata_file} \
    --stderr-to-stdout \
    -i /dev/null \
    -t #{Config::MAX_CPU_TIME_LIMIT} \
    -x 0 \
    -w #{Config::MAX_WALL_TIME_LIMIT} \
    -k #{Config::MAX_STACK_LIMIT} \
    -p#{Config::MAX_MAX_PROCESSES_AND_OR_THREADS} \
    #{cg_timing_flag_for(submission)} \
    #{submission.enable_per_process_and_thread_memory_limit ? "-m " : "--cg-mem="}#{Config::MAX_MEMORY_LIMIT} \
    -f #{Config::MAX_MAX_FILE_SIZE} \
    -E HOME=/tmp \
    -E PATH=\"/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\" \
    -E LANG -E LANGUAGE -E LC_ALL -E JUDGE0_HOMEPAGE -E JUDGE0_SOURCE_CODE -E JUDGE0_MAINTAINER -E JUDGE0_VERSION \
    -d /etc:noexec \
    --run \
    -- /bin/bash $(basename #{compile_script}) > #{compile_output_file} \
    "

    puts "[#{DateTime.now}] Compiling submission #{submission.token} (#{submission.id}):"
    puts command.gsub(/\s+/, " ")
    puts

    `#{command}`
    process_status = $?

    compile_output = File.read(compile_output_file)
    compile_output = nil if compile_output.empty?
    submission.compile_output = compile_output

    metadata = get_metadata

    reset_metadata_file

    files_to_remove = [compile_output_file]
    files_to_remove << compile_script unless submission.is_project
    files_to_remove.each do |f|
      `sudo rm -rf #{f}`
    end

    return :success if process_status.success?

    if metadata[:status] == "TO"
      submission.compile_output = "Compilation time limit exceeded."
    end

    submission.finished_at = DateTime.now
    submission.time = nil
    submission.wall_time = nil
    submission.memory = nil
    submission.stdout = nil
    submission.stderr = nil
    submission.exit_code = nil
    submission.exit_signal = nil
    submission.message = nil
    submission.status = Status.ce
    submission.save

    return :failure
  end

  def run
    run_script = boxdir + "/" + "run.sh"

    acceptable_project_run_scripts = [run_script, boxdir + "/" + "run"]
    acceptable_project_run_scripts.each do |f|
      if File.file?(f)
        run_script = f
        break
      end
    end

    unless submission.is_project
      # gsub is mandatory!
      command_line_arguments = submission.command_line_arguments.to_s.strip.encode("UTF-8", invalid: :replace).gsub(/[$&;<>|`]/, "")
      File.open(run_script, "w") { |f| f.write("#{submission.language.run_cmd} #{command_line_arguments}")}
    end

    command = "isolate #{cgroups} \
    -s \
    -b #{box_id} \
    -M #{metadata_file} \
    #{submission.redirect_stderr_to_stdout ? "--stderr-to-stdout" : ""} \
    #{submission.enable_network ? "--share-net" : ""} \
    -t #{submission.cpu_time_limit} \
    -x #{submission.cpu_extra_time} \
    -w #{submission.wall_time_limit} \
    -k #{submission.stack_limit} \
    -p#{submission.max_processes_and_or_threads} \
    #{cg_timing_flag_for(submission)} \
    #{submission.enable_per_process_and_thread_memory_limit ? "-m " : "--cg-mem="}#{submission.memory_limit} \
    -f #{submission.max_file_size} \
    -E HOME=/tmp \
    -E PATH=\"/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\" \
    -E LANG -E LANGUAGE -E LC_ALL -E JUDGE0_HOMEPAGE -E JUDGE0_SOURCE_CODE -E JUDGE0_MAINTAINER -E JUDGE0_VERSION \
    -d /etc:noexec \
    --run \
    -- /bin/bash $(basename #{run_script}) \
    < #{stdin_file} > #{stdout_file} 2> #{stderr_file} \
    "

    puts "[#{DateTime.now}] Running submission #{submission.token} (#{submission.id}):"
    puts command.gsub(/\s+/, " ")
    puts

    `#{command}`

    `sudo rm #{run_script}` unless submission.is_project
  end

  def verify
    submission.finished_at = DateTime.now

    metadata = get_metadata

    program_stdout = File.read(stdout_file)
    program_stdout = nil if program_stdout.empty?

    program_stderr = File.read(stderr_file)
    program_stderr = nil if program_stderr.empty?

    submission.time = metadata[:time]
    submission.wall_time = metadata[:"time-wall"]
    submission.memory = (cgroups.present? ? metadata[:"cg-mem"] : metadata[:"max-rss"])
    submission.stdout = program_stdout
    submission.stderr = program_stderr
    submission.exit_code = metadata[:exitcode].try(:to_i) || 0
    submission.exit_signal = metadata[:exitsig].try(:to_i)
    submission.message = metadata[:message]
    submission.status = determine_status(metadata[:status], submission.exit_signal)

    # After adding support for compiler_options and command_line_arguments
    # status "Exec Format Error" will no longer occur because compile and run
    # is done inside a dynamically created bash script, thus isolate doesn't call
    # execve directily on submission.language.compile_cmd or submission.langauge.run_cmd.
    # Consequence of running compile and run through bash script is that when
    # target binary is not found then submission gets status "Runtime Error (NZEC)".
    #
    # I think this is for now O.K. behaviour, but I will leave this if block
    # here until I am 100% sure that "Exec Format Error" can be deprecated.
    if submission.status == Status.boxerr &&
       (
         submission.message.to_s.match(/^execve\(.+\): Exec format error$/) ||
         submission.message.to_s.match(/^execve\(.+\): No such file or directory$/) ||
         submission.message.to_s.match(/^execve\(.+\): Permission denied$/)
       )
       submission.status = Status.exeerr
    end
  end

  def cleanup(raise_exception = true)
    return true unless @sandbox_cleanup_needed

    if sandbox_processes_running?
      raise "Cannot clean sandbox #{box_id} while sandbox processes remain"
    end

    if @sandbox_initialized
      fix_permissions
      (Dir.children(boxdir).map { |name| File.join(boxdir, name) } +
        Dir.children(tmpdir).map { |name| File.join(tmpdir, name) } +
        [stdin_file, stdout_file, stderr_file, metadata_file]).each do |file|
        sudo!("rm", "-rf", "--", file)
      end
    end

    cleanup_isolate_sandbox!
    @sandbox_lease.clear_quarantine!
    @sandbox_initialized = false
    @sandbox_cleanup_needed = false
    true
  rescue StandardError => e
    raise if raise_exception

    Rails.logger.error("Cleanup of sandbox #{box_id} failed: #{e.message}") if defined?(Rails) && Rails.logger
    false
  end

  def recover_sandbox!
    @sandbox_cleanup_needed = true
    @sandbox_recovered = false
    cleanup_isolate_sandbox!
    @sandbox_lease.clear_quarantine!
    @sandbox_cleanup_needed = false
    @sandbox_recovered = true
  end

  def cleanup_isolate_sandbox!
    results = []
    ["", "--cg"].each do |mode|
      begin
        _output, error_output, status = run_isolate("--cleanup", cgroups: mode)
        results << [mode, status.success?, error_output.to_s.strip]
      rescue StandardError => e
        results << [mode, false, e.message]
      end
    end

    unless results.any? { |_mode, success, _message| success }
      failures = results.map do |mode, _success, message|
        "#{mode.empty? ? 'default' : mode}: #{message}"
      end
      raise "Cleanup of sandbox #{box_id} failed: #{failures.join('; ')}"
    end

    if sandbox_processes_running?
      raise "Sandbox #{box_id} cleanup completed while sandbox processes remain"
    end

    sandbox_workdir = @sandbox_lease.quarantined_workdir
    if sandbox_workdir && (File.exist?(sandbox_workdir) || File.symlink?(sandbox_workdir))
      raise "Cleanup of sandbox #{box_id} completed but its work directory remains"
    end

    true
  end

  def sandbox_processes_running?
    proc_process_ids.any? do |pid|
      arguments = proc_process_cmdline(pid).split("\0")
      cgroup_paths = proc_process_cgroup(pid).lines.filter_map do |line|
        _hierarchy, _controllers, path = line.chomp.split(":", 3)
        path
      end

      isolate_command_for_box?(arguments) || cgroup_paths.any? { |path| cgroup_contains_box?(path) }
    rescue Errno::ENOENT, Errno::ESRCH
      false
    end
  end

  def proc_process_ids
    Dir.children("/proc").select { |entry| entry.match?(/\A\d+\z/) }
  end

  def proc_process_cmdline(pid)
    File.binread(File.join("/proc", pid, "cmdline"))
  end

  def proc_process_cgroup(pid)
    File.read(File.join("/proc", pid, "cgroup"))
  end

  def isolate_command_for_box?(arguments)
    File.basename(arguments.first.to_s) == "isolate" &&
      arguments.each_cons(2).any? { |argument, value| argument == "-b" && value == box_id.to_s }
  end

  def cgroup_contains_box?(path)
    path.split("/").include?("box-#{box_id}")
  end

  def run_isolate(*arguments, cgroups: nil)
    command = ["isolate"]
    effective_cgroups = cgroups.nil? ? self.cgroups : cgroups
    command.concat(effective_cgroups.split) if effective_cgroups.present?
    command.concat(["-b", box_id.to_s, *arguments])
    Open3.capture3(*command)
  end

  def safe_sandbox_directory?(path)
    File.directory?(path) && !File.symlink?(path) && File.realpath(path) == path
  end

  def ensure_sandbox_tmpdir!
    return if safe_sandbox_directory?(tmpdir) && owned_sandbox_directory?(tmpdir)
    raise "Sandbox #{box_id} has an unsafe tmp directory" if File.exist?(tmpdir) || File.symlink?(tmpdir)

    begin
      Dir.mkdir(tmpdir, 0o700)
    rescue Errno::EACCES, Errno::EPERM
      sudo!("mkdir", "-m", "700", "--", tmpdir)
      sudo!("chown", "#{Process.uid}:#{Process.gid}", "--", tmpdir)
    end

    unless safe_sandbox_directory?(tmpdir) && owned_sandbox_directory?(tmpdir)
      raise "Sandbox #{box_id} did not create a safe tmp directory"
    end
  end

  def owned_sandbox_directory?(path)
    stat = File.stat(path)
    stat.uid == Process.uid && (stat.mode & 0o077).zero?
  end

  def sudo!(*arguments)
    _output, error_output, status = Open3.capture3("sudo", *arguments)
    raise "Command failed (#{arguments.first}): #{error_output.to_s.strip}" unless status.success?
  end

  def reset_metadata_file
    `sudo rm -rf #{metadata_file}`
    initialize_file(metadata_file)
  end

  def fix_permissions
    sudo!("chown", "-R", "#{Process.uid}:#{Process.gid}", "--", boxdir)
  end

  def call_callback
    return unless submission.callback_url.present?

    serialized_submission = ActiveModelSerializers::SerializableResource.new(
      submission,
      {
        serializer: SubmissionSerializer,
        base64_encoded: true,
        fields: SubmissionSerializer.default_fields
      }
    ).to_json

    Config::CALLBACKS_MAX_TRIES.times do
      begin
        response = HTTParty.put(
          submission.callback_url,
          body: serialized_submission,
          headers: {
            "Content-Type" => "application/json"
          },
          timeout: Config::CALLBACKS_TIMEOUT
        )
        break
      rescue Exception => e
      end
    end
  rescue Exception => e
  end

  def get_metadata
    metadata = File.read(metadata_file).split("\n").collect do |e|
      { e.split(":").first.to_sym => e.split(":")[1..-1].join(":") }
    end.reduce({}, :merge)
    return metadata
  end

  def determine_status(status, exit_signal)
    if status == "TO"
      return Status.tle
    elsif status == "SG"
      return Status.find_runtime_error_by_status_code(exit_signal)
    elsif status == "RE"
      return Status.nzec
    elsif status == "XX"
      return Status.boxerr
    elsif submission.expected_output.nil? || strip(submission.expected_output) == strip(submission.stdout)
      return Status.ac
    else
      return Status.wa
    end
  end

  def strip(text)
    return nil unless text
    text.split("\n").collect(&:rstrip).join("\n").rstrip
  rescue ArgumentError
    return text
  end

  def cg_timing_flag_for(submission)
    return "" unless cgroups.present?
    return "" unless CG_TIMING_SUPPORTED

    if submission.enable_per_process_and_thread_time_limit
      "--no-cg-timing"
    else
      "--cg-timing"
    end
  end
end
