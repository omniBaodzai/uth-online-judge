import { ArgumentsHost, Catch, HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

@Injectable()
export class ErrorLogService {
  private readonly logger = new Logger(ErrorLogService.name);

  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async record(input: {
    source: 'BACKEND' | 'FRONTEND';
    level?: 'ERROR' | 'WARN';
    message: string;
    stack?: string | null;
    path?: string | null;
    method?: string | null;
    statusCode?: number | null;
    userId?: string | null;
  }): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO error_logs (source, level, message, stack, path, method, status_code, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          input.source,
          input.level ?? 'ERROR',
          input.message.slice(0, 2000),
          input.stack?.slice(0, 8000) ?? null,
          input.path?.slice(0, 500) ?? null,
          input.method?.slice(0, 10) ?? null,
          input.statusCode ?? null,
          input.userId ?? null,
        ],
      );
    } catch (error) {
      this.logger.warn(`Không ghi được error log: ${(error as Error).message}`);
    }
  }
}

/** Ghi mọi lỗi 5xx chưa được xử lý vào bảng error_logs rồi giao lại cho bộ lọc mặc định của Nest. */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  constructor(
    private readonly errors: ErrorLogService,
    adapterHost: HttpAdapterHost,
  ) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500 && host.getType() === 'http') {
      const request = host.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
      const error = exception instanceof Error ? exception : new Error(String(exception));
      void this.errors.record({
        source: 'BACKEND',
        message: error.message || 'Lỗi không xác định',
        stack: error.stack,
        path: request.originalUrl,
        method: request.method,
        statusCode: status,
        userId: request.user?.id ?? null,
      });
    }
    super.catch(exception, host);
  }
}
