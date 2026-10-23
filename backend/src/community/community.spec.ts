import 'reflect-metadata';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { slugify, type Viewer } from './community.utils.js';
import { DiscussionsController } from './discussions.controller.js';
import { DiscussionsRepository, type DiscussionRecord } from './discussions.repository.js';
import { DiscussionsService } from './discussions.service.js';
import { CommentInputDto, DiscussionInputDto } from './dto/discussions.dto.js';
import { NewsInputDto } from './dto/news.dto.js';
import { PaginationQueryDto } from './dto/pagination.dto.js';
import { AdminNewsController, NewsController } from './news.controller.js';
import { NewsRepository } from './news.repository.js';
import { NewsService } from './news.service.js';

const guardsOf = (target: object, method?: string) =>
  (Reflect.getMetadata('__guards__', method ? (target as Record<string, object>)[method] : target) ?? []) as unknown[];

async function errorsOf<T extends object>(cls: new () => T, input: object) {
  return validate(plainToInstance(cls, input));
}

describe('slugify', () => {
  it('removes Vietnamese diacritics and normalises separators', () => {
    expect(slugify('Chào mừng bạn đến với UTH Online Judge!')).toBe('chao-mung-ban-den-voi-uth-online-judge');
    expect(slugify('  Đề thi -- Lập trình  ')).toBe('de-thi-lap-trinh');
    expect(slugify('???')).toBe('');
  });
});

