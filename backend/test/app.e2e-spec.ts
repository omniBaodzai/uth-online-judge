import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { AuthService } from './../src/auth/auth.service.js';
import { DATABASE_POOL } from './../src/databases/database.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const database = {
    query: vi.fn().mockResolvedValue({
      rows: [{ database_time: '2026-01-01T00:00:00.000Z' }],
    }),
    end: vi.fn().mockResolvedValue(undefined),
  };
  const auth = {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    uploadAvatar: vi.fn(),
  };

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-only-jwt-secret-with-at-least-32-characters';
    auth.register.mockReset().mockResolvedValue({
      user: {
        id: 'a83d7d70-2c6b-485e-a2da-ec1d571908fc',
        username: 'student01',
        email: 'student@example.com',
        full_name: null,
        avatar_url: null,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 900,
    });
    auth.login.mockReset().mockRejectedValue(new UnauthorizedException());
    auth.refresh.mockReset().mockRejectedValue(new UnauthorizedException());
    auth.logout.mockReset().mockResolvedValue(undefined);
    auth.getProfile.mockReset();
    auth.updateProfile.mockReset();
    auth.uploadAvatar.mockReset();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATABASE_POOL)
      .useValue(database)
      .overrideProvider(AuthService)
      .useValue(auth)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({
        status: 'ok',
        database: 'connected',
        databaseTime: '2026-01-01T00:00:00.000Z',
      });
  });

  it('rejects invalid registration payloads', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'x', email: 'bad-email', password: 'short' })
      .expect(400);
  });

  it('returns only the access token and sets the HttpOnly refresh cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'student01',
        email: 'student@example.com',
        password: 'valid-password',
      })
      .expect(201);

    expect(response.body).not.toHaveProperty('refreshToken');
    expect(response.body.accessToken).toBe('test-access-token');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('Path=/auth');
    expect(response.headers['set-cookie'][0]).toContain('Max-Age=');
    expect(auth.register).toHaveBeenCalledTimes(1);
  });

  it('signs in and sets refresh token only as an HttpOnly cookie', async () => {
    auth.login.mockResolvedValueOnce({
      user: { id: 'user-id', username: 'student01', email: 'student@example.com' },
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 900,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'student01', password: 'valid-password' })
      .expect(200);

    expect(response.body).not.toHaveProperty('refreshToken');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(auth.login).toHaveBeenCalledWith('student01', 'valid-password');
  });

  it('uses session cookies when remember login is unchecked', async () => {
    auth.login.mockResolvedValueOnce({
      user: { id: 'user-id', username: 'student01', email: 'student@example.com' },
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 900,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'student01', password: 'valid-password', rememberMe: false })
      .expect(200);
    const cookies = response.headers['set-cookie'] as string[];
    const refreshCookie = cookies.find((cookie) => cookie.startsWith('uth_refresh_token='));
    const rememberCookie = cookies.find((cookie) => cookie.startsWith('uth_remember_login='));

    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).not.toContain('Max-Age=');
    expect(rememberCookie).toContain('uth_remember_login=0');
    expect(rememberCookie).not.toContain('Max-Age=');
  });

  it('rejects non-boolean remember login values', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'student01', password: 'valid-password', rememberMe: 'true' })
      .expect(400)
      .then(() => {
        expect(auth.login).not.toHaveBeenCalled();
      });
  });

  it('rotates the refresh cookie without returning its token in JSON', async () => {
    auth.refresh.mockResolvedValueOnce({
      user: { id: 'user-id', username: 'student01', email: 'student@example.com' },
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
      expiresIn: 900,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'uth_refresh_token=old-refresh-token')
      .expect(200);

    expect(auth.refresh).toHaveBeenCalledWith('old-refresh-token');
    expect(response.body.accessToken).toBe('next-access-token');
    expect(response.body).not.toHaveProperty('refreshToken');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('next-refresh-token');
  });

  it('preserves remembered login when rotating refresh cookies', async () => {
    auth.refresh.mockResolvedValueOnce({
      user: { id: 'user-id', username: 'student01', email: 'student@example.com' },
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
      expiresIn: 900,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'uth_refresh_token=old-refresh-token; uth_remember_login=1')
      .expect(200);
    const cookies = response.headers['set-cookie'] as string[];

    expect(cookies.find((cookie) => cookie.startsWith('uth_refresh_token='))).toContain('Max-Age=');
    expect(cookies.find((cookie) => cookie.startsWith('uth_remember_login='))).toContain('Max-Age=');
  });

  it('preserves session-only login when rotating refresh cookies', async () => {
    auth.refresh.mockResolvedValueOnce({
      user: { id: 'user-id', username: 'student01', email: 'student@example.com' },
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
      expiresIn: 900,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'uth_refresh_token=old-refresh-token; uth_remember_login=0')
      .expect(200);
    const cookies = response.headers['set-cookie'] as string[];

    expect(cookies.find((cookie) => cookie.startsWith('uth_refresh_token='))).not.toContain('Max-Age=');
    expect(cookies.find((cookie) => cookie.startsWith('uth_remember_login='))).not.toContain('Max-Age=');
    expect(cookies.find((cookie) => cookie.startsWith('uth_remember_login='))).toContain('uth_remember_login=0');
  });

  it('clears the current cookie on logout', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', 'uth_refresh_token=current-refresh-token')
      .expect(204);

    expect(auth.logout).toHaveBeenCalledWith('current-refresh-token');
  });

  it('does not refresh without a refresh cookie', () => {
    return request(app.getHttpServer()).post('/auth/refresh').expect(401);
  });

  it('protects the current-user endpoint', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('returns the current profile for a valid access token', async () => {
    const profile = {
      id: 'a83d7d70-2c6b-485e-a2da-ec1d571908fc',
      username: 'student01',
      email: 'student@example.com',
    };
    auth.getProfile.mockResolvedValueOnce(profile);
    const accessToken = await app
      .get(JwtService)
      .signAsync({ sub: profile.id });

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual(profile);
    expect(auth.getProfile).toHaveBeenCalledWith(profile.id);
  });

  it('updates the current profile only through an authenticated request', async () => {
    const profile = {
      id: 'a83d7d70-2c6b-485e-a2da-ec1d571908fc',
      username: 'student01',
      email: 'student@example.com',
      full_name: 'Student Name',
      avatar_url: null,
    };
    auth.updateProfile.mockResolvedValueOnce(profile);
    const accessToken = await app.get(JwtService).signAsync({ sub: profile.id });

    await request(app.getHttpServer())
      .patch('/auth/me')
      .send({ fullName: 'Student Name' })
      .expect(401);

    const response = await request(app.getHttpServer())
      .patch('/auth/me')
      .set('Authorization', ['Bearer', accessToken].join(' '))
      .send({ fullName: 'Student Name' })
      .expect(200);

    expect(response.body).toEqual(profile);
    expect(auth.updateProfile).toHaveBeenCalledWith(profile.id, { fullName: 'Student Name' });

    await request(app.getHttpServer())
      .patch('/auth/me')
      .set('Authorization', ['Bearer', accessToken].join(' '))
      .send({ fullName: 'Student Name', is_active: false })
      .expect(400);
    expect(auth.updateProfile).toHaveBeenCalledTimes(1);
  });

  it('requires authentication to upload an avatar and forwards only validated profile data', async () => {
    const profile = {
      id: 'a83d7d70-2c6b-485e-a2da-ec1d571908fc',
      username: 'student01',
      email: 'student@example.com',
      full_name: 'Student Name',
      avatar_url: '/uploads/avatars/student.png',
    };
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    auth.uploadAvatar.mockResolvedValueOnce(profile);
    const accessToken = await app.get(JwtService).signAsync({ sub: profile.id });

    await request(app.getHttpServer())
      .post('/auth/me/avatar')
      .attach('avatar', image, { filename: 'student.png', contentType: 'image/png' })
      .expect(401);

    const response = await request(app.getHttpServer())
      .post('/auth/me/avatar')
      .set('Authorization', ['Bearer', accessToken].join(' '))
      .field('fullName', profile.full_name)
      .attach('avatar', image, { filename: 'student.png', contentType: 'image/png' })
      .expect(200);

    expect(response.body).toEqual(profile);
    expect(auth.uploadAvatar).toHaveBeenCalledWith(profile.id, image, {
      fullName: profile.full_name,
    });
  });

  it('allows logout when no current refresh cookie is present', () => {
    return request(app.getHttpServer()).post('/auth/logout').expect(204);
  });

  afterEach(async () => {
    await app.close();
  });
});
