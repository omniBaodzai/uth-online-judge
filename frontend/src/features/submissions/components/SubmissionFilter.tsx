import type { FormEvent } from 'react'
import type { SubmissionFilters } from '../data'
import styles from './SubmissionFilter.module.css'

type SubmissionFilterProps = {
  values: SubmissionFilters
  statuses: string[]
  languages: string[]
  organizations: string[]
  onChange: (values: SubmissionFilters) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function SubmissionFilter({ values, statuses, languages, organizations, onChange, onSubmit }: SubmissionFilterProps) {
  return (
    <form className={styles.filterPanel} onSubmit={onSubmit}>
      <div className={styles.panelTitle}>
        <span className={styles.filterIcon} aria-hidden="true">☷</span>
        <div>
          <h2>Lọc bài nộp</h2>
          <p>Tìm nhanh kết quả bạn cần</p>
        </div>
      </div>

      <label className={styles.fieldLabel} htmlFor="submission-status">Trạng thái</label>
      <select
        id="submission-status"
        value={values.status}
        onChange={(event) => onChange({ ...values, status: event.target.value })}
      >
        <option>Tất cả trạng thái</option>
        {statuses.map((status) => <option key={status}>{status}</option>)}
      </select>

      <label className={styles.fieldLabel} htmlFor="submission-language">Ngôn ngữ</label>
      <select
        id="submission-language"
        value={values.language}
        onChange={(event) => onChange({ ...values, language: event.target.value })}
      >
        <option>Tất cả ngôn ngữ</option>
        {languages.map((language) => <option key={language}>{language}</option>)}
      </select>

      <label className={styles.fieldLabel} htmlFor="submission-organization">Tổ chức</label>
      <select
        id="submission-organization"
        value={values.organization}
        onChange={(event) => onChange({ ...values, organization: event.target.value })}
      >
        <option>Tất cả tổ chức</option>
        {organizations.map((organization) => <option key={organization}>{organization}</option>)}
      </select>

      <button className={styles.submitButton} type="submit">Tìm bài nộp</button>
    </form>
  )
}

export default SubmissionFilter