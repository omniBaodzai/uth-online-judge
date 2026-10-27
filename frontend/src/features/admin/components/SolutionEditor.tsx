import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../auth/api'
import MarkdownContent from '../../problems/components/MarkdownContent'
import { useAdmin } from '../useAdmin'
import styles from '../admin.module.css'

type Solution = { content: string; published: boolean }

const PLACEHOLDER = `## Ý tưởng

Mô tả hướng giải và độ phức tạp.

\`\`\`cpp
#include <bits/stdc++.h>
int main() {
  return 0;
}
\`\`\``

// Lưu độc lập với biểu mẫu bài tập vì lời giải có API riêng: PUT /admin/problems/:id/solution.
function SolutionEditor({ problemId }: { problemId: string }) {
  const { request, setNotice } = useAdmin()
  const [saved, setSaved] = useState<Solution | null>(null)
  const [content, setContent] = useState('')
  const [published, setPublished] = useState(true)
  const [preview, setPreview] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const data = await request<Solution>(`/admin/problems/${problemId}/solution`)
      setSaved(data)
      setContent(data.content)
      setPublished(data.content ? data.published : true)
    } catch (cause) {
      setLoadError(cause instanceof ApiError ? cause.message : 'Không thể tải lời giải.')
    }
  }, [problemId, request])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setSaving(true)
    setSaveError('')
    try {
      const data = await request<Solution>(`/admin/problems/${problemId}/solution`, {
        method: 'PUT',
        body: JSON.stringify({ content, published }),
      })
      setSaved(data)
      setContent(data.content)
      setNotice(data.content ? 'Đã lưu lời giải.' : 'Đã xóa lời giải.')
    } catch (cause) {
      setSaveError(cause instanceof ApiError ? cause.message : 'Không thể lưu lời giải. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const dirty = saved !== null && (saved.content !== content.trim() || (content.trim() !== '' && saved.published !== published))

  return (
    <section className={`${styles.panel} ${styles.formSection}`} aria-labelledby="solution-editor-title">
      <h2 id="solution-editor-title">Lời giải bài tập (Solution)</h2>
      <p className={styles.sectionHint}>
        Hỗ trợ Markdown, bảng và khối mã có tô màu (```cpp, ```java, ```python). Để trống rồi lưu để xóa lời giải.
      </p>
      {loadError ? (
        <p className={styles.fieldError} role="alert">
          {loadError}{' '}
          <button className={styles.buttonSecondary} type="button" onClick={() => void load()}>Thử lại</button>
        </p>
      ) : (
        <>
          <div className={styles.field}>
            <label htmlFor="solution-content">Nội dung Markdown</label>
            {preview ? (
              <div aria-live="polite">
                {content.trim() ? <MarkdownContent>{content}</MarkdownContent> : <p className={styles.fieldHint}>Chưa có nội dung để xem trước.</p>}
              </div>
            ) : (
              <textarea
                id="solution-content"
                rows={16}
                maxLength={100000}
                value={content}
                placeholder={PLACEHOLDER}
                spellCheck={false}
                onChange={(event) => setContent(event.target.value)}
                disabled={saved === null}
              />
            )}
          </div>
          <div className={styles.field}>
            <label>
              <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />{' '}
              Hiển thị lời giải cho người dùng
            </label>
          </div>
          {saveError && <p className={styles.formMessage} role="alert">{saveError}</p>}
          <div className={styles.formActions}>
            <button className={styles.buttonSecondary} type="button" onClick={() => setPreview((value) => !value)}>
              {preview ? 'Chỉnh sửa' : 'Xem trước'}
            </button>
            <button className={styles.buttonPrimary} type="button" onClick={() => void save()} disabled={saving || saved === null || !dirty}>
              {saving ? 'Đang lưu…' : 'Lưu lời giải'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

export default SolutionEditor
