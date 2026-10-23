import { useState, type KeyboardEvent } from 'react'
import Pagination from '../../../components/ui/Pagination'
import { discussionItems, newsItems, type FeedItem } from '../data'
import styles from './CommunityFeed.module.css'

type FeedTab = 'news' | 'discussion'

const pageSize = 3

const tabs: Array<{ id: FeedTab; label: string; items: FeedItem[] }> = [
  { id: 'news', label: 'Tin tức', items: newsItems },
  { id: 'discussion', label: 'Thảo luận', items: discussionItems },
]

function CommunityFeed() {
  const [activeTab, setActiveTab] = useState<FeedTab>('news')
  const [currentPage, setCurrentPage] = useState(1)
  const items = tabs.find((tab) => tab.id === activeTab)?.items ?? []
  const totalPages = Math.ceil(items.length / pageSize)
  const visibleItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function selectTab(tab: FeedTab) {
    setActiveTab(tab)
    setCurrentPage(1)
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

    event.preventDefault()
    const nextTab = activeTab === 'news' ? 'discussion' : 'news'
    selectTab(nextTab)
    document.getElementById(`${nextTab}-tab`)?.focus()
  }

  return (
    <section className={styles.feed} id="community" aria-label="Tin tức và thảo luận">
      <div className={styles.feedHeader}>
        <h2 className={styles.sectionTitle}>Góc cộng đồng</h2>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Chọn nội dung cộng đồng"
          onKeyDown={handleTabKeyDown}
        >
          {tabs.map((tab) => (
            <button
              className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
              id={`${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls="community-feed-panel"
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              key={tab.id}
            >
              {tab.label}
              <span className={styles.tabCount}>{tab.items.length}</span>
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
      >
        {visibleItems.length === 0 ? (
          <div className={styles.empty}>
            <strong>Chưa có nội dung</strong>
            <p>
              {activeTab === 'news'
                ? 'Tin tức mới sẽ xuất hiện tại đây.'
                : 'Chưa có chủ đề thảo luận nào. Hãy quay lại sau.'}
            </p>
          </div>
        ) : (
          visibleItems.map((item) => (
            <FeedEntry item={item} isDiscussion={activeTab === 'discussion'} key={item.id} />
          ))
        )}
      </div>

      <Pagination
        className={styles.pager}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        label={activeTab === 'news' ? 'tin tức' : 'thảo luận'}
      />
    </section>
  )
}

// Ngày có dạng YYYY-MM-DD nên tách thành ngày/tháng cho cột bên trái.
function DateBlock({ dateTime }: { dateTime: string }) {
  const [, month = '', day = ''] = dateTime.split('-')
  return (
    <div className={styles.dateBlock} aria-hidden="true">
      <strong>{day.slice(0, 2)}</strong>
      <span>Th{Number(month)}</span>
    </div>
  )
}

function FeedEntry({ item, isDiscussion }: { item: FeedItem; isDiscussion: boolean }) {
  return (
    <article className={styles.entry}>
      {isDiscussion ? (
        <div className={styles.replyBlock} aria-label={`${item.replies ?? 0} phản hồi`}>
          <strong>{item.replies ?? 0}</strong>
          <span>phản hồi</span>
        </div>
      ) : (
        <DateBlock dateTime={item.dateTime} />
      )}
      <div className={styles.entryBody}>
        <h3 className={styles.entryTitle}>{item.title}</h3>
        <p className={styles.entrySummary}>{item.summary}</p>
        <p className={styles.entryMeta}>
          <span className={styles.category}>{item.category}</span>
          <span>{item.author}</span>
          <time dateTime={item.dateTime}>{item.date}</time>
        </p>
      </div>
    </article>
  )
}

export default CommunityFeed
