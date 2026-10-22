import { Global, Module } from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';
import { ActivityLogService } from './activity-log.service.js';
import { AdminSeedService } from './admin-seed.service.js';
import { AllExceptionsFilter, ErrorLogService } from './error-log.service.js';
import { RolesGuard } from './roles.guard.js';
import { SettingsService } from './settings.service.js';

@Global()
@Module({
  providers: [
    ActivityLogService,
    ErrorLogService,
    SettingsService,
    RolesGuard,
    AdminSeedService,
    {
      provide: APP_FILTER,
      inject: [ErrorLogService, HttpAdapterHost],
      useFactory: (errors: ErrorLogService, adapterHost: HttpAdapterHost) => new AllExceptionsFilter(errors, adapterHost),
    },
  ],
  exports: [ActivityLogService, ErrorLogService, SettingsService, RolesGuard],
})
export class PlatformModule {}
