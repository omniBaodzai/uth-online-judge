import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from './databases/database.module.js';

@Injectable()
export class AppService {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly database: Pool,
  ) {}

  async getHealth() {
    const result = await this.database.query('SELECT NOW() AS database_time');

    return {
      status: 'ok',
      database: 'connected',
      databaseTime: result.rows[0].database_time,
    };
  }
}
