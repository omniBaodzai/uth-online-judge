import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import type { LeaderboardCandidate } from './leaderboard-ranking.js';

interface LeaderboardRow {
  user_id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  solved_count: number;
  cumulative_points: number;
  performance_percentile: number | string | null;
  comparable_problems: number;
  achievement_at: Date | string | null;
}

@Injectable()
export class LeaderboardRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findCandidates(): Promise<LeaderboardCandidate[]> {
    const result = await this.pool.query<LeaderboardRow>(`
      WITH active_cases AS (
        SELECT tc.id, tc.problem_id,
               encode(sha256(convert_to(
                 '[' || to_json(tc.input_data)::text || ',' || to_json(tc.expected_output)::text || ']',
                 'UTF8'
               )), 'hex') AS content_fingerprint
        FROM public.problem_test_cases tc
        JOIN public.problems p ON p.id = tc.problem_id AND p.status = 'PUBLISHED'
        WHERE tc.is_active = TRUE
      ),
      cumulative_progress AS (
        SELECT passed.user_id,
               COUNT(DISTINCT active.id)::int AS cumulative_points,
               MAX(passed.first_passed_at) AS achievement_at
        FROM public.student_test_case_progress passed
        JOIN active_cases active
          ON active.id = passed.test_case_id
         AND active.problem_id = passed.problem_id
         AND active.content_fingerprint = passed.content_fingerprint
        GROUP BY passed.user_id
      ),
      valid_accepted_submissions AS (
        SELECT s.id, s.user_id, s.problem_id, s.judged_at
        FROM public.submissions s
        JOIN public.problems p ON p.id = s.problem_id AND p.status = 'PUBLISHED'
        JOIN public.submission_test_case_snapshots snapshot ON snapshot.submission_id = s.id
        LEFT JOIN public.submission_test_results result
          ON result.submission_id = s.id AND result.snapshot_id = snapshot.id
        WHERE s.status = 'ACCEPTED' AND s.judged_at IS NOT NULL
        GROUP BY s.id
        HAVING COUNT(DISTINCT snapshot.id) > 0
           AND COUNT(DISTINCT snapshot.id) = COUNT(DISTINCT result.id)
           AND COUNT(DISTINCT snapshot.id) = COUNT(DISTINCT result.id)
             FILTER (WHERE result.status = 'ACCEPTED')
      ),
      first_solves AS (
        SELECT user_id, problem_id, MIN(judged_at) AS first_accepted_at
        FROM valid_accepted_submissions
        GROUP BY user_id, problem_id
      ),
      solve_stats AS (
        SELECT user_id, COUNT(*)::int AS solved_count,
               MAX(first_accepted_at) AS achievement_at
        FROM first_solves
        GROUP BY user_id
      ),
      snapshot_context AS (
        SELECT snapshot.submission_id,
               encode(sha256(convert_to(
                 string_agg(
                   jsonb_build_array(
                     snapshot.source_test_case_id,
                     encode(sha256(convert_to(
                       '[' || to_json(snapshot.input_data)::text || ',' || to_json(snapshot.expected_output)::text || ']',
                       'UTF8'
                     )), 'hex'),
                     snapshot.points,
                     snapshot.position,
                     snapshot.time_limit_ms,
                     snapshot.memory_limit_kb
                   )::text,
                   '|' ORDER BY snapshot.position
                 ),
                 'UTF8'
               )), 'hex') AS test_signature
        FROM public.submission_test_case_snapshots snapshot
        GROUP BY snapshot.submission_id
      ),
      accepted_run_stats AS (
        SELECT s.id, s.user_id, s.problem_id, s.judged_at,
               language.judge0_language_id,
               COALESCE(language.version, '') AS language_version,
               context.test_signature,
               COUNT(DISTINCT snapshot.id)::int AS snapshot_count,
               COUNT(DISTINCT result.id)::int AS result_count,
               COUNT(DISTINCT result.id) FILTER (
                 WHERE result.status = 'ACCEPTED'
                   AND result.execution_time_ms IS NOT NULL
                   AND result.memory_used_kb IS NOT NULL
               )::int AS valid_result_count,
               SUM(result.execution_time_ms)::bigint AS runtime_ms,
               MAX(result.memory_used_kb)::int AS peak_memory_kb
        FROM valid_accepted_submissions accepted
        JOIN public.submissions s ON s.id = accepted.id
        JOIN public.problems p ON p.id = s.problem_id AND p.status = 'PUBLISHED'
        JOIN public.programming_languages language ON language.id = s.language_id
        JOIN public.submission_test_case_snapshots snapshot ON snapshot.submission_id = s.id
        JOIN snapshot_context context ON context.submission_id = s.id
        LEFT JOIN public.submission_test_results result
          ON result.submission_id = s.id AND result.snapshot_id = snapshot.id
        GROUP BY s.id, language.judge0_language_id, language.version, context.test_signature
      ),
      complete_runs AS (
        SELECT *
        FROM accepted_run_stats
        WHERE snapshot_count > 0
          AND snapshot_count = result_count
          AND snapshot_count = valid_result_count
          AND runtime_ms IS NOT NULL
          AND peak_memory_kb IS NOT NULL
      ),
      best_runs AS (
        SELECT DISTINCT ON (
          user_id, problem_id, test_signature, judge0_language_id, language_version
        ) *
        FROM complete_runs
        ORDER BY user_id, problem_id, test_signature,
                 judge0_language_id, language_version,
                 runtime_ms, peak_memory_kb, judged_at, id
      ),
      ranked_contexts AS (
        SELECT user_id, problem_id,
               RANK() OVER (
                 PARTITION BY problem_id, test_signature, judge0_language_id, language_version
                 ORDER BY runtime_ms, peak_memory_kb
               ) AS performance_rank,
               COUNT(*) OVER (
                 PARTITION BY problem_id, test_signature, judge0_language_id, language_version
               ) AS context_size
        FROM best_runs
      ),
      performance_by_problem AS (
        SELECT user_id, problem_id,
               MIN((performance_rank - 1)::numeric / NULLIF(context_size - 1, 0)) AS best_percentile
        FROM ranked_contexts
        WHERE context_size > 1
        GROUP BY user_id, problem_id
      ),
      performance_stats AS (
        SELECT user_id, AVG(best_percentile) AS performance_percentile,
               COUNT(*)::int AS comparable_problems
        FROM performance_by_problem
        GROUP BY user_id
      )
      SELECT u.id AS user_id,
             u.username,
             COALESCE(NULLIF(BTRIM(u.full_name), ''), NULLIF(u.username, ''), 'Người dùng UTH') AS display_name,
             u.avatar_url,
             COALESCE(solved.solved_count, 0)::int AS solved_count,
             COALESCE(progress.cumulative_points, 0)::int AS cumulative_points,
             performance.performance_percentile,
             COALESCE(performance.comparable_problems, 0)::int AS comparable_problems,
             GREATEST(solved.achievement_at, progress.achievement_at) AS achievement_at
      FROM public.users u
      LEFT JOIN solve_stats solved ON solved.user_id = u.id
      LEFT JOIN cumulative_progress progress ON progress.user_id = u.id
      LEFT JOIN performance_stats performance ON performance.user_id = u.id
    `);

    return result.rows.map((row) => ({
      userId: row.user_id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      solvedCount: Number(row.solved_count),
      cumulativePoints: Number(row.cumulative_points),
      performancePercentile: row.performance_percentile === null
        ? null
        : Number(row.performance_percentile),
      comparableProblems: Number(row.comparable_problems),
      achievementAt: row.achievement_at instanceof Date
        ? row.achievement_at.toISOString()
        : row.achievement_at,
    }));
  }
}