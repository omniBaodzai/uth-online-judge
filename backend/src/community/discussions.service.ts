import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PageResult, Viewer } from './community.utils.js';
import {
  DiscussionsRepository,
  type CommentRecord,
  type DiscussionListItem,
  type DiscussionRecord,
  type PageQuery,
} from './discussions.repository.js';

const DISCUSSION_NOT_FOUND = 'Không tìm thấy chủ đề thảo luận.';
const LOCKED = 'Chủ đề này đã bị khóa nên không thể chỉnh sửa hoặc bình luận thêm.';

export type DiscussionView = Omit<DiscussionRecord, 'authorId' | 'hasOthersComments'> & {
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
};

export type CommentView = Omit<CommentRecord, 'authorId'> & { canEdit: boolean; canDelete: boolean };

export function canDeleteDiscussion(viewer: Viewer | null, discussion: DiscussionRecord): boolean {
  if (!viewer) return false;
  if (viewer.role === 'ADMIN') return true;
  // Tác giả không được xóa khi đã có người khác tham gia thảo luận.
  return viewer.id === discussion.authorId && !discussion.hasOthersComments;
}

@Injectable()
export class DiscussionsService {
  constructor(private readonly discussions: DiscussionsRepository) {}

  list(query: PageQuery): Promise<PageResult<DiscussionListItem>> {
    return this.discussions.list(query);
  }

  async get(id: string, viewer: Viewer | null): Promise<DiscussionView> {
    return this.toView(await this.require(id), viewer);
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
    return {
      ...page,
      items: page.items.map(({ authorId, ...comment }) => ({
        ...comment,
        canEdit: viewer?.id === authorId && !discussion.isLocked,
        canDelete: viewer !== null && (viewer.id === authorId || viewer.role === 'ADMIN'),
      })),
    };
  }

  async addComment(id: string, viewer: Viewer, content: string): Promise<void> {
    const discussion = await this.require(id);
    if (discussion.isLocked) throw new ForbiddenException(LOCKED);
    await this.discussions.createComment(id, viewer.id, content);
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

  private async require(id: string): Promise<DiscussionRecord> {
    const discussion = await this.discussions.findById(id);
    if (!discussion) throw new NotFoundException(DISCUSSION_NOT_FOUND);
    return discussion;
  }

  private async requireComment(id: string) {
    const comment = await this.discussions.findComment(id);
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận.');
    return comment;
  }

  private toView(discussion: DiscussionRecord, viewer: Viewer | null): DiscussionView {
    const { authorId, hasOthersComments: _unused, ...rest } = discussion;
    void _unused;
    return {
      ...rest,
      canEdit: viewer?.id === authorId && !discussion.isLocked,
      canDelete: canDeleteDiscussion(viewer, discussion),
      canModerate: viewer?.role === 'ADMIN',
    };
  }
}
