export const submissionLanguages = ['C17', 'C++17', 'C++20', 'Java 17', 'Python 3', 'C# 12', 'Go 1.23', 'Rust 1.82', 'JavaScript']

export const monacoLanguageByDisplayName: Record<string, string> = {
  'C17': 'c',
  'C++17': 'cpp',
  'C++20': 'cpp',
  'Java 17': 'java',
  'Python 3': 'python',
  'C# 12': 'csharp',
  'Go 1.23': 'go',
  'Rust 1.82': 'rust',
  'JavaScript': 'javascript',
}
// Ánh xạ ngôn ngữ trên giao diện sang language_id của Judge0 CE
export const judge0LanguageIdByDisplayName: Record<string, number> = {
  'C17': 50,
  'C++17': 54,
  'C++20': 54,
  'Java 17': 62,
  'Python 3': 71,
  'C# 12': 51,
  'Go 1.23': 60,
  'Rust 1.82': 73,
  'JavaScript': 63,
}
