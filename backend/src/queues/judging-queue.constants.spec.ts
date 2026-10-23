import { getJudgingBatchSize, getJudgingConcurrency } from './judging-queue.constants.js';

describe('judging worker limits', () => {
  it('uses bounded defaults and caps configured concurrency and batch size', () => {
    expect(getJudgingConcurrency('2')).toBe(2);
    expect(getJudgingConcurrency('100')).toBe(8);
    expect(getJudgingConcurrency('invalid')).toBe(2);
    expect(getJudgingBatchSize('1')).toBe(1);
    expect(getJudgingBatchSize('100')).toBe(4);
    expect(getJudgingBatchSize('invalid')).toBe(3);
  });
});
