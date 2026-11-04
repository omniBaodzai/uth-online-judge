import { useEffect, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Pagination from '../../../components/ui/Pagination'
import { request } from '../../auth/api'
import {
  buildQuery,
  type DiscussionListItem,
  type NewsListItem,
  type PageResult,
} from '../../community/api'
import { mapDiscussion, mapNews, type FeedEntryData } from '../../community/feed'
import { CreateDiscussionButton } from '../../community/CreateDiscussionButton'
import { formatDate, toDateBlock, totalPages } from '../../community/format'
import styles from './CommunityFeed.module.css'

type FeedTab = 'news' | 'discussion'

type FeedState = {
  items: FeedEntryData[]
  total: number
  status: 'loading' | 'ready' | 'error'
}

const pageSize = 3

function useFeed(tab: FeedTab, page: number): FeedState & { retry: () => void } {
  const [state, setState] = useState<FeedState>({ items: [], total: 0, status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const path = tab === 'news' ? '/news' : '/discussions'
    setState((previous) => ({ ...previous, status: 'loading' }))
    request<PageResult<NewsListItem | DiscussionListItem>>(`${path}${buildQuery({ page, pageSize })}`, {
      signal: controller.signal,
    })
      .then((result) => {
        const items =
          tab === 'news'
            ? (result.items as NewsListItem[]).map(mapNews)
            : (result.items as DiscussionListItem[]).map(mapDiscussion)
        setState({ items, total: result.total, status: 'ready' })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState((previous) => ({ ...previous, status: 'error' }))
      })
    return () => controller.abort()
  }, [tab, page, attempt])

  return { ...state, retry: () => setAttempt((value) => value + 1) }
}

function CommunityFeed() {
  const { t } = useTranslation('home')
  const [activeTab, setActiveTab] = useState<FeedTab>('news')
  const [pages, setPages] = useState<Record<FeedTab, number>>({ news: 1, discussion: 1 })
  const news = useFeed('news', pages.news)
  const discussion = useFeed('discussion', pages.discussion)
  const feeds: Record<FeedTab, FeedState & { retry: () => void }> = { news, discussion }
  const active = feeds[activeTab]

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

    event.preventDefault()
    const nextTab = activeTab === 'news' ? 'discussion' : 'news'
    setActiveTab(nextTab)
    document.getElementById(`${nextTab}-tab`)?.focus()
  }

  const tabLabels: Record<FeedTab, string> = {
    news: t('newsTab'),
    discussion: t('discussionsTab'),
  }

  return (
    <section className={styles.feed} id="community" aria-label={t('communitySection')}>
      <div className={styles.feedHeader}>
        <h2 className={styles.sectionTitle}>{t('communitySection')}</h2>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label={t('communityTablist')}
          onKeyDown={handleTabKeyDown}
        >
          {(Object.keys(tabLabels) as FeedTab[]).map((id) => (
            <button
              className={`${styles.tab} ${activeTab === id ? styles.activeTab : ''}`}
              id={`${id}-tab`}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls="community-feed-panel"
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => setActiveTab(id)}
              key={id}
            >
              {tabLabels[id]}
              <span className={styles.tabCount}>{feeds[id].status === 'error' ? '–' : feeds[id].total}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        className={styles.feedList}
        id="community-feed-panel"
        role="tabpanel"
        aria-labelledby={`${activeTab}-tab`}
        aria-live="polite"
        aria-busy={active.status === 'loading'}
      >
        {active.status === 'error' ? (
          <div className={styles.empty}>
          <strong>{t('loadFeedError')}</strong>
          <p>{t('feedConnectionHint')}</p>
            <button className={styles.retry} type="button" onClick={active.retry}>
            {t('retry', { ns: 'common' })}
            </button>
          </div>
        ) : active.status === 'loading' && active.items.length === 0 ? (
          <div className={styles.empty}>
            <p>{t('loadingFeed')}</p>
          </div>
        ) : active.items.length === 0 ? (
          activeTab === 'news' ? (
            <div className={styles.empty}>
              <strong>{t('noNews')}</strong>
              <p>{t('newsWillAppear')}</p>
            </div>
          ) : (
            <div className={styles.empty}>
              <strong>{t('noDiscussions')}</strong>
              <p>{t('startDiscussion')}</p>
              <CreateDiscussionButton className={styles.createButton} />
            </div>
          )
        ) : (
          active.items.map((item) => (
            <FeedEntry item={item} isDiscussion={activeTab === 'discussion'} key={item.id} />
          ))
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.footerLinks}>
          <Link className={styles.viewAll} to={activeTab === 'news' ? '/news' : '/discussions'}>
            {t('viewAll', { ns: 'common' })}
          </Link>
          {activeTab === 'discussion' && active.items.length > 0 ? (
            <CreateDiscussionButton className={styles.createButton} />
          ) : null}
        </div>
        <Pagination
          className={styles.pager}
          currentPage={pages[activeTab]}
          totalPages={totalPages(active.total, pageSize)}
          onPageChange={(page) => setPages((previous) => ({ ...previous, [activeTab]: page }))}
          label={tabLabels[activeTab]}
        />
      </div>
    </section>
  )
}

function FeedEntry({ item, isDiscussion }: { item: FeedEntryData; isDiscussion: boolean }) {
  const { t, i18n } = useTranslation('home')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const { day, month } = toDateBlock(item.dateTime, locale)
  return (
    <article className={styles.entry}>
      {isDiscussion ? (
        <div className={styles.replyBlock} aria-label={t('replyCount', { count: item.replies ?? 0, ns: 'common' })}>
          <strong>{item.replies ?? 0}</strong>
          <span>{t('replyLabel')}</span>
        </div>
      ) : (
        <div className={styles.dateBlock} aria-hidden="true">
          <strong>{day}</strong>
          <span>{month}</span>
        </div>
      )}
      <div className={styles.entryBody}>
        <h3 className={styles.entryTitle}>
          <Link className={styles.entryLink} to={item.to}>
            {item.title}
          </Link>
        </h3>
        <p className={styles.entrySummary}>{item.summary}</p>
        <p className={styles.entryMeta}>
          {item.category ? <span className={styles.category}>{item.category}</span> : null}
          <span>{item.author}</span>
          <time dateTime={item.dateTime ?? undefined}>{formatDate(item.dateTime, locale)}</time>
          {item.reactions ? <span>{t('reactionCount', { count: item.reactions, ns: 'common' })}</span> : null}
        </p>
      </div>
    </article>
  )
}

export default CommunityFeed
