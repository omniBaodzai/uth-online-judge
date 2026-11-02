import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import type {
  ContestRegistration,
  StudentContestDetail,
  StudentContestListItem,
  StudentContestListQuery,
  StudentContestPage,
  StudentContestProblem,
  StudentContestTimeStatus,
  StudentRegistrationStatus,
} from './student-contests.types.js';

type PublicContestRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  rules?: string | null;
  starts_at: Date | string;
  ends_at: Date | string;
  allow_registration: boolean;
  time_status: StudentContestTimeStatus;
  can_register: boolean;
  participant_count: number;
  is_registered?: boolean;
  registration_status?: StudentRegistrationStatus | null;
  database_now?: Date | string;
};

type ProblemRow = {
  problem_id: string;
  problem_code_snapshot: string;
  problem_title_snapshot: string;
  position: number;
  max_score: string | number;
};

const SORT_SQL: Record<StudentContestListQuery['sort'], string> = {
  startsAt: 'starts_at',
  endsAt: 'ends_at',
  title: 'title',
  participantCount: 'participant_count',
};

const PUBLIC_CONTEST_CONDITION =
  "c.publication_status = 'PUBLISHED' AND c.visibility = 'PUBLIC'";

@Injectable()
export class StudentContestsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async list(
    query: StudentContestListQuery,
    userId: string | null,
  ): Promise<StudentContestPage> {
    return this.withReadTransaction(async (client) => {
      const clockResult = await client.query<{ now: Date | string }>(
        'SELECT clock_timestamp() AS now',
      );
      const databaseNow = clockResult.rows[0]!.now;
      const filterValues: unknown[] = [];
      const conditions = [PUBLIC_CONTEST_CONDITION];

      if (query.search) {
        filterValues.push(`%${escapeLike(query.search)}%`);
        conditions.push(
          `(c.title ILIKE $${filterValues.length} ESCAPE '\\' OR c.slug ILIKE $${filterValues.length} ESCAPE '\\')`,
        );
      }

      if (query.timeStatus) {
        filterValues.push(databaseNow);
        const timeParameter = `$${filterValues.length}::timestamptz`;
        const statusSql: Record<StudentContestTimeStatus, string> = {
          UPCOMING: `c.starts_at > ${timeParameter}`,
          ONGOING: `c.starts_at <= ${timeParameter} AND c.ends_at > ${timeParameter}`,
          ENDED: `c.ends_at <= ${timeParameter}`,
        };
        conditions.push(`(${statusSql[query.timeStatus]})`);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;
      const countResult = await client.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM public.contests c
         ${where}`,
        filterValues,
      );

      const pageValues = [
        userId,
        databaseNow,
        ...filterValues,
        query.pageSize,
        (query.page - 1) * query.pageSize,
      ];
      const pageWhere = where.replace(/\$(\d+)/g, (_, parameter: string) =>
        `$${Number(parameter) + 2}`,
      );
      const direction = query.order.toUpperCase();
      const result = await client.query<PublicContestRow>(
        `SELECT c.id, c.slug, c.title, c.description, c.starts_at, c.ends_at,
                c.allow_registration,
                CASE
                  WHEN c.starts_at > $2::timestamptz THEN 'UPCOMING'
                  WHEN c.ends_at > $2::timestamptz THEN 'ONGOING'
                  ELSE 'ENDED'
                END AS time_status,
                (c.allow_registration
                 AND c.starts_at > $2::timestamptz
                 AND registration.user_id IS NULL) AS can_register,
                (registration.user_id IS NOT NULL) AS is_registered,
                (SELECT COUNT(*)::int
                 FROM public.contest_participants participant
                 WHERE participant.contest_id = c.id
                   AND participant.registration_status = 'REGISTERED') AS participant_count
         FROM public.contests c
         LEFT JOIN public.contest_participants registration
           ON registration.contest_id = c.id
          AND registration.user_id = $1::uuid
          AND registration.registration_status = 'REGISTERED'
         ${pageWhere}
         ORDER BY ${SORT_SQL[query.sort]} ${direction} NULLS LAST, c.id ASC
         LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
        pageValues,
      );

      return {
        items: result.rows.map(mapListItem),
        total: Number(countResult.rows[0]?.total ?? 0),
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }

  async findPublic(identifier: string, userId: string | null): Promise<StudentContestDetail> {
    const uuid = isUuid(identifier) ? identifier : null;
    return this.withReadTransaction(async (client) => {
      const result = await client.query<PublicContestRow>(
        `WITH db_clock AS (SELECT clock_timestamp() AS now)
         SELECT c.id, c.slug, c.title, c.description, c.rules,
                c.starts_at, c.ends_at, c.allow_registration,
                db_clock.now AS database_now,
                CASE
                  WHEN c.starts_at > db_clock.now THEN 'UPCOMING'
                  WHEN c.ends_at > db_clock.now THEN 'ONGOING'
                  ELSE 'ENDED'
                END AS time_status,
                (c.allow_registration AND c.starts_at > db_clock.now) AS can_register,
                (SELECT COUNT(*)::int
                 FROM public.contest_participants participant
                 WHERE participant.contest_id = c.id
                   AND participant.registration_status = 'REGISTERED') AS participant_count,
                COALESCE(registration.registration_status = 'REGISTERED', FALSE) AS is_registered,
                registration.registration_status
         FROM public.contests c
         CROSS JOIN db_clock
         LEFT JOIN public.contest_participants registration
           ON registration.contest_id = c.id
          AND registration.user_id = $3::uuid
         WHERE ${PUBLIC_CONTEST_CONDITION}
           AND (c.id = $1::uuid OR c.slug = $2)`,
        [uuid, identifier, userId],
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException('Không tìm thấy cuộc thi.');

      const problemAccessAvailable =
        row.is_registered === true && row.time_status === 'ONGOING';
      const problems = problemAccessAvailable
        ? await this.loadPublicProblems(client, row.id)
        : [];
      return {
        ...mapListItem(row),
        canRegister: row.can_register && !row.is_registered,
        rules: row.rules ?? null,
        isRegistered: row.is_registered ?? false,
        registrationStatus: row.registration_status ?? null,
        problems,
      };
    });
  }

  async register(contestId: string, userId: string): Promise<ContestRegistration> {
    return this.withTransaction(async (client) => {
      const contest = await this.lockPublicContest(client, contestId);
      await this.assertBeforeStart(client, contest.id, true);

      const current = await client.query<{
        registration_status: StudentRegistrationStatus;
      }>(
        `SELECT registration_status
         FROM public.contest_participants
         WHERE contest_id = $1 AND user_id = $2
         FOR UPDATE`,
        [contest.id, userId],
      );
      if (current.rows[0]?.registration_status === 'REGISTERED') {
        throw new ConflictException('Bạn đã đăng ký cuộc thi này.');
      }

      const result = current.rows.length > 0
        ? await client.query<RegistrationRow>(
          `UPDATE public.contest_participants participant
           SET registration_status = 'REGISTERED',
               registered_at = clock_timestamp(),
               cancelled_at = NULL
           WHERE participant.contest_id = $1
             AND participant.user_id = $2
             AND participant.registration_status = 'CANCELLED'
             AND EXISTS (
               SELECT 1 FROM public.contests c
               WHERE c.id = participant.contest_id
                 AND c.publication_status = 'PUBLISHED'
                 AND c.visibility = 'PUBLIC'
                 AND c.allow_registration = TRUE
                 AND c.starts_at > clock_timestamp()
             )
           RETURNING contest_id, registration_status, registered_at`,
          [contest.id, userId],
        )
        : await client.query<RegistrationRow>(
          `INSERT INTO public.contest_participants
             (contest_id, user_id, registered_at, registration_status, cancelled_at)
           SELECT c.id, $2, clock_timestamp(), 'REGISTERED', NULL
           FROM public.contests c
           WHERE c.id = $1
             AND c.publication_status = 'PUBLISHED'
             AND c.visibility = 'PUBLIC'
             AND c.allow_registration = TRUE
             AND c.starts_at > clock_timestamp()
           RETURNING contest_id, registration_status, registered_at`,
          [contest.id, userId],
        );

      const registration = result.rows[0];
      if (!registration) {
        throw new ConflictException('Đăng ký đã đóng hoặc cuộc thi vừa bắt đầu.');
      }
      return mapRegistration(registration);
    });
  }

  async cancel(contestId: string, userId: string): Promise<ContestRegistration> {
    return this.withTransaction(async (client) => {
      const contest = await this.lockPublicContest(client, contestId);
      await this.assertBeforeStart(client, contest.id, false);

      const result = await client.query<RegistrationRow>(
        `UPDATE public.contest_participants participant
         SET registration_status = 'CANCELLED',
             cancelled_at = clock_timestamp()
         WHERE participant.contest_id = $1
           AND participant.user_id = $2
           AND participant.registration_status = 'REGISTERED'
           AND EXISTS (
             SELECT 1 FROM public.contests c
             WHERE c.id = participant.contest_id
               AND c.publication_status = 'PUBLISHED'
               AND c.visibility = 'PUBLIC'
               AND c.starts_at > clock_timestamp()
           )
         RETURNING contest_id, registration_status, registered_at`,
        [contest.id, userId],
      );
      const registration = result.rows[0];
      if (!registration) {
        throw new ConflictException(
          'Không thể hủy đăng ký: bạn chưa đăng ký hoặc cuộc thi đã bắt đầu.',
        );
      }
      return mapRegistration(registration);
    });
  }

  private async lockPublicContest(client: PoolClient, id: string): Promise<{ id: string }> {
    const uuid = isUuid(id) ? id : null;
    const result = await client.query<{ id: string }>(
      `SELECT c.id
       FROM public.contests c
       WHERE (c.id = $1::uuid OR c.slug = $2)
         AND ${PUBLIC_CONTEST_CONDITION}
       ORDER BY (c.id = $1::uuid) DESC
       LIMIT 1
       FOR UPDATE`,
      [uuid, id],
    );
    const contest = result.rows[0];
    if (!contest) throw new NotFoundException('Không tìm thấy cuộc thi.');
    return contest;
  }

  private async assertBeforeStart(
    client: PoolClient,
    contestId: string,
    requireRegistration: boolean,
  ): Promise<void> {
    const result = await client.query<{
      before_start: boolean;
      allow_registration: boolean;
    }>(
      `SELECT starts_at > clock_timestamp() AS before_start,
              allow_registration
       FROM public.contests
       WHERE id = $1`,
      [contestId],
    );
    const row = result.rows[0];
    if (!row?.before_start) {
      throw new ConflictException('Không thể thay đổi đăng ký sau khi cuộc thi bắt đầu.');
    }
    if (requireRegistration && !row.allow_registration) {
      throw new ConflictException('Cuộc thi hiện không cho phép đăng ký.');
    }
  }

  private async loadPublicProblems(
    client: Pick<PoolClient, 'query'>,
    contestId: string,
  ): Promise<StudentContestProblem[]> {
    const result = await client.query<ProblemRow>(
      `SELECT problem_id, problem_code_snapshot, problem_title_snapshot, position, max_score
       FROM public.contest_problems
       WHERE contest_id = $1
       ORDER BY position ASC`,
      [contestId],
    );
    return result.rows.map((row) => ({
      problemId: row.problem_id,
      problemCode: row.problem_code_snapshot,
      problemTitle: row.problem_title_snapshot,
      position: row.position,
      maxScore: Number(row.max_score),
    }));
  }

  private async withReadTransaction<T>(
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(operation, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  }

  private async withTransaction<T>(
    operation: (client: PoolClient) => Promise<T>,
    beginStatement = 'BEGIN',
  ): Promise<T> {
    const client = await this.database.connect();
    try {
      await client.query(beginStatement);
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

type RegistrationRow = {
  contest_id: string;
  registration_status: StudentRegistrationStatus;
  registered_at: Date | string;
};

function mapListItem(row: PublicContestRow): StudentContestListItem {
  const startsAt = toIsoString(row.starts_at);
  const endsAt = toIsoString(row.ends_at);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    startsAt,
    endsAt,
    timeStatus: row.time_status,
    allowRegistration: row.allow_registration,
    canRegister: row.can_register,
    isRegistered: row.is_registered ?? false,
    participantCount: Number(row.participant_count),
  };
}

function mapRegistration(row: RegistrationRow): ContestRegistration {
  return {
    contestId: row.contest_id,
    registrationStatus: row.registration_status,
    registeredAt: toIsoString(row.registered_at),
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
