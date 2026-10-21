import type { FormEvent } from 'react'
import type { ProblemFilters } from '../data'
import styles from './ProblemFilter.module.css'

type ProblemFilterProps = {
  values: ProblemFilters
  topics: string[]
  onChange: (values: ProblemFilters) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onRandom: () => void
}

function ProblemFilter({ values, topics, onChange, onSubmit, onRandom }: ProblemFilterProps) {
  function update<K extends keyof ProblemFilters>(key: K, value: ProblemFilters[K]) {
    onChange({ ...values, [key]: value })
  }

  return (
    <form className={styles.filterPanel} onSubmit={onSubmit}>
      <div className={styles.panelHeading}>
        <span className={styles.headingIcon} aria-hidden="true">⌕</span>
        <div>
          <h2>Tìm bài tập</h2>
          <p>Thu hẹp danh sách theo mục tiêu của bạn</p>
        </div>
      </div>

      <label className={styles.fieldLabel} htmlFor="problem-keyword">Từ khóa</label>
      <div className={styles.searchField}>
        <span aria-hidden="true">⌕</span>
        <input
          id="problem-keyword"
          type="search"
          value={values.keyword}
          onChange={(event) => update('keyword', event.target.value)}
          placeholder="Tên bài hoặc mã bài"
        />
      </div>

      <label className={styles.fieldLabel} htmlFor="problem-topic">Nhóm bài</label>
      <select
        className={styles.select}
        id="problem-topic"
        value={values.topic}
        onChange={(event) => update('topic', event.target.value)}
      >
        <option>Tất cả nhóm</option>
        {topics.map((topic) => <option key={topic}>{topic}</option>)}
      </select>

      <label className={styles.fieldLabel} htmlFor="problem-difficulty">Dạng bài</label>
      <select
        className={styles.select}
        id="problem-difficulty"
        value={values.difficulty}
        onChange={(event) => update('difficulty', event.target.value)}
      >
        <option>Tất cả mức độ</option>
        <option>Dễ</option>
        <option>Trung bình</option>
        <option>Khó</option>
      </select>

      <fieldset className={styles.scoreFieldset}>
        <legend>Khoảng điểm</legend>
        <div className={styles.scoreValues}>
          <span>{values.minScore} điểm</span>
          <span>{values.maxScore} điểm</span>
        </div>
        <label className={styles.rangeLabel} htmlFor="minimum-score">Điểm tối thiểu</label>
        <input
          className={styles.range}
          id="minimum-score"
          type="range"
          min="0"
          max="100"
          step="5"
          value={values.minScore}
          onChange={(event) => update('minScore', Math.min(Number(event.target.value), values.maxScore))}
        />
        <label className={styles.rangeLabel} htmlFor="maximum-score">Điểm tối đa</label>
        <input
          className={styles.range}
          id="maximum-score"
          type="range"
          min="0"
          max="100"
          step="5"
          value={values.maxScore}
          onChange={(event) => update('maxScore', Math.max(Number(event.target.value), values.minScore))}
        />
      </fieldset>

      <div className={styles.checkOptions}>
        <label className={styles.checkOption}>
          <input
            type="checkbox"
            checked={values.solvedOnly}
            onChange={(event) => update('solvedOnly', event.target.checked)}
          />
          <span>Chỉ bài chưa giải</span>
        </label>
        <label className={styles.checkOption}>
          <input
            type="checkbox"
            checked={values.editorialOnly}
            onChange={(event) => update('editorialOnly', event.target.checked)}
          />
          <span>Có lời giải</span>
        </label>
      </div>

      <div className={styles.actions}>
        <button className={styles.searchButton} type="submit">Tìm bài tập</button>
        <button className={styles.randomButton} type="button" onClick={onRandom}>
          <span aria-hidden="true">⤨</span> Ngẫu nhiên
        </button>
      </div>
    </form>
  )
}

export default ProblemFilter