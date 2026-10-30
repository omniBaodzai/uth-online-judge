import { Global, Inject, Injectable, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';

export const DATABASE_POOL = 'DATABASE_POOL';

@Injectable()
export class PoolLifecycle implements OnApplicationShutdown {
  private readonly logger = new Logger(PoolLifecycle.name);

  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
  ) {
    this.pool.on('connect', () => {
      this.logger.log(
        `PostgreSQL connection established ${poolState(this.pool)}`,
      );
    });
    this.pool.on('error', (error) => {
      this.logger.error(
        `Unexpected PostgreSQL idle-client error code=${errorCode(error)} ${poolState(this.pool)}; failed client removed`,
        error.stack,
      );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

function poolState(pool: Pool): string {
  return `poolTotal=${pool.totalCount} poolIdle=${pool.idleCount} poolWaiting=${pool.waitingCount}`;
}

function errorCode(error: Error): string {
  return 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: () => {
        return new Pool({
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT ?? 5432),
          database: process.env.DB_NAME,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          application_name: 'uth-online-judge-backend',
          max: parsePoolMax(process.env.DB_POOL_MAX),
          connectionTimeoutMillis: 5000,
        });
      },
    },
    PoolLifecycle,
  ],
  exports: [DATABASE_POOL],
})
export class DatabaseModule {}

function parsePoolMax(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 20;
  const max = Number(value);
  if (!Number.isInteger(max) || max < 1 || max > 80) {
    throw new Error('DB_POOL_MAX must be an integer between 1 and 80.');
  }
  return max;
}
