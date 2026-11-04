import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { BreadcrumbContext } from './breadcrumb-context'
import { getBreadcrumbItems } from './breadcrumb-routes'
import styles from './Breadcrumb.module.css'

const breadcrumbTranslationKeys: Record<string, string> = {
  'Trang chủ': 'breadcrumbHome',
  'Bài tập': 'breadcrumbProblems',
  'Cuộc thi': 'breadcrumbContests',
  'Tin tức': 'breadcrumbNews',
  'Thảo luận': 'breadcrumbDiscussions',
  'Bảng xếp hạng': 'breadcrumbLeaderboard',
  'Chi tiết bài tập': 'breadcrumbDetailProblem',
  'Chi tiết cuộc thi': 'breadcrumbDetailContest',
  'Nộp bài thi': 'breadcrumbSubmitContest',
  'Gửi bài giải': 'breadcrumbSubmitSolution',
  'Bài nộp của tôi': 'breadcrumbMySubmissions',
  'Bài nộp tốt nhất': 'breadcrumbBestSubmissions',
  'Danh sách bài nộp': 'breadcrumbSubmissionList',
  'Lời giải bài tập': 'breadcrumbSolution',
  'Đề bài dạng PDF': 'breadcrumbProblemPdf',
  'Chi tiết bài nộp': 'breadcrumbSubmissionDetail',
  'Bài nộp': 'breadcrumbSubmissions',
  'Chi tiết tin tức': 'breadcrumbNewsDetail',
  'Tạo chủ đề': 'breadcrumbCreateDiscussion',
  'Chi tiết thảo luận': 'breadcrumbDiscussionDetail',
  'Hồ sơ': 'breadcrumbProfile',
  'Chỉnh sửa hồ sơ': 'breadcrumbEditProfile',
  'Hồ sơ công khai': 'breadcrumbPublicProfile',
  'Tổ chức': 'breadcrumbOrganizations',
  'Liên hệ': 'breadcrumbContact',
  'Chi tiết yêu cầu': 'breadcrumbContactDetail',
}

function Breadcrumb() {
  const { t } = useTranslation('common')
  const { pathname, search } = useLocation()
  const { problemCode, contestProblem } = useContext(BreadcrumbContext)
  const from = new URLSearchParams(search).get('from')
  const items = getBreadcrumbItems(pathname, { problemCode, from, contestProblem })
  if (items.length === 0) return null

  const isAdmin = pathname.startsWith('/admin')

  return (
    <nav
      className={styles.breadcrumb}
      data-variant={isAdmin ? 'admin' : 'public'}
      aria-label={isAdmin ? 'Điều hướng đường dẫn' : t('breadcrumbLabel')}
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
                <Link to={item.to}>
                  {!isAdmin && !item.dynamic && breadcrumbTranslationKeys[item.label]
                    ? t(breadcrumbTranslationKeys[item.label])
                    : item.label}
                </Link>
              ) : (
                <span aria-current={current ? 'page' : undefined}>
                  {!isAdmin && !item.dynamic && breadcrumbTranslationKeys[item.label]
                    ? t(breadcrumbTranslationKeys[item.label])
                    : item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default Breadcrumb
