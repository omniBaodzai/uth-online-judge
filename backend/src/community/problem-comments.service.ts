import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PageResult, Viewer } from './community.utils.js';
import {
  ProblemCommentsRepository,
  type ProblemCommentPageQuery,
  type ProblemCommentRecord,
} from './problem-comments.repository.js';
import { emptyReactionSummary, type ReactionSummary, type ReactionType } from './reactions.repository.js';

const PROBLEM_NOT_FOUND = 'Không tìm thấy bài tập.';
const COMMENT_NOT_FOUND = 'Không tìm thấy bình luận.';

export type ProblemCommentView = Omit<ProblemCommentRecord, 'authorId'> & {
  reactions: ReactionSummary;
  replies: ProblemCommentView[];
  canEdit: boolean;
  canDelete: boolean;
};

@Injectable()
export class ProblemCommentsService {
  constructor(private readonly comments: ProblemCommentsRepository) {}

  async listComments(
    code: string,
    viewer: Viewer | null,
    query: ProblemCommentPageQuery,
  ): Promise<PageResult<ProblemCommentView>> {
    const problemId = await this.requireProblem(code);
    const page = await this.comments.listComments(problemId, query);
    const replies = await this.comments.listReplies(page.items.map((comment) => comment.id));
    const repliesByParent = new Map<string, ProblemCommentRecord[]>();
    for (const reply of replies) {
      if (!reply.parentId) continue;
      const children = repliesByParent.get(reply.parentId) ?? [];
      children.push(reply);
      repliesByParent.set(reply.parentId, children);
    }
    const summaries = await this.comments.reactionSummaries(
      [...page.items, ...replies].filter((comment) => !comment.isDeleted).map((comment) => comment.id),
      viewer?.id ?? null,
    );
    return {
      ...page,
      items: page.items.map((comment) => this.toView(comment, viewer, summaries, repliesByParent)),
    };
  }

  // authorId luôn lấy từ token đã xác thực, không nhận từ client.
  async addComment(code: string, viewer: Viewer, content: string, parentId: string | null = null): Promise<void> {
    const problemId = await this.requireProblem(code);
    if (parentId) await this.assertCanReplyTo(problemId, parentId);
    await this.comments.createComment(problemId, viewer.id, content, parentId);
  }

  async editComment(commentId: string, viewer: Viewer, content: string): Promise<void> {
    const comment = await this.requireComment(commentId);
    if (comment.authorId !== viewer.id) throw new ForbiddenException('Bạn chỉ có thể sửa bình luận của mình.');
    await this.comments.updateComment(commentId, content);
  }

  async removeComment(commentId: string, viewer: Viewer): Promise<void> {
    const comment = await this.requireComment(commentId);
    if (comment.authorId !== viewer.id && viewer.role !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền xóa bình luận này.');
    }
    await this.comments.deleteComment(commentId);
  }

  async setReaction(commentId: string, viewer: Viewer, type: ReactionType): Promise<ReactionSummary> {
    await this.requireComment(commentId);
    await this.comments.setReaction(commentId, viewer.id, type);
    return this.summaryOf(commentId, viewer);
  }

  async removeReaction(commentId: string, viewer: Viewer): Promise<ReactionSummary> {
    await this.requireComment(commentId);
    await this.comments.removeReaction(commentId, viewer.id);
    return this.summaryOf(commentId, viewer);
  }

  private async summaryOf(commentId: string, viewer: Viewer): Promise<ReactionSummary> {
    const summaries = await this.comments.reactionSummaries([commentId], viewer.id);
    return summaries.get(commentId) ?? emptyReactionSummary();
  }

  private async requireProblem(code: string): Promise<string> {
    const id = await this.comments.findPublishedProblemId(code);
    if (!id) throw new NotFoundException(PROBLEM_NOT_FOUND);
    return id;
  }

  // Bình luận đã xóa mềm hoặc thuộc bài tập không còn công khai được coi như không tồn tại.
  private async requireComment(id: string) {
    const comment = await this.comments.findComment(id);
    if (!comment || comment.isDeleted) throw new NotFoundException(COMMENT_NOT_FOUND);
    return comment;
  }

  // Cha phải tồn tại, cùng bài tập và chưa bị xóa.
  private async assertCanReplyTo(problemId: string, parentId: string): Promise<void> {
    const parent = await this.comments.findComment(parentId);
    if (!parent) throw new NotFoundException(COMMENT_NOT_FOUND);
    if (parent.problemId !== problemId) {
      throw new BadRequestException('Bình luận cần trả lời không thuộc bài tập này.');
    }
    if (parent.isDeleted) throw new BadRequestException('Bình luận này đã bị xóa nên không thể trả lời.');
  }

  private toView(
    comment: ProblemCommentRecord,
    viewer: Viewer | null,
    summaries: Map<string, ReactionSummary>,
    repliesByParent: Map<string, ProblemCommentRecord[]>,
  ): ProblemCommentView {
    const { authorId, ...rest } = comment;
    const own = viewer?.id === authorId;
    const replies = (repliesByParent.get(comment.id) ?? []).map((reply) =>
      this.toView(reply, viewer, summaries, repliesByParent),
    );
    if (comment.isDeleted) {
      return {
        ...rest,
        authorName: 'Người dùng đã xóa',
        content: '',
        reactions: emptyReactionSummary(),
        replies,
        canEdit: false,
        canDelete: false,
      };
    }
    return {
      ...rest,
      reactions: summaries.get(comment.id) ?? emptyReactionSummary(),
      replies,
      canEdit: own,
      canDelete: viewer !== null && (own || viewer.role === 'ADMIN'),
    };
  }
}
