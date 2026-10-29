import { useEffect, useRef, useState } from 'react'
import { AdminIcon } from './AdminIcons'
import { ConfirmDialog } from './ConfirmDialog'
import {
  applyImportedTestCases,
  parseTestCaseFiles,
  type ImportedTestCase,
  type TestCaseImportError,
} from '../test-case-import'
import type { AdminTestCaseDraft } from '../types'
import styles from '../admin.module.css'

type Props = {
  cases: AdminTestCaseDraft[]
  onChange: (cases: AdminTestCaseDraft[]) => void
  disabled?: boolean
}

function TestCaseCollectionEditor({ cases, onChange, disabled = false }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(cases[0]?.clientId ?? null)
  const [importErrors, setImportErrors] = useState<TestCaseImportError[]>([])
  const [importPreview, setImportPreview] = useState<ImportedTestCase[] | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append')
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importNotice, setImportNotice] = useState('')
  const folderInput = useRef<HTMLInputElement>(null)
  const filesInput = useRef<HTMLInputElement>(null)
  const publicCount = cases.filter((testCase) => testCase.kind === 'sample').length
  const supportsFolderSelection = typeof document !== 'undefined'
    && 'webkitdirectory' in document.createElement('input')

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '')
  }, [])

  function updateCase(clientId: string, updates: Partial<AdminTestCaseDraft>) {
    onChange(cases.map((testCase) => (
      testCase.clientId === clientId ? { ...testCase, ...updates } : testCase
    )))
  }

  function addCase() {
    const testCase: AdminTestCaseDraft = {
      clientId: crypto.randomUUID(),
      name: `Test case ${cases.length + 1}`,
      input: '',
      expectedOutput: '',
      kind: 'hidden',
    }
    onChange([...cases, testCase])
    setExpandedId(testCase.clientId)
  }

  function removeCase(clientId: string) {
    const remaining = cases.filter((testCase) => testCase.clientId !== clientId)
    onChange(remaining)
    if (expandedId === clientId) setExpandedId(remaining[0]?.clientId ?? null)
  }

  function moveCase(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= cases.length) return
    const reordered = [...cases]
    ;[reordered[index], reordered[targetIndex]] = [reordered[targetIndex]!, reordered[index]!]
    onChange(reordered)
  }

  async function readSelectedFiles(list: FileList | null) {
    if (!list?.length) return
    setImporting(true)
    setImportErrors([])
    setImportPreview(null)
    setImportNotice('')
    try {
      const result = await parseTestCaseFiles(Array.from(list))
      setImportErrors(result.errors)
      setImportPreview(result.cases)
      setPreviewIndex(0)
      setImportMode('append')
    } catch {
      setImportErrors([{ fileName: '', message: 'Đã xảy ra lỗi khi đọc các tệp đã chọn.' }])
    } finally {
      setImporting(false)
      if (folderInput.current) folderInput.current.value = ''
      if (filesInput.current) filesInput.current.value = ''
    }
  }

  function applyImport() {
    if (!importPreview?.length || importErrors.length > 0) return
    const next = applyImportedTestCases(cases, importPreview, importMode)
    onChange(next)
    const firstAdded = importMode === 'append' ? next[cases.length] : next[0]
    setExpandedId(firstAdded?.clientId ?? null)
    setImportNotice(`Đã ${importMode === 'append' ? 'thêm' : 'thay thế bằng'} ${importPreview.length} test case trong biểu mẫu. Hãy lưu bài tập để ghi thay đổi.`)
    setImportPreview(null)
    setImportErrors([])
    setConfirmReplace(false)
  }

  return (
    <section className={styles.testCollection} aria-label="Quản lý test case">
      <div className={styles.testCollectionSummary}>
        <div>
          <strong>Quản lý Test Case</strong>
          <p>{cases.length} test · {publicCount} mẫu công khai · {cases.length - publicCount} test ẩn · tối đa {cases.length} điểm</p>
        </div>
        <button className={styles.buttonSecondary} type="button" onClick={addCase} disabled={disabled}>
          <AdminIcon name="plus" size={16} /> Thêm test case
        </button>
      </div>
      {cases.length === 0 ? (
        <p className={styles.fieldHint}>Chưa có test case. Thêm ít nhất một test case trước khi xuất bản.</p>
      ) : (
        <div className={styles.testCollectionList}>
          {cases.map((testCase, index) => {
            const expanded = expandedId === testCase.clientId
            return (
              <article className={styles.testCollectionItem} key={testCase.clientId}>
                <div className={styles.testCollectionHeader}>
                  <button
                    className={styles.testCollectionToggle}
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`test-case-${testCase.clientId}`}
                    onClick={() => setExpandedId(expanded ? null : testCase.clientId)}
                  >
                    <span className={styles.testCaseOrder}>#{index + 1}</span>
                    <strong>{testCase.name || `Test case ${index + 1}`}</strong>
                    <span className={`${styles.badge} ${testCase.kind === 'sample' ? styles.kindSample : styles.kindHidden}`}>
                      {testCase.kind === 'sample' ? 'Mẫu công khai' : 'Test ẩn'}
                    </span>
                    <span className={styles.testCasePoint}>1 điểm</span>
                  </button>
                  <div className={styles.testCollectionActions}>
                    <button
                      className={styles.iconButton}
                      type="button"
                      aria-label={`Chuyển test case ${index + 1} lên`}
                      disabled={disabled || index === 0}
                      onClick={() => moveCase(index, -1)}
                    >↑</button>
                    <button
                      className={styles.iconButton}
                      type="button"
                      aria-label={`Chuyển test case ${index + 1} xuống`}
                      disabled={disabled || index === cases.length - 1}
                      onClick={() => moveCase(index, 1)}
                    >↓</button>
                    <button
                      className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                      type="button"
                      aria-label={`Xóa test case ${index + 1}`}
                      disabled={disabled}
                      onClick={() => removeCase(testCase.clientId)}
                    ><AdminIcon name="trash" size={14} /></button>
                  </div>
                </div>
                {expanded && (
                  <div className={styles.testCollectionFields} id={`test-case-${testCase.clientId}`}>
                    <div className={styles.formGrid}>
                      <div className={styles.field}>
                        <label htmlFor={`${testCase.clientId}-name`}>Tên test case</label>
                        <input
                          id={`${testCase.clientId}-name`}
                          maxLength={100}
                          value={testCase.name}
                          disabled={disabled}
                          onChange={(event) => updateCase(testCase.clientId, { name: event.target.value })}
                        />
                      </div>
                      <label className={styles.testVisibility}>
                        <input
                          type="checkbox"
                          checked={testCase.kind === 'sample'}
                          disabled={disabled}
                          onChange={(event) => updateCase(testCase.clientId, {
                            kind: event.target.checked ? 'sample' : 'hidden',
                          })}
                        />
                        Hiển thị test này làm ví dụ mẫu công khai
                      </label>
                      <div className={`${styles.field} ${styles.codeField}`}>
                        <label htmlFor={`${testCase.clientId}-input`}>Input</label>
                        <textarea
                          id={`${testCase.clientId}-input`}
                          rows={5}
                          value={testCase.input}
                          disabled={disabled}
                          onChange={(event) => updateCase(testCase.clientId, { input: event.target.value })}
                        />
                        <p className={styles.fieldHint}>Có thể để trống với bài không cần dữ liệu đầu vào.</p>
                      </div>
                      <div className={`${styles.field} ${styles.codeField}`}>
                        <label htmlFor={`${testCase.clientId}-output`}>Expected output <span className={styles.requiredMark}>*</span></label>
                        <textarea
                          id={`${testCase.clientId}-output`}
                          rows={5}
                          required
                          value={testCase.expectedOutput}
                          disabled={disabled}
                          onChange={(event) => updateCase(testCase.clientId, { expectedOutput: event.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
      <div className={styles.importPanel}>
        <div className={styles.importActions}>
          <div>
            <strong>Import thư mục</strong>
            <p className={styles.fieldHint}>Chọn các cặp tệp .in và .out. Nội dung chỉ được đọc trong trình duyệt và chưa gửi lên máy chủ.</p>
          </div>
          <div className={styles.rowActions}>
            {supportsFolderSelection && (
              <button className={styles.buttonSecondary} type="button" disabled={disabled || importing} onClick={() => folderInput.current?.click()}>
                Chọn thư mục
              </button>
            )}
            <button className={styles.buttonSecondary} type="button" disabled={disabled || importing} onClick={() => filesInput.current?.click()}>
              {importing ? 'Đang đọc tệp…' : 'Chọn nhiều tệp'}
            </button>
          </div>
        </div>
        <input
          ref={folderInput}
          className={styles.visuallyHiddenInput}
          type="file"
          multiple
          accept=".in,.out"
          aria-label="Chọn thư mục chứa tệp test"
          onChange={(event) => void readSelectedFiles(event.currentTarget.files)}
        />
        <input
          ref={filesInput}
          className={styles.visuallyHiddenInput}
          type="file"
          multiple
          accept=".in,.out"
          aria-label="Chọn nhiều tệp test"
          onChange={(event) => void readSelectedFiles(event.currentTarget.files)}
        />
        {!supportsFolderSelection && (
          <p className={styles.fieldHint}>Trình duyệt này chưa hỗ trợ chọn thư mục. Hãy dùng nút chọn nhiều tệp để chọn các cặp .in/.out.</p>
        )}
        {importErrors.length > 0 && (
          <div className={styles.importErrors} role="alert">
            <strong>Không thể áp dụng tệp import ({importErrors.length} lỗi)</strong>
            <ul>
              {importErrors.map((error, index) => (
                <li key={`${error.fileName}-${index}`}>{error.fileName ? `${error.fileName}: ` : ''}{error.message}</li>
              ))}
            </ul>
          </div>
        )}
        {importPreview && importPreview.length > 0 && (
          <div className={styles.importPreview}>
            <strong>Xem trước {importPreview.length} cặp hợp lệ</strong>
            <label className={styles.field} htmlFor="import-preview-case">
              Chọn cặp để xem nội dung
              <select
                id="import-preview-case"
                value={previewIndex}
                onChange={(event) => setPreviewIndex(Number(event.target.value))}
              >
                {importPreview.map((testCase, index) => (
                  <option key={`${testCase.stem}-${index}`} value={index}>{testCase.stem}.in / {testCase.stem}.out</option>
                ))}
              </select>
            </label>
            {importPreview[previewIndex] && (
              <div className={styles.importContentPreview}>
                <div><span>Dữ liệu đầu vào</span><pre>{importPreview[previewIndex]!.input}</pre></div>
                <div><span>Đầu ra mong đợi</span><pre>{importPreview[previewIndex]!.expectedOutput}</pre></div>
              </div>
            )}
            <label className={styles.field} htmlFor="import-mode">
              Cách áp dụng danh sách
              <select
                id="import-mode"
                value={importMode}
                onChange={(event) => setImportMode(event.target.value as 'append' | 'replace')}
              >
                <option value="append">Thêm vào danh sách hiện tại</option>
                <option value="replace">Thay thế danh sách hiện tại</option>
              </select>
            </label>
            <button
              className={styles.buttonPrimary}
              type="button"
              disabled={disabled || importing || importErrors.length > 0}
              onClick={() => {
                if (importMode === 'replace' && cases.length > 0) setConfirmReplace(true)
                else applyImport()
              }}
            >
              Áp dụng {importMode === 'append' ? 'vào danh sách' : 'thay thế danh sách'}
            </button>
          </div>
        )}
        {importNotice && <p className={styles.fieldHint} role="status">{importNotice}</p>}
      </div>
      {confirmReplace && (
        <ConfirmDialog
          title="Thay thế danh sách test case?"
          description={`Danh sách hiện tại gồm ${cases.length} test case sẽ được thay bằng ${importPreview?.length ?? 0} test case đã import. Thao tác này chỉ áp dụng vào biểu mẫu; cần lưu để ghi vào máy chủ.`}
          confirmLabel="Thay thế danh sách"
          danger
          onConfirm={applyImport}
          onCancel={() => setConfirmReplace(false)}
        />
      )}
    </section>
  )
}

export default TestCaseCollectionEditor