describe('community DTO validation', () => {
  const news = { title: 'Tiêu đề', category: 'Thông báo', summary: 'Tóm tắt', content: '# Nội dung' };

  it('accepts a valid news article and trims / strips NUL characters', async () => {
    const dto = plainToInstance(NewsInputDto, { ...news, title: '  Tiêu\u0000 đề  ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.title).toBe('Tiêu đề');
  });

  it('rejects invalid slugs, empty content and oversized fields with Vietnamese messages', async () => {
    const errors = await errorsOf(NewsInputDto, { ...news, slug: 'Sai Slug!', content: '', category: 'x'.repeat(51) });
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    expect(messages.join(' ')).toContain('Đường dẫn chỉ gồm');
    expect(messages.join(' ')).toContain('Nội dung phải từ 1 đến 50.000 ký tự.');
    expect(messages.join(' ')).toContain('Danh mục phải từ 1 đến 50 ký tự.');
  });

  it('validates discussions, comments and page size', async () => {
    expect(await errorsOf(DiscussionInputDto, { title: 'abc', content: 'ok' })).not.toHaveLength(0);
    expect(await errorsOf(DiscussionInputDto, { title: 'Câu hỏi hay', content: 'ok' })).toHaveLength(0);
    expect(await errorsOf(CommentInputDto, { content: '   ' })).not.toHaveLength(0);
    expect(await errorsOf(PaginationQueryDto, { pageSize: '51' })).not.toHaveLength(0);
    expect(await errorsOf(PaginationQueryDto, { page: '0' })).not.toHaveLength(0);
  });
});

describe('NewsRepository', () => {
  const makeRepository = (rows: unknown[] = [], total = 0) => {
    const query = vi.fn().mockImplementation((sql: string) =>
      Promise.resolve(/COUNT\(\*\)/.test(sql) ? { rows: [{ total }] } : { rows, rowCount: rows.length }),
    );
    return { query, repository: new NewsRepository({ query } as never) };
  };

  it('public listing only reads PUBLISHED rows, newest first, with server-side pagination', async () => {
    const { query, repository } = makeRepository([{ id: 'n1' }], 25);
    const page = await repository.listPublished({ page: 3, pageSize: 10, q: '50%_off' });

    expect(page).toMatchObject({ total: 25, page: 3, pageSize: 10 });
    const [listSql, listParams] = query.mock.calls.find(([sql]) => !/COUNT\(\*\)/.test(sql as string)) as [string, unknown[]];
    expect(listSql).toContain("n.status = 'PUBLISHED'");
    expect(listSql).toMatch(/ORDER BY n\.published_at DESC, n\.id DESC/);
    expect(listParams).toEqual(['%50\\%\\_off%', 10, 20]);
    const [countSql] = query.mock.calls.find(([sql]) => /COUNT\(\*\)/.test(sql as string)) as [string];
    expect(countSql).toContain("n.status = 'PUBLISHED'");
  });

  it('public detail by slug excludes drafts and never selects it without the status filter', async () => {
    const { query, repository } = makeRepository([]);
    expect(await repository.findPublishedBySlug('ban-nhap')).toBeNull();
    expect(query.mock.calls[0][0]).toContain("n.status = 'PUBLISHED'");
    expect(query.mock.calls[0][1]).toEqual(['ban-nhap']);
  });

  it('creates articles as DRAFT and maps duplicate slugs to a conflict', async () => {
    const { query, repository } = makeRepository([{ id: 'new' }]);
    await repository.create('admin-1', { title: 't', slug: 's', category: 'c', summary: 'x', content: 'y' });
    expect(query.mock.calls[0][0]).toContain("'DRAFT'");
    expect(query.mock.calls[0][1]).toEqual(['t', 's', 'x', 'y', 'c', 'admin-1']);

    const failing = new NewsRepository({ query: vi.fn().mockRejectedValue({ code: '23505' }) } as never);
    await expect(
      failing.create('admin-1', { title: 't', slug: 's', category: 'c', summary: 'x', content: 'y' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps the first publication date when publishing', async () => {
    const { query, repository } = makeRepository([]);
    await repository.setStatus('id-1', 'PUBLISHED');
    expect(query.mock.calls[0][0]).toContain('COALESCE(published_at, NOW())');
  });
});

describe('NewsService', () => {
  it('returns 404 for draft, missing or unpublished slugs', async () => {
    const service = new NewsService({ findPublishedBySlug: vi.fn().mockResolvedValue(null) } as never);
    await expect(service.getPublished('draft')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ignores any status filter on the public list', async () => {
    const listPublished = vi.fn().mockResolvedValue({ items: [] });
    const service = new NewsService({ listPublished } as never);
    await service.listPublished({ page: 1, pageSize: 5, status: 'DRAFT' } as never);
    expect(listPublished).toHaveBeenCalledWith({ page: 1, pageSize: 5, q: undefined });
  });

  it('generates a slug from the title when none is given and reports missing rows', async () => {
    const create = vi.fn().mockResolvedValue('id-1');
    const findById = vi.fn().mockResolvedValue({ id: 'id-1' });
    const service = new NewsService({ create, findById } as never);
    await service.create('admin-1', { title: 'Tin mới nhất', category: 'c', summary: 's', content: 'x' });
    expect(create.mock.calls[0][1].slug).toBe('tin-moi-nhat');

    const missing = new NewsService({ update: vi.fn().mockResolvedValue(false) } as never);
    await expect(
      missing.update('id', { title: 'abc', category: 'c', summary: 's', content: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('access control metadata', () => {
  it('public news endpoints have no guard, admin news endpoints require JWT + ADMIN role', () => {
    expect(guardsOf(NewsController)).toEqual([]);
    expect(guardsOf(NewsController.prototype, 'list')).toEqual([]);
    expect(guardsOf(NewsController.prototype, 'get')).toEqual([]);
    expect(guardsOf(AdminNewsController)).toEqual([JwtAuthGuard, AdminRoleGuard]);
  });

  it('discussion reads are public and every write requires authentication', () => {
    const proto = DiscussionsController.prototype;
    expect(guardsOf(proto, 'list')).toEqual([]);
    expect(guardsOf(proto, 'get')).toEqual([OptionalJwtAuthGuard]);
    expect(guardsOf(proto, 'listComments')).toEqual([OptionalJwtAuthGuard]);
    for (const method of ['create', 'update', 'remove', 'addComment', 'editComment', 'removeComment']) {
      expect(guardsOf(proto, method)).toEqual([JwtAuthGuard]);
    }
    expect(guardsOf(proto, 'lock')).toEqual([JwtAuthGuard, AdminRoleGuard]);
  });

  it('AdminRoleGuard rejects non-admin users', () => {
    const context = (user: unknown) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as never;
    expect(() => new AdminRoleGuard().canActivate(context({ id: 'u', role: 'STUDENT' }))).toThrow(ForbiddenException);
    expect(() => new AdminRoleGuard().canActivate(context(undefined))).toThrow(ForbiddenException);
    expect(new AdminRoleGuard().canActivate(context({ id: 'a', role: 'ADMIN' }))).toBe(true);
  });
});

describe('DiscussionsRepository', () => {
  it('lists newest first with a deterministic tiebreak and offset pagination', async () => {
    const query = vi.fn().mockImplementation((sql: string) =>
      Promise.resolve(/COUNT\(\*\)/.test(sql) && !/replies/.test(sql) ? { rows: [{ total: 7 }] } : { rows: [] }),
    );
    const repository = new DiscussionsRepository({ query } as never);
    const page = await repository.list({ page: 2, pageSize: 3 });

    expect(page).toMatchObject({ total: 7, page: 2, pageSize: 3 });
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/ORDER BY d\.created_at DESC, d\.id DESC/);
    expect(params).toEqual([null, 3, 3]);
  });

  it('never selects sensitive user columns', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new DiscussionsRepository({ query } as never);
    await repository.list({ page: 1, pageSize: 5 });
    await repository.findById('id');
    await repository.listComments('id', { page: 1, pageSize: 5 });
    for (const [sql] of query.mock.calls as [string][]) {
      expect(sql).not.toMatch(/email|password_hash|google_id|github_id/);
    }
  });
});

describe('DiscussionsService ownership and moderation', () => {
  const owner: Viewer = { id: 'owner', role: 'STUDENT' };
  const other: Viewer = { id: 'other', role: 'STUDENT' };
  const admin: Viewer = { id: 'admin', role: 'ADMIN' };
  const record = (patch: Partial<DiscussionRecord> = {}): DiscussionRecord => ({
    id: 'd1', title: 't', content: 'c', authorId: 'owner', authorName: 'owner', createdAt: '', updatedAt: '',
    replies: 0, isLocked: false, hasOthersComments: false, ...patch,
  });
  const build = (discussion: DiscussionRecord | null, comment: object | null = null) => {
    const repository = {
      findById: vi.fn().mockResolvedValue(discussion),
      findComment: vi.fn().mockResolvedValue(comment),
      update: vi.fn(), delete: vi.fn(), create: vi.fn().mockResolvedValue('d1'),
      createComment: vi.fn(), updateComment: vi.fn(), deleteComment: vi.fn(),
      setLocked: vi.fn().mockResolvedValue(true),
      listComments: vi.fn().mockResolvedValue({
        items: [{ id: 'c1', authorId: 'owner', authorName: 'owner', content: 'x', discussionId: 'd1', createdAt: '', updatedAt: '' }],
        total: 1, page: 1, pageSize: 10,
      }),
    };
    return { repository, service: new DiscussionsService(repository as never) };
  };

  it('only the author can edit, and never when locked', async () => {
    const { repository, service } = build(record());
    await service.update('d1', owner, 'Tiêu đề mới', 'nd');
    expect(repository.update).toHaveBeenCalledWith('d1', 'Tiêu đề mới', 'nd');
    await expect(service.update('d1', other, 'abcde', 'x')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.update('d1', admin, 'abcde', 'x')).rejects.toBeInstanceOf(ForbiddenException);

    const locked = build(record({ isLocked: true }));
    await expect(locked.service.update('d1', owner, 'abcde', 'x')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('author may delete only without replies from others; admin may always moderate', async () => {
    const quiet = build(record());
    await quiet.service.remove('d1', owner);
    expect(quiet.repository.delete).toHaveBeenCalled();

    const busy = build(record({ hasOthersComments: true }));
    await expect(busy.service.remove('d1', owner)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(busy.service.remove('d1', other)).rejects.toBeInstanceOf(ForbiddenException);
    await busy.service.remove('d1', admin);
    expect(busy.repository.delete).toHaveBeenCalledWith('d1');
  });

  it('exposes capability flags without leaking the author id', async () => {
    const { service } = build(record());
    const view = await service.get('d1', owner);
    expect(view).toMatchObject({ canEdit: true, canDelete: true, canModerate: false });
    expect(view).not.toHaveProperty('authorId');
    expect(await service.get('d1', null)).toMatchObject({ canEdit: false, canDelete: false, canModerate: false });
    expect(await service.get('d1', admin)).toMatchObject({ canEdit: false, canDelete: true, canModerate: true });
  });

  it('blocks comments on locked threads and missing discussions', async () => {
    const { repository, service } = build(record());
    await service.addComment('d1', other, 'Xin chào');
    expect(repository.createComment).toHaveBeenCalledWith('d1', 'other', 'Xin chào');

    const locked = build(record({ isLocked: true }));
    await expect(locked.service.addComment('d1', other, 'x')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build(null).service.addComment('d1', other, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('comment edit is author-only, comment delete is author or admin', async () => {
    const comment = { id: 'c1', authorId: 'owner', isLocked: false };
    const { repository, service } = build(record(), comment);
    await service.editComment('c1', owner, 'sửa');
    expect(repository.updateComment).toHaveBeenCalledWith('c1', 'sửa');
    await expect(service.editComment('c1', admin, 'x')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.removeComment('c1', other)).rejects.toBeInstanceOf(ForbiddenException);
    await service.removeComment('c1', admin);
    await service.removeComment('c1', owner);
    expect(repository.deleteComment).toHaveBeenCalledTimes(2);
    await expect(build(record(), null).service.removeComment('c1', owner)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('comment list flags are computed per viewer', async () => {
    const { service } = build(record());
    const mine = await service.listComments('d1', owner, { page: 1, pageSize: 10 });
    expect(mine.items[0]).toMatchObject({ canEdit: true, canDelete: true });
    expect(mine.items[0]).not.toHaveProperty('authorId');
    const guest = await service.listComments('d1', null, { page: 1, pageSize: 10 });
    expect(guest.items[0]).toMatchObject({ canEdit: false, canDelete: false });
  });

  it('only creates discussions for the authenticated viewer id', async () => {
    const { repository, service } = build(record());
    await service.create(owner, 'Tiêu đề hay', 'nội dung');
    expect(repository.create).toHaveBeenCalledWith('owner', 'Tiêu đề hay', 'nội dung');
  });
});
