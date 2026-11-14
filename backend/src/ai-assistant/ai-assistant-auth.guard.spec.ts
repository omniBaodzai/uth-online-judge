import { createHmac } from 'node:crypto';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import type { INestApplication } from '@nestjs/common';
import type { Request } from 'express';
import request from 'supertest';
import { UsersService } from '../users/users.service.js';
import {
  AI_ASSISTANT_CONFIG,
  loadAiAssistantConfig,
} from './ai-assistant.config.js';
import {
  AiAssistantAuthGuard,
  type AiAssistantRequest,
} from './ai-assistant-auth.guard.js';
import { AiAssistantGuestIdentity } from './ai-assistant.guest-identity.js';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';

const jwtSecret = 'test-jwt-secret-with-at-least-thirty-two-bytes';
const cookieSecret = 'test-guest-cookie-secret-with-32-bytes-minimum';

function signToken(payload: Record<string, unknown>, secret = jwtSecret) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsigned = `${header}.${body}`;
  const signature = createHmac('sha256', secret)
    .update(unsigned)
    .digest('base64url');
  return `${unsigned}.${signature}`;
}

@Controller('ai-assistant-auth-probe')
@UseGuards(AiAssistantAuthGuard)
class AiAssistantAuthProbeController {
  @Get()
  getPrincipal(@Req() request: Request & AiAssistantRequest) {
    return request.aiAssistantPrincipal;
  }
}

describe('AiAssistantAuthGuard', () => {
  let app: INestApplication;
  let users: { findById: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    vi.stubEnv('JWT_ACCESS_SECRET', jwtSecret);
    users = {
      findById: vi.fn(async (id: string) => ({
        id,
        role: 'STUDENT',
        is_active: true,
        auth_version: 3,
      })),
    };
    const config = loadAiAssistantConfig({
      AI_ASSISTANT_ENABLED: 'true',
      AI_ASSISTANT_GUEST_COOKIE_SECRET: cookieSecret,
    });
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [AiAssistantAuthProbeController],
      providers: [
        AiAssistantAuthGuard,
        JwtStrategy,
        AiAssistantGuestIdentity,
        { provide: AI_ASSISTANT_CONFIG, useValue: config },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    users.findById.mockClear();
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('allows requests without Authorization as guests and issues a scoped cookie', async () => {
    const response = await request(app.getHttpServer())
      .get('/ai-assistant-auth-probe')
      .expect(200);

    expect(response.body.kind).toBe('guest');
    expect(response.body.id).toBeTruthy();
    expect(response.headers['set-cookie'][0]).toContain(
      'uth_ai_assistant_guest=',
    );
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('uses the verified JWT subject for authenticated requests', async () => {
    const token = signToken({
      sub: 'authenticated-user',
      ver: 3,
      exp: Math.floor(Date.now() / 1_000) + 60,
    });
    const response = await request(app.getHttpServer())
      .get('/ai-assistant-auth-probe')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      kind: 'user',
      id: 'authenticated-user',
    });
    expect(users.findById).toHaveBeenCalledWith('authenticated-user');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it.each([
    ['expired JWT', () =>
      signToken({
        sub: 'expired-user',
        ver: 3,
        exp: Math.floor(Date.now() / 1_000) - 1,
      })],
    ['wrong signature', () =>
      signToken(
        {
          sub: 'wrong-signature-user',
          ver: 3,
          exp: Math.floor(Date.now() / 1_000) + 60,
        },
        'different-test-jwt-secret-with-at-least-thirty-two-bytes',
      )],
    ['invalid auth version', () =>
      signToken({
        sub: 'old-session-user',
        ver: 2,
        exp: Math.floor(Date.now() / 1_000) + 60,
      })],
  ])('rejects an %s token without downgrading to guest', async (_label, token) => {
    const response = await request(app.getHttpServer())
      .get('/ai-assistant-auth-probe')
      .set('Authorization', `Bearer ${token()}`)
      .expect(401);

    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it.each(['Bearer ', 'Basic abc', 'Bearer a b'])(
    'rejects malformed Authorization header %s',
    async (authorization) => {
      await request(app.getHttpServer())
        .get('/ai-assistant-auth-probe')
        .set('Authorization', authorization)
        .expect(401);
    },
  );

  it('does not treat a refresh cookie as an authenticated chatbot request', async () => {
    const response = await request(app.getHttpServer())
      .get('/ai-assistant-auth-probe')
      .set('Cookie', 'uth_refresh_token=refresh-cookie-value')
      .expect(200);

    expect(response.body.kind).toBe('guest');
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('rejects a JWT for a missing or inactive account', async () => {
    users.findById.mockResolvedValueOnce(null);
    const token = signToken({
      sub: 'inactive-user',
      ver: 3,
      exp: Math.floor(Date.now() / 1_000) + 60,
    });

    const response = await request(app.getHttpServer())
      .get('/ai-assistant-auth-probe')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
