export type EditorLanguage = {
  label: string
  monacoId: string
  template: string
}

const templates = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // Viết lời giải của bạn tại đây
    return 0;
}
`,
  c: `#include <stdio.h>

int main(void) {
    // Viết lời giải của bạn tại đây
    return 0;
}
`,
  java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Viết lời giải của bạn tại đây
    }
}
`,
  python: `import sys


def main():
    data = sys.stdin.read().split()
    # Viết lời giải của bạn tại đây


main()
`,
  javascript: `const lines = require('fs').readFileSync(0, 'utf8').split('\\n');

// Viết lời giải của bạn tại đây
`,
}

// Chỉ dùng để chọn mã mẫu và cách tô màu cú pháp. Việc ngôn ngữ nào được phép nộp
// do máy chủ quyết định (danh sách của bài tập), không phụ thuộc vào hàm này.
export function monacoLanguageId(name: string): string {
  const lower = name.toLocaleLowerCase()
  if (lower.includes('c++') || lower.includes('cpp')) return 'cpp'
  if (lower.includes('c#') || lower.includes('csharp')) return 'csharp'
  if (lower === 'c' || /^c(\s|\()/.test(lower)) return 'cpp'
  if (lower.startsWith('javascript') || lower.startsWith('node')) return 'javascript'
  if (lower.startsWith('java')) return 'java'
  if (lower.startsWith('python')) return 'python'
  if (lower.startsWith('typescript')) return 'typescript'
  if (lower.startsWith('go ') || lower === 'go' || lower.startsWith('golang')) return 'go'
  if (lower.startsWith('rust')) return 'rust'
  if (lower.startsWith('kotlin')) return 'kotlin'
  if (lower.startsWith('php')) return 'php'
  if (lower.startsWith('ruby')) return 'ruby'
  if (lower.startsWith('shell') || lower.startsWith('bash')) return 'shell'
  if (lower.startsWith('sql')) return 'sql'
  return 'plaintext'
}

export function describeLanguage(name: string): EditorLanguage {
  const lower = name.toLowerCase()
  if (lower.startsWith('c++')) return { label: name, monacoId: 'cpp', template: templates.cpp }
  if (lower === 'c' || /^c(\s|\()/.test(lower)) return { label: name, monacoId: 'cpp', template: templates.c }
  if (lower.startsWith('javascript')) return { label: name, monacoId: 'javascript', template: templates.javascript }
  if (lower.startsWith('java')) return { label: name, monacoId: 'java', template: templates.java }
  if (lower.startsWith('python')) return { label: name, monacoId: 'python', template: templates.python }
  return { label: name, monacoId: monacoLanguageId(name), template: '' }
}
