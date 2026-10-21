import type { LeaderboardCategory } from '../data'
import Pagination from '../../../components/ui/Pagination'
import styles from './LeaderboardHeader.module.css'

type LeaderboardHeaderProps = {
  category: LeaderboardCategory
  search: string
  currentPage: number
  totalPages: number
  firstRank: number
  lastRank: number
  totalItems: number
  onCategoryChange: (category: LeaderboardCategory) => void
  onSearchChange: (value: string) => void
  onPageChange: (page: number) => void
}

const tabs: { id: LeaderboardCategory; label: string }[] = [
  { id: 'ranking', label: 'Bảng xếp hạng' },
  { id: 'contributions', label: 'Đóng góp' },
  { id: 'organizations', label: 'Tổ chức' },
]

function LeaderboardHeader({
  category,
  search,
  currentPage,
  totalPages,
  firstRank,
  lastRank,
  totalItems,
  onCategoryChange,
  onSearchChange,
  onPageChange,
}: LeaderboardHeaderProps) {
  return (
    <>
      <div className={styles.categoryTabs} role="tablist" aria-label="Danh mục bảng xếp hạng">
        {tabs.map((tab) => (
          <button
            className={`${styles.tab} ${category === tab.id ? styles.activeTab : ''}`}
            id={`leaderboard-tab-${tab.id}`}
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={category === tab.id}
            aria-controls="leaderboard-content"
            onClick={() => onCategoryChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeading}>
          <span>Hạng {firstRank}–{lastRank} trong {totalItems}</span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            label={category === 'organizations' ? 'tổ chức' : 'thành viên'}
          />
        </div>
        <div className={styles.searchField}>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={category === 'organizations' ? 'Tìm kiếm tổ chức' : 'Tìm kiếm bằng username'}
            aria-label={category === 'organizations' ? 'Tìm kiếm tổ chức' : 'Tìm kiếm bằng username'}
          />
        </div>
      </div>
    </>
  )
}

export default LeaderboardHeader