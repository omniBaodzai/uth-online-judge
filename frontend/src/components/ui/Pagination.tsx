import styles from './Pagination.module.css'

type PaginationProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  label: string
  className?: string
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  label,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav
      className={`${styles.pagination} ${className ?? ''}`}
      aria-label={`Phân trang ${label}`}
    >
      <button
        className={styles.pageButton}
        type="button"
        aria-label="Trang trước"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <span aria-hidden="true">‹</span>
      </button>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
        <button
          className={`${styles.pageButton} ${page === currentPage ? styles.activePage : ''}`}
          key={page}
          type="button"
          aria-current={page === currentPage ? 'page' : undefined}
          aria-label={`Trang ${page}`}
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ))}
      <button
        className={styles.pageButton}
        type="button"
        aria-label="Trang sau"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <span aria-hidden="true">›</span>
      </button>
    </nav>
  )
}

export default Pagination
