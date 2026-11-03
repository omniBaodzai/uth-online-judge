import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

export type UserRecord = {
  id: string;
  username: string | null;
  email: string;
  password_hash: string | null;
  full_name: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  cover_crop: CoverCropMetadata | null;
  bio: string | null;
  organization: string | null;
  is_active: boolean;
  auth_version: number;
  role: 'STUDENT' | 'ADMIN';
  created_at: Date;
  updated_at: Date;
};

export type CoverCropMetadata = {
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  aspect: number;
};

export type AuthenticatedUser = Omit<UserRecord, 'password_hash'>;
export type PublicUser = Omit<UserRecord, 'password_hash' | 'auth_version'>;

export type PasswordCredential = {
  password_hash: string | null;
  is_active: boolean;
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly database: Pool,
  ) {}

  async findByIdentifier(identifier: string): Promise<UserRecord | null> {
    const result = await this.database.query<UserRecord>(
      `SELECT id, username, email, password_hash, full_name, avatar_url,
              cover_image_url, cover_crop, bio, organization,
              is_active, auth_version, role, created_at, updated_at
       FROM users
       WHERE lower(email) = $1 OR lower(username) = $1
       LIMIT 1`,
      [identifier],
    );

    return result.rows[0] ?? null;
  }

  async findByGoogleId(googleId: string): Promise<AuthenticatedUser | null> {
    const result = await this.database.query<AuthenticatedUser>(
      `SELECT id, username, email, full_name, avatar_url, cover_image_url, cover_crop, bio, organization,
              is_active, auth_version, role, created_at, updated_at
       FROM users
       WHERE google_id = $1
       LIMIT 1`,
      [googleId],
    );

    return result.rows[0] ?? null;
  }

  async findByGitHubId(githubId: string): Promise<AuthenticatedUser | null> {
    const result = await this.database.query<AuthenticatedUser>(
      `SELECT id, username, email, full_name, avatar_url, cover_image_url, cover_crop, bio, organization,
              is_active, auth_version, role, created_at, updated_at
       FROM users
       WHERE github_id = $1
       LIMIT 1`,
      [githubId],
    );

    return result.rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<AuthenticatedUser | null> {
    const result = await this.database.query<AuthenticatedUser>(
      `SELECT id, username, email, full_name, avatar_url, cover_image_url, cover_crop, bio, organization,
              is_active, auth_version, role, created_at, updated_at
       FROM users
       WHERE lower(email) = $1
       LIMIT 1`,
      [email],
    );

    return result.rows[0] ?? null;
  }

  async createGoogleAccount(input: {
    username: string;
    email: string;
    googleId: string;
    fullName: string | null;
  }): Promise<AuthenticatedUser> {
    const result = await this.database.query<AuthenticatedUser>(
      `INSERT INTO users (username, email, password_hash, full_name, google_id)
       VALUES ($1, $2, NULL, $3, $4)
       RETURNING id, username, email, full_name, avatar_url, cover_image_url, cover_crop, bio, organization,
                 is_active, auth_version, role, created_at, updated_at`,
      [input.username, input.email, input.fullName, input.googleId],
    );

    const user = result.rows[0];
    if (!user) {
      throw new Error('Google user insert did not return a row');
    }

    return user;
  }

  async createGitHubAccount(input: {
    username: string;
    email: string;
    githubId: string;
    fullName: string | null;
  }): Promise<AuthenticatedUser> {
    const result = await this.database.query<AuthenticatedUser>(
      `INSERT INTO users (username, email, password_hash, full_name, github_id)
       VALUES ($1, $2, NULL, $3, $4)
       RETURNING id, username, email, full_name, avatar_url, cover_image_url, cover_crop, bio, organization,
                 is_active, auth_version, role, created_at, updated_at`,
      [input.username, input.email, input.fullName, input.githubId],
    );

    const user = result.rows[0];
    if (!user) {
      throw new Error('GitHub user insert did not return a row');
    }

    return user;
  }

  async findById(id: string): Promise<AuthenticatedUser | null> {
    const result = await this.database.query<AuthenticatedUser>(
      `SELECT id, username, email, full_name, avatar_url, cover_image_url, cover_crop, bio, organization,
              is_active, auth_version, role, created_at, updated_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    return result.rows[0] ?? null;
  }

  async findPasswordCredential(id: string): Promise<PasswordCredential | null> {
    const result = await this.database.query<PasswordCredential>(
      `SELECT password_hash, is_active
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    return result.rows[0] ?? null;
  }

  async updatePassword(
    id: string,
    currentPasswordHash: string,
    nextPasswordHash: string,
  ): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE users
       SET password_hash = $3,
           auth_version = auth_version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND password_hash = $2
         AND is_active = TRUE
       RETURNING id`,
      [id, currentPasswordHash, nextPasswordHash],
    );

    return result.rowCount === 1;
  }

  async create(input: {
    username: string;
    email: string;
    passwordHash: string;
  }): Promise<AuthenticatedUser> {
    const result = await this.database.query<AuthenticatedUser>(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
      RETURNING id, username, email, full_name, avatar_url, cover_image_url, cover_crop, bio, organization,
                 auth_version,
                 is_active, role, created_at, updated_at`,
      [input.username, input.email, input.passwordHash],
    );

    const user = result.rows[0];
    if (!user) {
      throw new Error('User insert did not return a row');
    }

    return user;
  }

  async updateProfile(
    id: string,
    input: {
      fullName?: string | null;
      avatarUrl?: string | null;
      coverImageUrl?: string | null;
      coverCrop?: CoverCropMetadata | null;
      bio?: string | null;
      organization?: string | null;
    },
  ): Promise<PublicUser | null> {
    const updateFullName = input.fullName !== undefined;
    const updateAvatarUrl = input.avatarUrl !== undefined;
    const updateCoverImageUrl = input.coverImageUrl !== undefined;
    const updateCoverCrop =
      input.coverCrop !== undefined || updateCoverImageUrl;
    const updateBio = input.bio !== undefined;
    const updateOrganization = input.organization !== undefined;
    const result = await this.database.query<PublicUser>(
      `UPDATE users
       SET full_name = CASE WHEN $2 THEN $3 ELSE full_name END,
           avatar_url = CASE WHEN $4 THEN $5 ELSE avatar_url END,
           cover_image_url = CASE WHEN $6 THEN $7 ELSE cover_image_url END,
           cover_crop = CASE WHEN $8 THEN $9::jsonb ELSE cover_crop END,
           bio = CASE WHEN $10 THEN $11 ELSE bio END,
           organization = CASE WHEN $12 THEN $13 ELSE organization END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, username, email, full_name, avatar_url, cover_image_url, cover_crop, bio, organization,
                 is_active, role, created_at, updated_at`,
      [
        id,
        updateFullName,
        updateFullName ? (input.fullName?.trim() ?? null) : null,
        updateAvatarUrl,
        updateAvatarUrl ? (input.avatarUrl?.trim() ?? null) : null,
        updateCoverImageUrl,
        updateCoverImageUrl ? (input.coverImageUrl?.trim() ?? null) : null,
        updateCoverCrop,
        input.coverCrop ? JSON.stringify(input.coverCrop) : null,
        updateBio,
        updateBio ? (input.bio?.trim() ?? null) : null,
        updateOrganization,
        updateOrganization ? (input.organization?.trim() ?? null) : null,
      ],
    );

    return result.rows[0] ?? null;
  }
}
