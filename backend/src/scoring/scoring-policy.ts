import type { PoolClient } from 'pg';

export type ScoringConfiguration = {
  scoringEnabled: boolean;
  maxScore: number;
  assignedPoints: number;
  scoredTestCount: number;
  pointsMatch: boolean;
};

export async function getProblemScoringConfiguration(
  client: Pick<PoolClient, 'query'>,
  problemId: string,
): Promise<ScoringConfiguration | null> {
  const result = await client.query<{
    scoring_enabled: boolean;
    max_score: string;
    assigned_points: string;
    scored_test_count: string;
    points_match: boolean;
  }>(
    `SELECT p.scoring_enabled,
            p.score::text AS max_score,
            COALESCE(SUM(test_case.points) FILTER (
              WHERE test_case.is_active = TRUE AND test_case.is_sample = FALSE
            ), 0)::text AS assigned_points,
            COUNT(test_case.id) FILTER (
              WHERE test_case.is_active = TRUE AND test_case.is_sample = FALSE
            )::text AS scored_test_count,
            COALESCE(SUM(test_case.points) FILTER (
              WHERE test_case.is_active = TRUE AND test_case.is_sample = FALSE
            ), 0) = p.score AS points_match
     FROM problems p
     LEFT JOIN problem_test_cases test_case ON test_case.problem_id = p.id
     WHERE p.id = $1
     GROUP BY p.id, p.score`,
    [problemId],
  );
  const row = result.rows[0];
  return row
    ? {
      scoringEnabled: row.scoring_enabled,
      maxScore: Number(row.max_score),
      assignedPoints: Number(row.assigned_points),
      scoredTestCount: Number(row.scored_test_count),
      pointsMatch: row.points_match,
    }
    : null;
}
