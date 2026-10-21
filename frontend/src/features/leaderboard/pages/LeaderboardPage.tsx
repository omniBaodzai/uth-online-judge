import { useMemo, useState } from 'react'
import Pagination from '../../../components/ui/Pagination'
import SiteHeader from '../../../components/layout/SiteHeader'
import LeaderboardHeader from '../components/LeaderboardHeader'
import LeaderboardTable from '../components/LeaderboardTable'
import {
  leaderboardPageSize,
  members,
  organizations,
  type LeaderboardCategory,
} from '../data'
import styles from './LeaderboardPage.module.css'

function LeaderboardPage() {
  const [category, setCategory] = useState<LeaderboardCategory>('ranking')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi')
    const result = members
      .filter((member) => !query || member.handle.toLocaleLowerCase('vi').includes(query))
      .sort((first, second) => category === 'contributions'
        ? second.contributions - first.contributions
        : second.score - first.score)
    return result
  }, [category, search])

  const filteredOrganizations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi')
    return organizations
      .filter((organization) => !query
        || organization.name.toLocaleLowerCase('vi').includes(query)
        || organization.shortName.toLocaleLowerCase('vi').includes(query))
      .sort((first, second) => second.score - first.score)
  }, [search])

  const totalItems = category === 'organizations' ? filteredOrganizations.length : filteredMembers.length
  const totalPages = Math.ceil(totalItems / leaderboardPageSize)
  const startIndex = (currentPage - 1) * leaderboardPageSize
  const visibleMembers = filteredMembers.slice(startIndex, startIndex + leaderboardPageSize)
  const visibleOrganizations = filteredOrganizations.slice(startIndex, startIndex + leaderboardPageSize)
  const firstRank = totalItems === 0 ? 0 : startIndex + 1
  const lastRank = Math.min(startIndex + leaderboardPageSize, totalItems)

  function changeCategory(nextCategory: LeaderboardCategory) {
    setCategory(nextCategory)
    setSearch('')
    setCurrentPage(1)
  }

  function changeSearch(value: string) {
    setSearch(value)
    setCurrentPage(1)
  }

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.pageIntro}>
          <div>
            <p className={styles.eyebrow}>CỘNG ĐỒNG UTH ONLINE JUDGE</p>
            <h1>Thành viên</h1>
            <p className={styles.introText}>Ghi nhận thành tích và đóng góp nổi bật của cộng đồng lập trình.</p>
          </div>
          <div className={styles.memberCount}>
            <strong>{category === 'organizations' ? organizations.length : members.length}</strong>
            <span>{category === 'organizations' ? 'tổ chức' : 'thành viên'}</span>
          </div>
        </div>

        <section className={styles.board} aria-label="Bảng xếp hạng thành viên">
          <LeaderboardHeader
            category={category}
            search={search}
            currentPage={currentPage}
            totalPages={totalPages}
            firstRank={firstRank}
            lastRank={lastRank}
            totalItems={totalItems}
            onCategoryChange={changeCategory}
            onSearchChange={changeSearch}
            onPageChange={setCurrentPage}
          />
          <div id="leaderboard-content" role="tabpanel" aria-labelledby={`leaderboard-tab-${category}`} aria-live="polite">
            <LeaderboardTable
              category={category}
              members={visibleMembers}
              organizations={visibleOrganizations}
              firstRank={firstRank}
            />
          </div>
          <div className={styles.tableFooter}>
            <span>{totalItems} kết quả</span>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              label={category === 'organizations' ? 'tổ chức' : 'thành viên'}
            />
          </div>
        </section>
      </main>
    </div>
  )
}

export default LeaderboardPage