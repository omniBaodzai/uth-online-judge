import type { DiscussionListItem, NewsListItem } from './api'

export type FeedEntryData = {
  id: string
  to: string
  title: string
  summary: string
  category?: string
  author: string
  dateTime: string | null
  replies?: number
  reactions?: number
}

export function mapNews(item: NewsListItem): FeedEntryData {
  return {
    id: item.id,
    to: `/news/${encodeURIComponent(item.slug)}`,
    title: item.title,
    summary: item.summary,
    category: item.category,
    author: item.authorName,
    dateTime: item.publishedAt,
  }
}

export function mapDiscussion(item: DiscussionListItem): FeedEntryData {
  return {
    id: item.id,
    to: `/discussions/${encodeURIComponent(item.id)}`,
    title: item.title,
    summary: item.summary,
    author: item.authorName,
    dateTime: item.createdAt,
    replies: item.replies,
    reactions: item.reactionCount,
  }
}
