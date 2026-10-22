export type LanguageId = 'cpp' | 'java' | 'python' | 'javascript'

export type EditorLanguage = {
  id: LanguageId
  label: string
  monacoId: string
  template: string
}

// Mã mẫu ban đầu cho từng ngôn ngữ.
export const editorLanguages: EditorLanguage[] = [
  {
    id: 'cpp',
    label: 'C++',
    monacoId: 'cpp',
    template: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // Viết lời giải của bạn tại đây
    return 0;
}
`,
  },
  {
    id: 'java',
    label: 'Java',
    monacoId: 'java',
    template: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Viết lời giải của bạn tại đây
    }
}
`,
  },
  {
    id: 'python',
    label: 'Python',
    monacoId: 'python',
    template: `import sys


def main():
    data = sys.stdin.read().split()
    # Viết lời giải của bạn tại đây


main()
`,
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    monacoId: 'javascript',
    template: `const lines = require('fs').readFileSync(0, 'utf8').split('\\n');

// Viết lời giải của bạn tại đây
`,
  },
]

export function getLanguage(id: LanguageId): EditorLanguage {
  return editorLanguages.find((language) => language.id === id) ?? editorLanguages[0]
}

export function isLanguageId(value: string | null): value is LanguageId {
  return editorLanguages.some((language) => language.id === value)
}
