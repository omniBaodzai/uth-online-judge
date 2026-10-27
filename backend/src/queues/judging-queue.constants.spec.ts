import {
  getJudgingBatchSize,
  getJudgingConcurrency,
  getJudgingGlobalConcurrency,
} from './judging-queue.constants.js';

describe('judging worker limits', () => {
  it('uses bounded defaults and caps configured concurrency and batch size', () => {
    expect(getJudgingConcurrency('2')).toBe(2);
    expect(getJudgingConcurrency('100')).toBe(8);
    expect(getJudgingConcurrency('invalid')).toBe(2);
    expect(getJudgingBatchSize('1')).toBe(1);
    expect(getJudgingBatchSize('100')).toBe(4);
    expect(getJudgingBatchSize('invalid')).toBe(4);
    expect(getJudgingBatchSize(undefined)).toBe(4);
  });

  it('defaults global concurrency to the existing per-worker setting and caps overrides', () => {
    expect(getJudgingGlobalConcurrency(undefined)).toBe(2);
    expect(getJudgingGlobalConcurrency('4')).toBe(4);
    expect(getJudgingGlobalConcurrency('100')).toBe(8);
    expect(getJudgingGlobalConcurrency('invalid')).toBe(2);
  });
});
