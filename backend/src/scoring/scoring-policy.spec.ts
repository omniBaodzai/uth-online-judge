import { getProblemScoringConfiguration } from './scoring-policy.js';

describe('problem scoring policy', () => {
  it('loads the maximum and only active hidden-test weights using bound parameters', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{
          scoring_enabled: true,
          max_score: '100.00',
          assigned_points: '100.00',
          scored_test_count: '3',
          points_match: true,
        }],
      }),
    };

    await expect(getProblemScoringConfiguration(client as never, 'problem-1')).resolves.toEqual({
      scoringEnabled: true,
      maxScore: 100,
      assignedPoints: 100,
      scoredTestCount: 3,
      pointsMatch: true,
    });
    const [sql, values] = client.query.mock.calls[0];
    expect(sql).toContain('test_case.is_sample = FALSE');
    expect(sql).toContain('test_case.is_active = TRUE');
    expect(values).toEqual(['problem-1']);
  });

  it('returns null when the problem does not exist', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    await expect(getProblemScoringConfiguration(client as never, 'missing')).resolves.toBeNull();
  });

  it('returns an explicit disabled mode even when its dormant maximum is positive', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{
          scoring_enabled: false,
          max_score: '100.00',
          assigned_points: '0.00',
          scored_test_count: '1',
          points_match: false,
        }],
      }),
    };

    await expect(getProblemScoringConfiguration(client as never, 'problem-1'))
      .resolves.toMatchObject({ scoringEnabled: false, maxScore: 100, pointsMatch: false });
  });
});
