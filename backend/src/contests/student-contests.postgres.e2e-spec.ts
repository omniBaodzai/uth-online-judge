import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { randomUUID } from 'node:crypto';
import { DATABASE_POOL } from '../databases/database.module.js';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';
import { UsersService } from '../users/users.service.js';
import { JUDGING_QUEUE } from '../queues/judging-queue.constants.js';
import { SubmissionsRepository } from '../submissions/submissions.repository.js';
import { SubmissionsService } from '../submissions/submissions.service.js';
import { StudentContestsController } from './student-contests.controller.js';
import { StudentContestsRepository } from './student-contests.repository.js';
import { StudentContestsService } from './student-contests.service.js';

const enabled = process.env.RUN_POSTGRES_CONTEST_E2E === '1';
const jwtSecret = process.env.JWT_ACCESS_SECRET;

describe.skipIf(!enabled)('Student Contests with PostgreSQL 17', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let jwt: JwtService;
  let studentId: string;
  let token: string;
  let allowedLanguage: string;
  let problem: { id: string; problem_code: string; title: string; test_case_revision: number };
  let prefix: string;
  const contestIds = new Set<string>();
  const retainedContestIds = new Set<string>();
  const disposableContestIds = new Set<string>();
  const pathByKey = new Map<string, { id: string; slug: string }>();

  beforeAll(async () => {
    if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32) {
      throw new Error('PostgreSQL Student Contest test requires JWT_ACCESS_SECRET.');
    }
    if (process.env.DB_NAME !== 'uth_online_judge') {
      throw new Error('Refusing to run PostgreSQL test against an unexpected database.');
    }

    pool = new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 8,
      connectionTimeoutMillis: 5000,
    });
    const schema = await pool.query<{ contests: string | null; participants: string | null }>(
      `SELECT to_regclass('public.contests') AS contests,
              to_regclass('public.contest_participants') AS participants`,
    );
    if (
      schema.rows[0]?.contests !== 'contests'
      || schema.rows[0]?.participants !== 'contest_participants'
    ) {
      throw new Error('Migration 018 tables are not present; no test data was created.');
    }

    const problemResult = await pool.query<{
      id: string;
      problem_code: string;
      title: string;
      test_case_revision: number;
    }>(
      `SELECT p.id, p.problem_code, p.title, p.test_case_revision
       FROM public.problems p
       WHERE p.status = 'PUBLISHED'
         AND EXISTS (
           SELECT 1
           FROM public.problem_test_cases tc
           WHERE tc.problem_id = p.id AND tc.is_active = TRUE
         )
       ORDER BY p.id
       LIMIT 1`,
    );
    problem = problemResult.rows[0]!;
    if (!problem) {
      throw new Error('No existing published problem with active tests is available.');
    }
    const languageResult = await pool.query<{ slug: string }>(
      `SELECT language.slug
       FROM public.problem_languages problem_language
       JOIN public.programming_languages language
         ON language.id = problem_language.language_id
       WHERE problem_language.problem_id = $1
         AND language.is_enabled = TRUE
       ORDER BY language.slug
       LIMIT 1`,
      [problem.id],
    );
    const selectedLanguage = languageResult.rows[0]?.slug;
    if (!selectedLanguage) {
      throw new Error('The selected published problem has no enabled language.');
    }
    allowedLanguage = selectedLanguage;

    const randomPart = randomUUID().replaceAll('-', '');
    prefix = `e2e-test-${randomPart}`;
    const user = await pool.query<{ id: string }>(
      `INSERT INTO public.users (username, email, role, google_id)
       VALUES ($1, $2, 'STUDENT', $3)
       RETURNING id`,
      [`${prefix.slice(0, 30)}`, `${prefix}@example.invalid`, prefix],
    );
    studentId = user.rows[0]!.id;
    const judgingQueue = { add: vi.fn().mockResolvedValue({}) };

    const testModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: jwtSecret }),
      ],
      controllers: [StudentContestsController],
      providers: [
        JwtStrategy,
        UsersService,
        StudentContestsRepository,
        StudentContestsService,
        SubmissionsRepository,
        SubmissionsService,
        { provide: DATABASE_POOL, useValue: pool },
        { provide: getQueueToken(JUDGING_QUEUE), useValue: judgingQueue },
      ],
    }).compile();

    jwt = testModule.get(JwtService);
    token = jwt.sign({ sub: studentId });
    app = testModule.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const upcoming = await createContest('registration', 'PUBLIC', true, '2 hours', '3 hours');
    pathByKey.set('registration', upcoming);
    await publish(upcoming.id);
    retainedContestIds.add(upcoming.id);

    const active = await createContest('problem-access', 'PUBLIC', true, '2 hours', '3 hours');
    pathByKey.set('problem-access', active);
    retainedContestIds.add(active.id);
    await pool.query(
      `INSERT INTO public.contest_problems
         (contest_id, problem_id, position, max_score,
          problem_code_snapshot, problem_title_snapshot, test_case_revision)
       VALUES ($1, $2, 1, 100, $3, $4, $5)`,
      [active.id, problem.id, problem.problem_code, problem.title, problem.test_case_revision],
    );
    await publish(active.id);

    const closed = await createContest('registration-closed', 'PUBLIC', false, '2 hours', '3 hours');
    pathByKey.set('registration-closed', closed);
    await publish(closed.id);
    disposableContestIds.add(closed.id);

    const ended = await createContest('ended', 'PUBLIC', true, '-3 hours', '-2 hours');
    pathByKey.set('ended', ended);
    await publish(ended.id);
    disposableContestIds.add(ended.id);

    const draft = await createContest('draft', 'PUBLIC', true, '2 hours', '3 hours');
    pathByKey.set('draft', draft);
    disposableContestIds.add(draft.id);

    const privateDraft = await createContest('private', 'PRIVATE', true, '2 hours', '3 hours');
    pathByKey.set('private', privateDraft);
    disposableContestIds.add(privateDraft.id);

    const archived = await createContest('archived', 'PUBLIC', true, '2 hours', '3 hours');
    pathByKey.set('archived', archived);
    await publish(archived.id);
    await pool.query(
      `UPDATE public.contests
       SET publication_status = 'ARCHIVED'
       WHERE id = $1`,
      [archived.id],
    );
    disposableContestIds.add(archived.id);

    const started = await createContest('started', 'PUBLIC', true, '-1 hour', '1 hour');
    pathByKey.set('started', started);
    await publish(started.id);
    disposableContestIds.add(started.id);
  }, 30_000);

  afterAll(async () => {
    if (!pool) return;
    try {
      if (app) await app.close();
      if (studentId && contestIds.size > 0) {
        await pool.query(
          `DELETE FROM public.submissions
           WHERE user_id = $1 AND contest_id = ANY($2::uuid[])`,
          [studentId, [...contestIds]],
        );
      }
      for (const id of retainedContestIds) {
        await pool.query(
          `UPDATE public.contests
           SET publication_status = 'ARCHIVED'
           WHERE id = $1 AND publication_status = 'PUBLISHED'`,
          [id],
        );
      }
      for (const id of disposableContestIds) {
        await pool.query('DELETE FROM public.contests WHERE id = $1', [id]);
      }
      for (const id of retainedContestIds) {
        await pool.query('DELETE FROM public.contests WHERE id = $1', [id]);
      }
      if (studentId) {
        const remaining = await pool.query<{ references_count: string }>(
          `SELECT (
             (SELECT COUNT(*) FROM public.contest_participants WHERE user_id = $1)
             +
             (SELECT COUNT(*) FROM public.contests WHERE created_by = $1 OR updated_by = $1)
           )::text AS references_count`,
          [studentId],
        );
        if (Number(remaining.rows[0]?.references_count ?? 0) === 0) {
          await pool.query('DELETE FROM public.users WHERE id = $1', [studentId]);
        }
      }
    } finally {
      await pool.end();
    }
  }, 30_000);

  it('serves both list paths with filters, stable sorting, pagination, and public-only results', async () => {
    const pageOne = await request(app.getHttpServer())
      .get(`/contests?page=1&pageSize=2&search=${prefix}&sort=title&order=asc`)
      .expect(200);
    expect(pageOne.body).toMatchObject({ total: 5, page: 1, pageSize: 2 });
    expect(pageOne.body.items).toHaveLength(2);
    expect(pageOne.body.items.map((item: { title: string }) => item.title)).toEqual([
      expect.stringContaining(prefix),
      expect.stringContaining(prefix),
    ]);
    expect(Object.keys(pageOne.body.items[0]).sort()).toEqual([
      'allowRegistration',
      'canRegister',
      'description',
      'endsAt',
      'id',
      'participantCount',
      'slug',
      'startsAt',
      'timeStatus',
      'title',
    ].sort());

    const pageTwo = await request(app.getHttpServer())
      .get(`/contests/?page=2&pageSize=2&search=${prefix}&sort=title&order=asc`)
      .expect(200);
    expect(pageTwo.body.total).toBe(5);
    expect(pageTwo.body.items).toHaveLength(2);
    expect(pageOne.body.items.map((item: { id: string }) => item.id)
      .sort((left: string, right: string) => left.localeCompare(right)))
      .not.toEqual(pageTwo.body.items.map((item: { id: string }) => item.id)
        .sort((left: string, right: string) => left.localeCompare(right)));

    for (const [status, expectedTotal] of [
      ['UPCOMING', 3],
      ['ONGOING', 1],
      ['ENDED', 1],
    ] as const) {
      const response = await request(app.getHttpServer())
        .get(`/contests?search=${prefix}&timeStatus=${status}&sort=startsAt&order=asc`)
        .expect(200);
      expect(response.body.total).toBe(expectedTotal);
      expect(response.body.items.every(
        (item: { timeStatus: string }) => item.timeStatus === status,
      )).toBe(true);
    }

    const trailingSlash = await request(app.getHttpServer())
      .get(`/contests/?search=${prefix}&sort=participantCount&order=desc`)
      .expect(200);
    expect(trailingSlash.body.total).toBe(5);
    expect(trailingSlash.body.items.every(
      (item: { slug: string }) => item.slug.startsWith(prefix),
    )).toBe(true);
    expect(JSON.stringify(trailingSlash.body)).not.toMatch(
      /test_case_revision|answer|source_code/i,
    );
  });

  it('hides DRAFT, PRIVATE, ARCHIVED and missing contests as not found', async () => {
    for (const key of ['draft', 'private', 'archived', 'not-found']) {
      const slug = pathByKey.get(key)?.slug ?? `${prefix}-missing`;
      await request(app.getHttpServer()).get(`/contests/${slug}`).expect(404);
      await request(app.getHttpServer())
        .post(`/contests/${slug}/registration`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/contests/${slug}/registration`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    }
  });

  it('requires JWT for registration changes and supports duplicate, cancel, and re-registration', async () => {
    const contest = pathByKey.get('registration')!;
    await request(app.getHttpServer())
      .post(`/contests/${contest.slug}/registration`)
      .expect(401);
    await request(app.getHttpServer())
      .delete(`/contests/${contest.id}/registration`)
      .expect(401);

    const initial = await request(app.getHttpServer())
      .post(`/contests/${contest.slug}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(initial.body).toMatchObject({
      contestId: contest.id,
      registrationStatus: 'REGISTERED',
    });
    expect(Object.keys(initial.body).sort()).toEqual([
      'contestId',
      'registeredAt',
      'registrationStatus',
    ]);

    await request(app.getHttpServer())
      .post(`/contests/${contest.id}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/contests/${contest.id}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => expect(body.registrationStatus).toBe('CANCELLED'));

    await request(app.getHttpServer())
      .post(`/contests/${contest.id}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201)
      .expect(({ body }) => expect(body.registrationStatus).toBe('REGISTERED'));

    await request(app.getHttpServer())
      .delete(`/contests/${contest.id}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => expect(body.registrationStatus).toBe('CANCELLED'));

    const concurrent = await Promise.all([
      request(app.getHttpServer())
        .post(`/contests/${contest.id}/registration`)
        .set('Authorization', `Bearer ${token}`),
      request(app.getHttpServer())
        .post(`/contests/${contest.id}/registration`)
        .set('Authorization', `Bearer ${token}`),
    ]);
    expect(concurrent.map((response) => response.status).sort((a, b) => a - b))
      .toEqual([201, 409]);

    await request(app.getHttpServer())
      .delete(`/contests/${contest.id}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => expect(body.registrationStatus).toBe('CANCELLED'));
    const participants = await pool.query<{ count: string; registered: string }>(
      `SELECT COUNT(*)::text AS count,
              COUNT(*) FILTER (WHERE registration_status = 'REGISTERED')::text AS registered
       FROM public.contest_participants
       WHERE contest_id = $1 AND user_id = $2`,
      [contest.id, studentId],
    );
    expect(participants.rows[0]).toEqual({ count: '1', registered: '0' });
  });

  it('rejects registration when disabled or after the PostgreSQL start-time boundary', async () => {
    for (const key of ['registration-closed', 'started']) {
      const contest = pathByKey.get(key)!;
      await request(app.getHttpServer())
        .post(`/contests/${contest.slug}/registration`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    }
  });

  it('returns problem snapshots only to a registered participant during the active window', async () => {
    const contest = pathByKey.get('problem-access')!;

    const upcoming = await request(app.getHttpServer())
      .get(`/contests/${contest.id}`)
      .expect(200);
    expect(upcoming.body.problems).toEqual([]);
    expect(upcoming.body.canRegister).toBe(true);

    await request(app.getHttpServer())
      .post(`/contests/${contest.id}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    await pool.query(
      `UPDATE public.contests
       SET starts_at = clock_timestamp() - INTERVAL '10 minutes',
           ends_at = clock_timestamp() + INTERVAL '50 minutes'
       WHERE id = $1`,
      [contest.id],
    );
    retainedContestIds.add(contest.id);

    const anonymous = await request(app.getHttpServer())
      .get(`/contests/${contest.slug}`)
      .expect(200);
    expect(anonymous.body.problems).toEqual([]);
    expect(anonymous.body.isRegistered).toBe(false);

    const registered = await request(app.getHttpServer())
      .get(`/contests/${contest.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(registered.body.timeStatus).toBe('ONGOING');
    expect(registered.body.isRegistered).toBe(true);
    expect(registered.body.problems).toEqual([{
      problemId: problem.id,
      problemCode: problem.problem_code,
      problemTitle: problem.title,
      position: 1,
      maxScore: 100,
    }]);
    expect(JSON.stringify(registered.body)).not.toMatch(
      /test_case_revision|test_case|answer|source_code/i,
    );

    const submitted = await request(app.getHttpServer())
      .post(`/contests/${contest.id}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        problemCode: problem.problem_code,
        language: allowedLanguage,
        sourceCode: 'int main() { return 0; }',
      })
      .expect(201);
    expect(submitted.body).toMatchObject({
      status: 'QUEUED',
    });
    expect(submitted.body.id).toBeTruthy();
    const persistedSubmission = await pool.query<{
      contest_id: string;
      contest_max_score_snapshot: string;
      status: string;
    }>(
      `SELECT contest_id, contest_max_score_snapshot::text, status
       FROM public.submissions
       WHERE id = $1 AND user_id = $2`,
      [submitted.body.id, studentId],
    );
    expect(persistedSubmission.rows[0]).toMatchObject({
      contest_id: contest.id,
      contest_max_score_snapshot: '100.00',
      status: 'QUEUED',
    });

    await request(app.getHttpServer())
      .delete(`/contests/${contest.id}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    await request(app.getHttpServer())
      .post(`/contests/${contest.id}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  async function createContest(
    key: string,
    visibility: 'PUBLIC' | 'PRIVATE',
    allowRegistration: boolean,
    startOffset: string,
    endOffset: string,
  ): Promise<{ id: string; slug: string }> {
    const slug = `${prefix}-${key}`;
    const result = await pool.query<{ id: string }>(
      `INSERT INTO public.contests
         (slug, title, starts_at, ends_at, publication_status, visibility,
          allow_registration, show_leaderboard, created_by)
       VALUES ($1, $2, clock_timestamp() + $3::interval,
               clock_timestamp() + $4::interval, 'DRAFT', $5, $6, TRUE, $7)
       RETURNING id`,
      [slug, `${prefix} ${key}`, startOffset, endOffset, visibility, allowRegistration, studentId],
    );
    const contest = { id: result.rows[0]!.id, slug };
    contestIds.add(contest.id);
    return contest;
  }

  async function publish(id: string): Promise<void> {
    await pool.query(
      `UPDATE public.contests
       SET publication_status = 'PUBLISHED',
           published_at = clock_timestamp()
       WHERE id = $1`,
      [id],
    );
  }
});
