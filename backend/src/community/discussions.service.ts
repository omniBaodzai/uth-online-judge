import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PageResult, Viewer } from './community.utils.js';
import {
  DiscussionsRepository,
  type CommentRecord,
  type DiscussionListItem,
  type DiscussionRecord,
  type PageQuery,
} from './discussions.repository.js';
import {
  ReactionsRepository,
  emptyReactionSummary,
  type ReactionSummary,
  type ReactionTarget,
  type ReactionType,
} from './reactions.repository.js';

const DISCUSSION_NOT_FOUND = 'Không tìm thấy chủ đề thảo luận.';
const COMMENT_NOT_FOUND = 'Không tìm thấy bình luận.';
const LOCKED = 'Chủ đề này đã bị khóa nên không thể chỉnh sửa hoặc bình luận thêm.';

export type DiscussionView = Omit<DiscussionRecord, 'authorId' | 'hasOthersComments'> & {
  reactions: ReactionSummary;
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
};

export type CommentView = Omit<CommentRecord, 'authorId'> & {
  reactions: ReactionSummary;
  // Chỉ bình luận gốc mới có phản hồi (một cấp); phản hồi luôn có mảng rỗng.
  replies: CommentView[];
  canEdit: boolean;
  canDelete: boolean;
};

export function canDeleteDiscussion(viewer: Viewer | null, discussion: DiscussionRecord): boolean {
  if (!viewer) return false;
  if (viewer.role === 'ADMIN') return true;
  // Tác giả không được xóa khi đã có người khác tham gia thảo luận.
  return viewer.id === discussion.authorId && !discussion.hasOthersComments;
}

@Injectable()
export class DiscussionsService {
  constructor(
    private readonly discussions: DiscussionsRepository,
    private readonly reactions: ReactionsRepository,
  ) {}

  list(query: PageQuery): Promise<PageResult<DiscussionListItem>> {
    return this.discussions.list(query);
  }

  async get(id: string, viewer: Viewer | null): Promise<DiscussionView> {
    const discussion = await this.require(id);
    const summaries = await this.reactions.summaries('DISCUSSION', [id], viewer?.id ?? null);
    return this.toView(discussion, viewer, summaries.get(id) ?? emptyReactionSummary());
  }

  async create(viewer: Viewer, title: string, content: string): Promise<DiscussionView> {
    const id = await this.discussions.create(viewer.id, title, content);
    return this.get(id, viewer);
  }

  async update(id: string, viewer: Viewer, title: string, content: string): Promise<DiscussionView> {
    const discussion = await this.require(id);
    // Quản trị viên kiểm duyệt (xóa/khóa), không sửa hộ lời của người khác.
    if (discussion.authorId !== viewer.id) throw new ForbiddenException('Bạn chỉ có thể sửa chủ đề của mình.');
    if (discussion.isLocked) throw new ForbiddenException(LOCKED);
    await this.discussions.update(id, title, content);
    return this.get(id, viewer);
  }

  async remove(id: string, viewer: Viewer): Promise<void> {
    const discussion = await this.require(id);
    if (!canDeleteDiscussion(viewer, discussion)) {
      throw new ForbiddenException(
        discussion.authorId === viewer.id
          ? 'Chủ đề đã có bình luận của người khác nên không thể xóa. Hãy liên hệ quản trị viên.'
          : 'Bạn không có quyền xóa chủ đề này.',
      );
    }
    await this.discussions.delete(id);
  }

  async setLocked(id: string, viewer: Viewer, isLocked: boolean): Promise<DiscussionView> {
    if (!(await this.discussions.setLocked(id, isLocked))) throw new NotFoundException(DISCUSSION_NOT_FOUND);
    return this.get(id, viewer);
  }

  async listComments(id: string, viewer: Viewer | null, query: PageQuery): Promise<PageResult<CommentView>> {
    const discussion = await this.require(id);
    const page = await this.discussions.listComments(id, query);
    const replies = await this.discussions.listReplies(page.items.map((comment) => comment.id));
    const summaries = await this.reactions.summaries(
      'COMMENT',
      [...page.items, ...replies].filter((comment) => !comment.isDeleted).map((comment) => comment.id),
      viewer?.id ?? null,
    );
    const toView = (comment: CommentRecord, children: CommentRecord[]): CommentView =>
      this.toCommentView(comment, viewer, discussion.isLocked, summaries, children);

    return {
      ...page,
      items: page.items.map((comment) =>
        toView(comment, replies.filter((reply) => reply.parentId === comment.id)),
      ),
    };
  }

  async addComment(id: string, viewer: Viewer, content: string, parentId: string | null = null): Promise<void> {
    const discussion = await this.require(id);
    if (discussion.isLocked) throw new ForbiddenException(LOCKED);
    if (parentId) await this.assertCanReplyTo(id, parentId);
    await this.discussions.createComment(id, viewer.id, content, parentId);
  }

