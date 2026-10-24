import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { DiscussionsController } from './discussions.controller.js';
import { DiscussionsService } from './discussions.service.js';
import { CreateCommentDto, ReactionInputDto } from './dto/discussions.dto.js';
import { emptyReactionSummary } from './reactions.repository.js';

const student = { id: 'u1', role: 'STUDENT' } as const;
const admin = { id: 'a1', role: 'ADMIN' } as const;
const discussion = { id: 'd1', authorId: 'u1', isLocked: false, hasOthersComments: false };
const lookup = (patch: object = {}) => ({
  id: 'c1', authorId: 'u1', discussionId: 'd1', parentId: null, isDeleted: false, isLocked: false, ...patch,
});
const comment = (id: string, patch: object = {}) => ({
  id, authorId: 'u1', authorName: 'u1', content: 'x', discussionId: 'd1', parentId: null,
  isDeleted: false, createdAt: '', updatedAt: '', ...patch,
});

const build = (found: object | null = lookup(), target: object | null = discussion) => {
  const repository = {
    findById: vi.fn().mockResolvedValue(target),
    findComment: vi.fn().mockResolvedValue(found),
    createComment: vi.fn().mockResolvedValue('new'),
    listComments: vi.fn(),
    listReplies: vi.fn().mockResolvedValue([]),
  };
  const summary = { counts: { LIKE: 1, LOVE: 0, HELPFUL: 0 }, mine: 'LIKE' };
  const reactions = {
    summaries: vi.fn().mockResolvedValue(new Map([['c1', summary]])),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  return { repository, reactions, service: new DiscussionsService(repository as never, reactions as never) };
};

describe('reactions', () => {
  it('sets a reaction for the authenticated viewer and returns the summary', async () => {
    const { service, reactions } = build();
    const result = await service.setReaction('COMMENT', 'c1', student, 'LIKE');
    expect(reactions.set).toHaveBeenCalledWith('COMMENT', 'c1', 'u1', 'LIKE');
    expect(result.mine).toBe('LIKE');
  });

  it('changes and removes a reaction', async () => {
    const { service, reactions } = build();
    await service.setReaction('DISCUSSION', 'd1', student, 'LOVE');
    await service.removeReaction('DISCUSSION', 'd1', student);
    expect(reactions.set).toHaveBeenCalledWith('DISCUSSION', 'd1', 'u1', 'LOVE');
    expect(reactions.remove).toHaveBeenCalledWith('DISCUSSION', 'd1', 'u1');
  });

  it('allows reactions on a locked discussion', async () => {
    const { service } = build(lookup({ isLocked: true }), { ...discussion, isLocked: true });
    await expect(service.setReaction('DISCUSSION', 'd1', student, 'LIKE')).resolves.toBeDefined();
  });

  it('rejects a missing or deleted target', async () => {
    await expect(build(null).service.setReaction('COMMENT', 'c1', student, 'LIKE')).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      build(lookup({ isDeleted: true })).service.setReaction('COMMENT', 'c1', student, 'LIKE'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(build(lookup(), null).service.setReaction('DISCUSSION', 'd1', student, 'LIKE')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('validates the reaction type', async () => {
    const bad = plainToInstance(ReactionInputDto, { type: 'HATE' });
    const good = plainToInstance(ReactionInputDto, { type: 'HELPFUL' });
    expect(await validate(bad)).toHaveLength(1);
    expect(await validate(good)).toHaveLength(0);
  });

  it('requires JwtAuthGuard on every reaction route', () => {
    for (const name of ['setDiscussionReaction', 'removeDiscussionReaction', 'setCommentReaction', 'removeCommentReaction']) {
      const guards = Reflect.getMetadata('__guards__', DiscussionsController.prototype[name as keyof DiscussionsController]);
      expect(guards, name).toContain(JwtAuthGuard);
    }
  });
});

describe('replies', () => {
  it('creates a reply to a top-level comment', async () => {
    const { service, repository } = build();
    await service.addComment('d1', student, 'ok', 'c1');
    expect(repository.createComment).toHaveBeenCalledWith('d1', 'u1', 'ok', 'c1');
  });

  it('rejects replying to a reply', async () => {
    const { service } = build(lookup({ parentId: 'root' }));
    await expect(service.addComment('d1', student, 'ok', 'c1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a parent from another discussion', async () => {
    const { service } = build(lookup({ discussionId: 'other' }));
    await expect(service.addComment('d1', student, 'ok', 'c1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing or deleted parent', async () => {
    await expect(build(null).service.addComment('d1', student, 'ok', 'c1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      build(lookup({ isDeleted: true })).service.addComment('d1', student, 'ok', 'c1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects replies on a locked discussion', async () => {
    const { service } = build(lookup(), { ...discussion, isLocked: true });
    await expect(service.addComment('d1', student, 'ok', 'c1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates parentId as a UUID', async () => {
    expect(await validate(plainToInstance(CreateCommentDto, { content: 'a', parentId: 'nope' }))).toHaveLength(1);
    expect(await validate(plainToInstance(CreateCommentDto, { content: 'a' }))).toHaveLength(0);
  });

  it('nests replies, hides deleted content and computes permissions', async () => {
    const { service, repository, reactions } = build();
    repository.listComments.mockResolvedValue({
      items: [comment('c1'), comment('c2', { isDeleted: true, content: '' })],
      total: 2, page: 1, pageSize: 10,
    });
    repository.listReplies.mockResolvedValue([comment('r1', { parentId: 'c1', authorId: 'u2' })]);
    const page = await service.listComments('d1', admin, { page: 1, pageSize: 10 } as never);
    const [first, deleted] = page.items;
    expect(first.replies.map((r) => r.id)).toEqual(['r1']);
    expect(first.replies[0].canDelete).toBe(true);
    expect(first.reactions.mine).toBe('LIKE');
    expect(deleted.content).toBe('');
    expect(deleted.canEdit).toBe(false);
    expect(deleted.canDelete).toBe(false);
    expect(deleted.reactions).toEqual(emptyReactionSummary());
    expect(reactions.summaries).toHaveBeenCalledWith('COMMENT', ['c1', 'r1'], 'a1');
  });

  it('treats a deleted comment as missing for edit', async () => {
    const { service } = build(lookup({ isDeleted: true }));
    await expect(service.editComment('c1', student, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
