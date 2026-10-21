import { useMemo, useState } from 'react'
import Pagination from '../../../components/ui/Pagination'
import SiteHeader from '../../../components/layout/SiteHeader'
import ContestsCalendar from '../components/ContestsCalendar'
import ContestsHeader from '../components/ContestsHeader'
import ContestsTable from '../components/ContestsTable'
import { contestPageSize, contests, type Contest } from '../data'
import styles from './ContestsPage.module.css'

function ContestsPage() {
  const [hidePrivate, setHidePrivate] = useState(true)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [virtualMessage, setVirtualMessage] = useState('')

  const visibleContests = useMemo(() => contests
    .filter((contest) => !hidePrivate || !contest.isPrivate)
    .filter((contest) => contest.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))
    .sort((first, second) => second.startsAt.localeCompare(first.startsAt)), [hidePrivate, search])

  const totalPages = Math.ceil(visibleContests.length / contestPageSize)
  const pageContests = visibleContests.slice((currentPage - 1) * contestPageSize, currentPage * contestPageSize)
  const firstResult = visibleContests.length === 0 ? 0 : (currentPage - 1) * contestPageSize + 1
  const lastResult = Math.min(currentPage * contestPageSize, visibleContests.length)

  function handleSearchChange(value: string) {
    setSearch(value)
    setCurrentPage(1)
  }

  function handlePrivateChange(checked: boolean) {
    setHidePrivate(checked)
    setCurrentPage(1)
  }

  function startVirtualParticipation(contest: Contest) {
    setVirtualMessage(`Đã chọn tham gia ảo: ${contest.name}. Bản demo chưa kết nối dữ liệu bài thi.`)
  }

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <ContestsHeader
          hidePrivate={hidePrivate}
          view={view}
          onHidePrivateChange={handlePrivateChange}
          onViewChange={setView}
        />

        <section className={styles.upcomingSection} aria-labelledby="upcoming-title">
          <div className={styles.sectionHeading}>
            <div>
              <p>SẮP DIỄN RA</p>
              <h2 id="upcoming-title">Các kỳ thi sắp tới</h2>
            </div>
            <span className={styles.upcomingMark} aria-hidden="true">◷</span>
          </div>
          <div className={styles.upcomingEmpty}>
            <span className={styles.emptyCalendar} aria-hidden="true">▦</span>
            <div>
              <strong>Chưa có kỳ thi được lên lịch trong tương lai</strong>
              <p>Các kỳ thi mới sẽ xuất hiện tại đây khi được công bố.</p>
            </div>
          </div>
        </section>

        <section className={styles.pastSection} aria-labelledby="past-title">
          <div className={styles.pastHeading}>
            <div>
              <p>LUYỆN TẬP LẠI</p>
              <h2 id="past-title">Các kỳ thi đã qua</h2>
              <span>{visibleContests.length} kỳ thi{hidePrivate ? '' : ' bao gồm kỳ thi riêng tư'}</span>
            </div>
            <label className={styles.searchBox}>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Tìm kỳ thi..."
                aria-label="Tìm kỳ thi"
              />
            </label>
          </div>

          {view === 'list' ? (
            <div className={styles.listPanel}>
              <div className={styles.listToolbar}>
                <span>Hiển thị {firstResult}–{lastResult} trong {visibleContests.length}</span>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  label="kỳ thi"
                />
              </div>
              <ContestsTable contests={pageContests} onVirtualParticipate={startVirtualParticipation} />
              <div className={styles.listFooter}>
                <span>{visibleContests.length} kỳ thi</span>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  label="kỳ thi"
                />
              </div>
            </div>
          ) : (
            <ContestsCalendar
              contests={visibleContests}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onVirtualParticipate={startVirtualParticipation}
            />
          )}
        </section>

        <p className={styles.virtualMessage} aria-live="polite">{virtualMessage}</p>
      </main>
    </div>
  )
}

export default ContestsPage