import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import request from 'supertest';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';
import { UsersService } from '../users/users.service.js';
import { StudentContestsController } from './student-contests.controller.js';
import { StudentContestsService } from './student-contests.service.js';
import { SubmissionsService } from '../submissions/submissions.service.js';

describe('Student contest HTTP integration', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const secret = 'student-contest-test-secret-with-at-least-32-bytes';
  const studentId = 'c0a80101-0000-4000-8000-000000000002';
  let previousSecret: string | undefined;
  const service = {
    list: vi.fn(),
    get: vi.fn(),
    statistics: vi.fn(),
    leaderboard: vi.fn(),
    participants: vi.fn(),
    submissions: vi.fn(),
    register: vi.fn(),
    cancel: vi.fn(),
  };
  const users = {
    findById: vi.fn().mockResolvedValue({
      id: studentId,
      is_active: true,
      role: 'USER',
    }),
  };

  beforeEach(async () => {
    previousSecret = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = secret;
    vi.clearAllMocks();
    users.findById.mockResolvedValue({
      id: studentId,
      is_active: true,
      role: 'USER',
    });
    service.list.mockResolvedValue({
      items: [{ id: 'contest-id', slug: 'uth-open', timeStatus: 'UPCOMING' }],
      total: 1,
      page: 1,
      pageSize: 10,
    });
    service.get.mockResolvedValue({ id: 'contest-id', problems: [] });
    service.statistics.mockResolvedValue({
      totalParticipants: 1,
      totalProblems: 2,
      totalSubmissions: 0,
      acceptedSubmissions: 0,
      wrongAnswerSubmissions: 0,
      timeLimitSubmissions: 0,
      runtimeErrorSubmissions: 0,
      pendingSubmissions: 0,
      otherSubmissions: 0,
      activeSubmitters: 0,
      solvedParticipants: 0,
      statusCounts: [],
      problemStatistics: [],
      languageStatistics: [],
    });
    service.leaderboard.mockResolvedValue({
      items: [],
      total: 0,
      totalParticipants: 0,
      page: 1,
      pageSize: 10,
    });
    service.participants.mockResolvedValue({
      items: [],
      total: 0,
      participantCount: 0,
      page: 1,
      pageSize: 10,
    });
    service.submissions.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      statistics: { total: 0, accepted: 0, acceptanceRate: 0, verdictCounts: {} },
      filters: { languages: [] },
    });
    service.register.mockResolvedValue({
      contestId: 'contest-id',
      registrationStatus: 'REGISTERED',
      registeredAt: '2026-10-30T06:00:00.000Z',
    });
    service.cancel.mockResolvedValue({
      contestId: 'contest-id',
      registrationStatus: 'CANCELLED',
      registeredAt: '2026-10-30T06:00:00.000Z',
    });

    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret }),
      ],
      controllers: [StudentContestsController],
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: users },
        { provide: StudentContestsService, useValue: service },
        { provide: SubmissionsService, useValue: { createForContest: vi.fn() } },
      ],
    })
      .compile();

    jwt = moduleRef.get(JwtService);
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousSecret;
  });

  it('serves a paginated public listing with validated query parameters', async () => {
    const response = await request(app.getHttpServer())
      .get('/contests?page=1&pageSize=10&timeStatus=UPCOMING&sort=startsAt&order=asc')
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 10,
        search: undefined,
        timeStatus: 'UPCOMING',
        sort: 'startsAt',
        order: 'asc',
      }),
      null,
    );
  });

  it('serves UUID/slug detail through the public route and forwards optional identity', async () => {
    const token = jwt.sign({ sub: studentId });
    await request(app.getHttpServer())
      .get('/contests/uth-open')
      .expect(200);
    await request(app.getHttpServer())
      .get('/contests/uth-open')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/contests/uth-open')
      .set('Authorization', 'Bearer invalid-token')
      .expect(200);

    expect(service.get).toHaveBeenNthCalledWith(1, 'uth-open', null);
    expect(service.get).toHaveBeenNthCalledWith(2, 'uth-open', studentId);
    expect(service.get).toHaveBeenNthCalledWith(3, 'uth-open', null);
  });

  it('serves public contest statistics by UUID or slug without requiring authentication', async () => {
    const expected = {
      totalParticipants: 1,
      totalProblems: 2,
      totalSubmissions: 0,
      acceptedSubmissions: 0,
      wrongAnswerSubmissions: 0,
      timeLimitSubmissions: 0,
      runtimeErrorSubmissions: 0,
      pendingSubmissions: 0,
      otherSubmissions: 0,
      activeSubmitters: 0,
      solvedParticipants: 0,
      statusCounts: [],
      problemStatistics: [],
      languageStatistics: [],
    };
    await request(app.getHttpServer())
      .get('/contests/uth-open/statistics')
      .expect(200)
      .expect(expected);
    await request(app.getHttpServer())
      .get(`/contests/${studentId}/statistics`)
      .expect(200);
    expect(service.statistics).toHaveBeenNthCalledWith(1, 'uth-open');
    expect(service.statistics).toHaveBeenNthCalledWith(2, studentId);
  });

  it('serves leaderboard by slug or UUID with validated backend search and pagination', async () => {
    service.leaderboard.mockResolvedValueOnce({
      items: [],
      total: 0,
      totalParticipants: 0,
      page: 2,
      pageSize: 20,
    });
    await request(app.getHttpServer())
      .get('/contests/uth-open/leaderboard?page=2&pageSize=20&search=%20Coder%20')
      .expect(200)
      .expect({ items: [], total: 0, totalParticipants: 0, page: 2, pageSize: 20 });
    await request(app.getHttpServer())
      .get(`/contests/${studentId}/leaderboard`)
      .expect(200);

    expect(service.leaderboard).toHaveBeenNthCalledWith(1, 'uth-open', {
      page: 2,
      pageSize: 20,
      search: 'Coder',
    });
    expect(service.leaderboard).toHaveBeenNthCalledWith(2, studentId, {
      page: 1,
      pageSize: 10,
    });
  });

  it('serves public participants with filters and a separate unfiltered member count', async () => {
    service.participants.mockResolvedValueOnce({
      items: [{
        userId: studentId,
        username: 'student',
        avatarUrl: null,
        registeredAt: '2026-10-31T07:20:00.000Z',
        status: 'participated',
      }],
      total: 1,
      participantCount: 4,
      page: 2,
      pageSize: 20,
    });
    const response = await request(app.getHttpServer())
      .get('/contests/uth-open/participants?page=2&pageSize=20&search=%20Student%20&status=participated')
      .expect(200);
    expect(response.body).toMatchObject({
      total: 1,
      participantCount: 4,
      page: 2,
      pageSize: 20,
      items: [{ userId: studentId, status: 'participated' }],
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /email|password|token|source_code/i,
    );
    expect(service.participants).toHaveBeenCalledWith('uth-open', {
      page: 2,
      pageSize: 20,
      search: 'Student',
      status: 'participated',
    });
    await request(app.getHttpServer())
      .get(`/contests/${studentId}/participants`)
      .expect(200);
    expect(service.participants).toHaveBeenNthCalledWith(2, studentId, {
      page: 1,
      pageSize: 10,
      status: 'all',
    });
  });

  it('rejects invalid participant filters and unsupported page sizes', async () => {
    await request(app.getHttpServer())
      .get('/contests/uth-open/participants?status=cancelled')
      .expect(400);
    await request(app.getHttpServer())
      .get('/contests/uth-open/participants?pageSize=15')
      .expect(400);
    expect(service.participants).not.toHaveBeenCalled();
  });

  it('requires JWT for registration and cancellation and passes only token identity', async () => {
    const token = jwt.sign({ sub: studentId });
    await request(app.getHttpServer())
      .post('/contests/uth-open/registration')
      .expect(401);
    await request(app.getHttpServer())
      .delete('/contests/uth-open/registration')
      .expect(401);

    await request(app.getHttpServer())
      .post('/contests/uth-open/registration')
      .set('Authorization', `Bearer ${token}`)
      .expect(201)
      .expect({ contestId: 'contest-id', registrationStatus: 'REGISTERED', registeredAt: '2026-10-30T06:00:00.000Z' });
    await request(app.getHttpServer())
      .delete('/contests/uth-open/registration')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ contestId: 'contest-id', registrationStatus: 'CANCELLED', registeredAt: '2026-10-30T06:00:00.000Z' });

    expect(service.register).toHaveBeenCalledWith('uth-open', studentId);
    expect(service.cancel).toHaveBeenCalledWith('uth-open', studentId);
  });

  it('rejects invalid public query filters before calling the service', async () => {
    await request(app.getHttpServer())
      .get('/contests?pageSize=1000&sort=sql_injection')
      .expect(400);

    expect(service.list).not.toHaveBeenCalled();
  });

  it('rejects unsupported leaderboard page sizes before calling the service', async () => {
    await request(app.getHttpServer())
      .get('/contests/uth-open/leaderboard?pageSize=15')
      .expect(400);

    expect(service.leaderboard).not.toHaveBeenCalled();
  });

  it('serves public contest submission metadata with validated filters without requiring JWT', async () => {
    service.submissions.mockResolvedValueOnce({
      items: [{
        id: 'submission-id',
        status: 'ACCEPTED',
        submittedAt: '2026-10-31T07:20:00.000Z',
        username: 'student',
        problemCode: 'UTH001',
        problemTitle: 'Sum two',
        language: 'C++',
        executionTimeMs: 18,
        memoryUsedKb: 2048,
        canViewDetails: false,
      }],
      total: 1,
      page: 2,
      pageSize: 20,
      statistics: {
        total: 1,
        accepted: 1,
        acceptanceRate: 100,
        verdictCounts: { ACCEPTED: 1 },
      },
      filters: { languages: ['C++'] },
    });
    const response = await request(app.getHttpServer())
      .get('/contests/uth-open/submissions?page=2&pageSize=20&search=%20UTH001%20&status=ACCEPTED&language=C%2B%2B')
      .expect(200);
    expect(response.body.items[0].id).toBe('submission-id');
    expect(JSON.stringify(response.body)).not.toMatch(
      /source_code|judge0_token|input_data|expected_output|password_hash/i,
    );
    expect(service.submissions).toHaveBeenCalledWith('uth-open', {
      page: 2,
      pageSize: 20,
      search: 'UTH001',
      status: 'ACCEPTED',
      language: 'C++',
    }, null);
  });

  it('rejects an unsupported contest-submissions page size without affecting the POST route', async () => {
    await request(app.getHttpServer())
      .get('/contests/uth-open/submissions?pageSize=15')
      .expect(400);
    expect(service.submissions).not.toHaveBeenCalled();
  });
});