  async editComment(commentId: string, viewer: Viewer, content: string): Promise<void> {
    const comment = await this.requireComment(commentId);
    if (comment.authorId !== viewer.id) throw new ForbiddenException('Bạn chỉ có thể sửa bình luận của mình.');
    if (comment.isLocked) throw new ForbiddenException(LOCKED);
    await this.discussions.updateComment(commentId, content);
  }

  async removeComment(commentId: string, viewer: Viewer): Promise<void> {
    const comment = await this.requireComment(commentId);
    if (comment.authorId !== viewer.id && viewer.role !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền xóa bình luận này.');
    }
    await this.discussions.deleteComment(commentId);
  }

  // Người dùng lấy từ token; mọi người đăng nhập đều được thả cảm xúc (kể cả khi chủ đề bị khóa).
  async setReaction(target: ReactionTarget, targetId: string, viewer: Viewer, type: ReactionType): Promise<ReactionSummary> {
    await this.requireTarget(target, targetId);
    await this.reactions.set(target, targetId, viewer.id, type);
    return this.summaryOf(target, targetId, viewer);
  }

  async removeReaction(target: ReactionTarget, targetId: string, viewer: Viewer): Promise<ReactionSummary> {
    await this.requireTarget(target, targetId);
    await this.reactions.remove(target, targetId, viewer.id);
    return this.summaryOf(target, targetId, viewer);
  }

  private async summaryOf(target: ReactionTarget, targetId: string, viewer: Viewer): Promise<ReactionSummary> {
    const summaries = await this.reactions.summaries(target, [targetId], viewer.id);
    return summaries.get(targetId) ?? emptyReactionSummary();
  }

  private async requireTarget(target: ReactionTarget, targetId: string): Promise<void> {
    if (target === 'DISCUSSION') await this.require(targetId);
    else await this.requireComment(targetId);
  }

  // Chỉ một cấp: cha phải tồn tại, cùng chủ đề, chưa bị xóa và là bình luận gốc.
  private async assertCanReplyTo(discussionId: string, parentId: string): Promise<void> {
    const parent = await this.discussions.findComment(parentId);
    if (!parent) throw new NotFoundException(COMMENT_NOT_FOUND);
    if (parent.discussionId !== discussionId) {
      throw new BadRequestException('Bình luận cần trả lời không thuộc chủ đề này.');
    }
    if (parent.parentId) throw new BadRequestException('Chỉ có thể trả lời bình luận gốc, không trả lời một phản hồi.');
    if (parent.isDeleted) throw new BadRequestException('Bình luận này đã bị xóa nên không thể trả lời.');
  }

  private async require(id: string): Promise<DiscussionRecord> {
    const discussion = await this.discussions.findById(id);
    if (!discussion) throw new NotFoundException(DISCUSSION_NOT_FOUND);
    return discussion;
  }

  // Bình luận đã xóa mềm được coi như không tồn tại với mọi thao tác ghi.
  private async requireComment(id: string) {
    const comment = await this.discussions.findComment(id);
    if (!comment || comment.isDeleted) throw new NotFoundException(COMMENT_NOT_FOUND);
    return comment;
  }

  private toCommentView(
    comment: CommentRecord,
    viewer: Viewer | null,
    locked: boolean,
    summaries: Map<string, ReactionSummary>,
    replies: CommentRecord[],
  ): CommentView {
    const { authorId, ...rest } = comment;
    const own = viewer?.id === authorId;
    if (comment.isDeleted) {
      return {
        ...rest,
        authorName: 'Người dùng đã xóa',
        content: '',
        reactions: emptyReactionSummary(),
        replies: replies.map((reply) => this.toCommentView(reply, viewer, locked, summaries, [])),
        canEdit: false,
        canDelete: false,
      };
    }
    return {
      ...rest,
      reactions: summaries.get(comment.id) ?? emptyReactionSummary(),
      replies: replies.map((reply) => this.toCommentView(reply, viewer, locked, summaries, [])),
      canEdit: own && !locked,
      canDelete: viewer !== null && (own || viewer.role === 'ADMIN'),
    };
  }

  private toView(discussion: DiscussionRecord, viewer: Viewer | null, reactions: ReactionSummary): DiscussionView {
    const { authorId, hasOthersComments: _unused, ...rest } = discussion;
    void _unused;
    return {
      ...rest,
      reactions,
      canEdit: viewer?.id === authorId && !discussion.isLocked,
      canDelete: canDeleteDiscussion(viewer, discussion),
      canModerate: viewer?.role === 'ADMIN',
    };
  }
}
