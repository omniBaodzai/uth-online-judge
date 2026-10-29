import { testCaseFingerprint } from './test-case-fingerprint.js';

describe('testCaseFingerprint', () => {
  it('tracks input and expected-output content but not order or visibility metadata', () => {
    const original = testCaseFingerprint('input', 'output');
    const reorderedAndRepublished = testCaseFingerprint('input', 'output');

    expect(original).toBe(reorderedAndRepublished);
    expect(testCaseFingerprint('edited input', 'output')).not.toBe(original);
    expect(testCaseFingerprint('input', 'edited output')).not.toBe(original);
    expect(original).toMatch(/^[0-9a-f]{64}$/);
  });
});
