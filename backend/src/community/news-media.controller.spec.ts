import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AdminNewsMediaController, NewsMediaController } from './news-media.controller.js';

describe('news media controller access', () => {
  it('requires an authenticated administrator for uploads and private media', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminNewsMediaController)).toEqual([
      JwtAuthGuard,
      AdminRoleGuard,
    ]);
    expect(Reflect.getMetadata(PATH_METADATA, AdminNewsMediaController)).toBe('admin/news/media');
  });

  it('keeps the public media route separate from the protected admin route', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, NewsMediaController)).toBeUndefined();
    expect(Reflect.getMetadata(PATH_METADATA, NewsMediaController)).toBe('news/media');
  });
});
