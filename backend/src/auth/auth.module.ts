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

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_ACCESS_SECRET;
        if (!secret || Buffer.byteLength(secret) < 32) {
          throw new Error('JWT_ACCESS_SECRET must be configured with at least 32 bytes');
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
  ],
  exports: [AuthService, AvatarStorageService, CoverStorageService],
})
export class AuthModule {}
