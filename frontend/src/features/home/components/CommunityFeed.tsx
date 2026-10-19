import { useState, type KeyboardEvent } from 'react'
import Pagination from '../../../components/ui/Pagination'
import { discussionItems, newsItems, type FeedItem } from '../data'
import styles from './CommunityFeed.module.css'

type FeedTab = 'news' | 'discussion'

const pageSize = 3

function CommunityFeed() {
  const [activeTab, setActiveTab] = useState<FeedTab>('news')
  const [currentPage, setCurrentPage] = useState(1)
  const items = activeTab === 'news' ? newsItems : discussionItems
  const totalPages = Math.ceil(items.length / pageSize)
  const visibleItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const tabId = activeTab === 'news' ? 'news-tab' : 'discussion-tab'

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
    <section
      className={styles.feedCard}
      id="community"
      aria-label="Tin tức và thảo luận"
    >
      <div className={styles.feedHeader}>
        <div>
          <p className={styles.sectionEyebrow}>CẬP NHẬT TỪ CỘNG ĐỒNG</p>
          <h2 className={styles.sectionTitle}>Góc cộng đồng</h2>
        </div>
        <span className={styles.liveLabel}>
          <span aria-hidden="true" />
          UTH Online
        </span>
      </div>

      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Chọn nội dung cộng đồng"
        onKeyDown={handleTabKeyDown}
      >
        <button
          className={`${styles.tab} ${activeTab === 'news' ? styles.activeTab : ''}`}
          id="news-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'news'}
          aria-controls="community-feed-panel"
          tabIndex={activeTab === 'news' ? 0 : -1}
          onClick={() => selectTab('news')}
        >
          Tin tức
          <span className={styles.tabCount}>{newsItems.length}</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'discussion' ? styles.activeTab : ''}`}
          id="discussion-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'discussion'}
          aria-controls="community-feed-panel"
          tabIndex={activeTab === 'discussion' ? 0 : -1}
          onClick={() => selectTab('discussion')}
        >
          Thảo luận
          <span className={styles.tabCount}>{discussionItems.length}</span>
        </button>
      </div>

      <div
        className={styles.feedList}
        id="community-feed-panel"
        role="tabpanel"
        aria-labelledby={tabId}
        aria-live="polite"
      >
        {visibleItems.map((item) => (
          <FeedEntry item={item} isDiscussion={activeTab === 'discussion'} key={item.id} />
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        label={activeTab === 'news' ? 'tin tức' : 'thảo luận'}
      />
    </section>
  )
}

function FeedEntry({
  item,
  isDiscussion,
}: {
  item: FeedItem
  isDiscussion: boolean
}) {
  return (
    <article className={styles.feedEntry}>
      <div className={styles.entryTopline}>
        <span className={styles.category}>{item.category}</span>
        <time className={styles.entryDate} dateTime={item.dateTime}>
          {item.date}
        </time>
      </div>
      <h3 className={styles.entryTitle}>{item.title}</h3>
      <p className={styles.entrySummary}>{item.summary}</p>
      <div className={styles.entryFooter}>
        <span className={styles.entryAuthor}>
          {isDiscussion ? 'Đăng bởi' : 'Từ'} <strong>{item.author}</strong>
        </span>
        {isDiscussion && item.replies !== undefined && (
          <span className={styles.replyCount}>{item.replies} phản hồi</span>
        )}
      </div>
    </article>
  )
}

export default CommunityFeed
