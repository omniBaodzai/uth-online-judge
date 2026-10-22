import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

const DEFAULT_ADMIN_EMAIL = 'admin@system.com';
const DEFAULT_ADMIN_USERNAME = 'admin';
// Mật khẩu mẫu chỉ dùng cho môi trường phát triển; production phải đặt ADMIN_DEFAULT_PASSWORD.
const SAMPLE_PASSWORD = 'Admin@12345';
const BCRYPT_COST = 12;

@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seedAdmin();
    } catch (error) {
      this.logger.error(
        `Không thể khởi tạo tài khoản admin (đã chạy 005_admin.sql chưa?): ${(error as Error).message}`,
      );
    }
  }

  private async seedAdmin(): Promise<void> {
    const email = (process.env.ADMIN_DEFAULT_EMAIL ?? DEFAULT_ADMIN_EMAIL).toLowerCase();
    const existing = await this.database.query<{ id: string; role: string }>(
      'SELECT id, role FROM users WHERE lower(email) = $1',
      [email],
    );

    if (existing.rows[0]) {
      // Không đổi mật khẩu của tài khoản đã tồn tại; chỉ bảo đảm vai trò ADMIN.
      if (existing.rows[0].role !== 'ADMIN') {
        await this.database.query("UPDATE users SET role = 'ADMIN', is_active = TRUE WHERE id = $1", [existing.rows[0].id]);
        this.logger.warn(`Đã nâng ${email} lên ADMIN.`);
      }
      return;
    }

    let password = process.env.ADMIN_DEFAULT_PASSWORD;
    let generated = false;
    if (!password) {
      if (process.env.NODE_ENV === 'production') {
        password = randomBytes(12).toString('base64url');
        generated = true;
      } else {
        password = SAMPLE_PASSWORD;
      }
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    await this.database.query(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'Quản trị viên hệ thống', 'ADMIN')
       ON CONFLICT DO NOTHING`,
      [DEFAULT_ADMIN_USERNAME, email, passwordHash],
    );

    this.logger.warn(
      generated
        ? `Đã tạo tài khoản admin ${email} với mật khẩu ngẫu nhiên (chỉ hiển thị một lần): ${password}`
        : `Đã tạo tài khoản admin mặc định ${email}. Hãy đổi mật khẩu ngay sau lần đăng nhập đầu tiên.`,
    );
  }
}
