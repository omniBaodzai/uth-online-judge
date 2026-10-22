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

export const codeTemplateByDisplayName: Record<string, string> = {
  'C17': '#include <stdio.h>\n\nint main(void) {\n    // Viết lời giải của bạn tại đây\n    return 0;\n}\n',
  'C++17': '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    // Viết lời giải của bạn tại đây\n    return 0;\n}\n',
  'C++20': '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    // Viết lời giải của bạn tại đây\n    return 0;\n}\n',
  'Java 17': 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Viết lời giải của bạn tại đây\n    }\n}\n',
  'Python 3': '# Viết lời giải của bạn tại đây\n',
  'C# 12': 'using System;\n\nclass Program {\n    static void Main() {\n        // Viết lời giải của bạn tại đây\n    }\n}\n',
  'Go 1.23': 'package main\n\nimport "fmt"\n\nfunc main() {\n    // Viết lời giải của bạn tại đây\n    fmt.Print()\n}\n',
  'Rust 1.82': 'use std::io;\n\nfn main() {\n    // Viết lời giải của bạn tại đây\n}\n',
  'JavaScript': '// Viết lời giải của bạn tại đây\n',
}