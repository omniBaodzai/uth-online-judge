import { describe, expect, it, vi } from 'vitest';

vi.mock('./monaco-setup', () => ({ monaco: { editor: { setTheme: vi.fn() } } }));

import { monacoThemeFor } from './monaco-theme';

describe('monacoThemeFor', () => {
  it('uses the dark editor theme in dark mode', () => {
    expect(monacoThemeFor('dark', '/problems/abc/submit')).toBe('uth-dark');
  });

  it('uses the light editor theme in light mode', () => {
    expect(monacoThemeFor('light', '/problems/abc/submit')).toBe('uth-light');
  });

  it('always forces light on admin paths', () => {
    expect(monacoThemeFor('dark', '/admin/problems/new')).toBe('uth-light');
  });
});
