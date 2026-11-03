import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthSessionRepository } from './auth-session.repository.js';
import { AvatarStorageService } from './avatar-storage.service.js';
import { CoverStorageService } from './cover-storage.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { PasswordResetEmailService } from './password-reset-email.service.js';
import { PasswordResetRepository } from './password-reset.repository.js';
import { PasswordResetService } from './password-reset.service.js';
import { GoogleOAuthService } from './google-oauth.service.js';
import { GitHubOAuthService } from './github-oauth.service.js';
import { redisProducerClient } from '../queues/redis-clients.js';
import {
  GOOGLE_OAUTH_REDIS,
  GoogleOAuthStateStore,
} from './google-oauth-state.store.js';
import {
  GITHUB_OAUTH_REDIS,
  GitHubOAuthStateStore,
} from './github-oauth-state.store.js';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_ACCESS_SECRET;
        if (!secret || Buffer.byteLength(secret) < 32) {
          throw new Error(
            'JWT_ACCESS_SECRET must be configured with at least 32 bytes',
          );
        }
        return { secret, signOptions: { expiresIn: 900 } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionRepository,
    AvatarStorageService,
    CoverStorageService,
    JwtStrategy,
    PasswordResetEmailService,
    PasswordResetRepository,
    PasswordResetService,
    GoogleOAuthService,
    GoogleOAuthStateStore,
    GitHubOAuthService,
    GitHubOAuthStateStore,
    { provide: GOOGLE_OAUTH_REDIS, useValue: redisProducerClient },
    { provide: GITHUB_OAUTH_REDIS, useValue: redisProducerClient },
  ],
  exports: [AuthService, AvatarStorageService, CoverStorageService],
})
export class AuthModule {}
