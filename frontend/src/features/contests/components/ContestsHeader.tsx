import styles from './ContestsHeader.module.css'

type ContestsHeaderProps = {
  hidePrivate: boolean
  view: 'list' | 'calendar'
  onHidePrivateChange: (checked: boolean) => void
  onViewChange: (view: 'list' | 'calendar') => void
}

function ContestsHeader({ hidePrivate, view, onHidePrivateChange, onViewChange }: ContestsHeaderProps) {
  return (
    <div className={styles.headerRow}>
      <div className={styles.titleBlock}>
        <p className={styles.eyebrow}>THỬ THÁCH CÙNG CỘNG ĐỒNG</p>
        <h1>Các kỳ thi</h1>
        <p className={styles.subtitle}>Theo dõi lịch thi và quay lại thử sức với các contest đã diễn ra.</p>
      </div>
      <div className={styles.controls}>
        <label className={styles.privateToggle}>
          <input
            type="checkbox"
            checked={hidePrivate}
            onChange={(event) => onHidePrivateChange(event.target.checked)}
          />
          <span>Ẩn các kỳ thi riêng tư</span>
        </label>
        <div className={styles.viewSwitch} role="group" aria-label="Chế độ hiển thị kỳ thi">
          <button
            className={view === 'list' ? styles.selectedView : ''}
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => onViewChange('list')}
          >
            <span aria-hidden="true">☷</span> Danh sách
          </button>
          <button
            className={view === 'calendar' ? styles.selectedView : ''}
            type="button"
            aria-pressed={view === 'calendar'}
            onClick={() => onViewChange('calendar')}
          >
            <span aria-hidden="true">▦</span> Lịch
          </button>
        </div>
      </div>
    </div>
  )
}

export default ContestsHeader