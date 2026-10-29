import { createHash } from 'node:crypto';

export function testCaseFingerprint(
  input: string,
  expectedOutput: string,
): string {
  return createHash('sha256')
    .update(JSON.stringify([input, expectedOutput]), 'utf8')
    .digest('hex');
}
