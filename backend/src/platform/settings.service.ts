import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

export type SystemSettings = {
  appName: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
  maxUploadMb: number;
  features: {
    submissions: boolean;
    contests: boolean;
    organizations: boolean;
    comments: boolean;
    registration: boolean;
  };
};

export const DEFAULT_SETTINGS: SystemSettings = {
  appName: 'UTH Online Judge',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpFrom: '',
  maxUploadMb: 2,
  features: { submissions: true, contests: true, organizations: true, comments: true, registration: true },
};

const SETTINGS_KEY = 'general';
const SMTP_PASSWORD_KEY = 'smtp_password';
const CACHE_TTL_MS = 10_000;

@Injectable()
export class SettingsService {
  private cache: { value: SystemSettings; expiresAt: number } | null = null;

  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async get(): Promise<SystemSettings> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.value;
    const result = await this.database.query<{ value: Partial<SystemSettings> }>(
      'SELECT value FROM system_settings WHERE key = $1',
      [SETTINGS_KEY],
    );
    const stored = result.rows[0]?.value ?? {};
    const value: SystemSettings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      features: { ...DEFAULT_SETTINGS.features, ...(stored.features ?? {}) },
    };
    this.cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  }

  async update(next: SystemSettings, smtpPassword?: string): Promise<SystemSettings> {
    await this.upsert(SETTINGS_KEY, next);
    if (smtpPassword) await this.upsert(SMTP_PASSWORD_KEY, smtpPassword);
    this.cache = null;
    return this.get();
  }

  async hasSmtpPassword(): Promise<boolean> {
    const result = await this.database.query('SELECT 1 FROM system_settings WHERE key = $1', [SMTP_PASSWORD_KEY]);
    return (result.rowCount ?? 0) > 0;
  }

  private upsert(key: string, value: unknown) {
    return this.database.query(
      `INSERT INTO system_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [key, JSON.stringify(value)],
    );
  }
}
