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

describe('Student contest HTTP integration', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const secret = 'student-contest-test-secret-with-at-least-32-bytes';
  const studentId = 'c0a80101-0000-4000-8000-000000000002';
  let previousSecret: string | undefined;
  const service = {
    list: vi.fn(),
    get: vi.fn(),
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
    expect(service.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      timeStatus: 'UPCOMING',
      sort: 'startsAt',
      order: 'asc',
    });
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
});
