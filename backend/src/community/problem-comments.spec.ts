import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateCommentDto } from './dto/discussions.dto.js';
import { ProblemCommentsController } from './problem-comments.controller.js';
import { ProblemCommentsService } from './problem-comments.service.js';

const student = { id: 'u1', role: 'STUDENT' } as const;
const other = { id: 'u2', role: 'STUDENT' } as const;
const admin = { id: 'a1', role: 'ADMIN' } as const;

const record = (id: string, patch: object = {}) => ({
  id, problemId: 'p1', parentId: null, authorId: 'u1', authorName: 'u1', content: 'x',
  isDeleted: false, createdAt: '', updatedAt: '', ...patch,
});
const lookup = (patch: object = {}) => ({ id: 'c1', authorId: 'u1', problemId: 'p1', parentId: null, isDeleted: false, ...patch });

const build = (found: object | null = lookup(), problemId: string | null = 'p1') => {
  const repository = {
    findPublishedProblemId: vi.fn().mockResolvedValue(problemId),
    findComment: vi.fn().mockResolvedValue(found),
    createComment: vi.fn().mockResolvedValue('new'),
    listComments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 }),
    listReplies: vi.fn().mockResolvedValue([]),
    reactionSummaries: vi.fn().mockResolvedValue(new Map()),
    setReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    updateComment: vi.fn().mockResolvedValue(undefined),
    deleteComment: vi.fn().mockResolvedValue(undefined),
  };
  return { repository, service: new ProblemCommentsService(repository as never) };
};

describe('problem comments service', () => {
  it('lists comments of the requested problem only, with nested replies and permissions', async () => {
    const { service, repository } = build();
    repository.listComments.mockResolvedValue({ items: [record('c1')], total: 1, page: 1, pageSize: 10 });
    repository.listReplies.mockResolvedValue([record('c2', { parentId: 'c1', authorId: 'u2' })]);
    const result = await service.listComments('khobau', student, { page: 1, pageSize: 10 });
    expect(repository.listComments).toHaveBeenCalledWith('p1', { page: 1, pageSize: 10 });
    expect(repository.listReplies).toHaveBeenCalledWith(['c1']);
    expect(result.items[0].replies[0].id).toBe('c2');
    expect(result.items[0].canEdit).toBe(true);
    expect(result.items[0].replies[0].canEdit).toBe(false);
    expect(result.items[0]).not.toHaveProperty('authorId');
  });

  it('gives guests read-only permissions and masks deleted comments', async () => {
    const { service, repository } = build();
    repository.listComments.mockResolvedValue({
      items: [record('c1', { isDeleted: true }), record('c3')], total: 2, page: 1, pageSize: 10,
    });
    const result = await service.listComments('khobau', null, { page: 1, pageSize: 10 });
    expect(result.items[0]).toMatchObject({ content: '', authorName: 'Người dùng đã xóa', canDelete: false });
    expect(result.items[1]).toMatchObject({ canEdit: false, canDelete: false });
  });

  it('rejects a missing or unpublished problem', async () => {
    const { service } = build(lookup(), null);
    await expect(service.listComments('nope', null, { page: 1, pageSize: 10 })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.addComment('nope', student, 'hi')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a comment with the authenticated user id', async () => {
    const { service, repository } = build();
    await service.addComment('khobau', student, 'hello');
    expect(repository.createComment).toHaveBeenCalledWith('p1', 'u1', 'hello', null);
  });

  it('creates a reply to a comment of the same problem', async () => {
    const { service, repository } = build();
    await service.addComment('khobau', student, 'reply', 'c1');
    expect(repository.createComment).toHaveBeenCalledWith('p1', 'u1', 'reply', 'c1');
  });

  it('rejects replies to a comment of another problem, a deleted or a missing comment', async () => {
    await expect(build(lookup({ problemId: 'p2' })).service.addComment('khobau', student, 'x', 'c1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(build(lookup({ isDeleted: true })).service.addComment('khobau', student, 'x', 'c1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(build(null).service.addComment('khobau', student, 'x', 'c1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets only the author edit', async () => {
    const { service, repository } = build();
    await service.editComment('c1', student, 'new');
    expect(repository.updateComment).toHaveBeenCalledWith('c1', 'new');
    await expect(service.editComment('c1', other, 'x')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.editComment('c1', admin, 'x')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets the author or an admin delete, not others', async () => {
    const { service, repository } = build();
    await service.removeComment('c1', student);
    await service.removeComment('c1', admin);
    expect(repository.deleteComment).toHaveBeenCalledTimes(2);
    await expect(service.removeComment('c1', other)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sets and removes reactions for the authenticated viewer', async () => {
    const { service, repository } = build();
    await service.setReaction('c1', other, 'LOVE');
    await service.removeReaction('c1', other);
    expect(repository.setReaction).toHaveBeenCalledWith('c1', 'u2', 'LOVE');
    expect(repository.removeReaction).toHaveBeenCalledWith('c1', 'u2');
  });

  it('rejects writes on a missing or deleted comment', async () => {
    await expect(build(null).service.setReaction('c1', student, 'LIKE')).rejects.toBeInstanceOf(NotFoundException);
    await expect(build(lookup({ isDeleted: true })).service.editComment('c1', student, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('problem comments validation and guards', () => {
  it('rejects empty and over-long content, accepts a valid one', async () => {
    expect(await validate(plainToInstance(CreateCommentDto, { content: '   ' }))).toHaveLength(1);
    expect(await validate(plainToInstance(CreateCommentDto, { content: 'a'.repeat(5001) }))).toHaveLength(1);
    expect(await validate(plainToInstance(CreateCommentDto, { content: 'ok' }))).toHaveLength(0);
  });

  it('requires JwtAuthGuard on every write route but not on listing', () => {
    for (const name of ['add', 'setReaction', 'removeReaction', 'edit', 'remove'] as const) {
      const guards = Reflect.getMetadata('__guards__', ProblemCommentsController.prototype[name]);
      expect(guards).toContain(JwtAuthGuard);
    }
    const listGuards = Reflect.getMetadata('__guards__', ProblemCommentsController.prototype.list);
    expect(listGuards).not.toContain(JwtAuthGuard);
  });
});

describe('migration 022', () => {
  const sql = readFileSync(new URL('../../sql/migrations/022_problem_comments.sql', import.meta.url), 'utf8');

  it('is additive and does not touch discussion tables', () => {
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
    expect(sql).not.toMatch(/ALTER TABLE[^;]*discussion/i);
  });

  it('keeps replies in the same problem and prevents duplicate reactions', () => {
    expect(sql).toMatch(/FOREIGN KEY \(parent_id, problem_id\)[\s\S]*?\(id, problem_id\)/);
    expect(sql).toMatch(/UNIQUE INDEX IF NOT EXISTS uq_problem_comment_reactions_user_comment[\s\S]*?\(user_id, comment_id\)/);
    expect(sql).toMatch(/reaction_type IN \('LIKE', 'LOVE', 'HELPFUL'\)/);
  });
});
