import { useContext } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BreadcrumbContext } from './breadcrumb-context'
import { getBreadcrumbItems } from './breadcrumb-routes'
import styles from './Breadcrumb.module.css'

function Breadcrumb() {
  const { pathname, search } = useLocation()
  const { problemCode } = useContext(BreadcrumbContext)
  const from = new URLSearchParams(search).get('from')
  const items = getBreadcrumbItems(pathname, { problemCode, from })
  if (items.length === 0) return null

  const isAdmin = pathname.startsWith('/admin')

  return (
    <nav
      className={styles.breadcrumb}
      data-variant={isAdmin ? 'admin' : 'public'}
      aria-label="Điều hướng đường dẫn"
    >
      <ol>
        {items.map((item, index) => {
          const current = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`}>
              {index > 0 && (
                <svg className={styles.separator} viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m6 3 5 5-5 5" />
                </svg>
              )}
              {item.to && !current ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span aria-current={current ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default Breadcrumb
