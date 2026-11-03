import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Circle } from 'lucide-react'
import { getPasswordAssessment } from '../password-policy'
import type { PasswordStrengthEvaluation } from '../password-strength'
import styles from './PasswordStrengthMeter.module.css'

type PasswordStrengthMeterProps = {
  id: string
  password: string
}

function Requirement({
  met,
  active,
  children,
}: {
  met: boolean
  active: boolean
  children: string
}) {
  return (
    <li className={`${styles.requirement} ${active && met ? styles.met : ''}`}>
      <span className={styles.requirementIcon} aria-hidden="true">
        {active && met ? <Check size={13} strokeWidth={2.5} /> : <Circle size={11} strokeWidth={2} />}
      </span>
      <span>{children}</span>
    </li>
  )
}

export default function PasswordStrengthMeter({ id, password }: PasswordStrengthMeterProps) {
  const [evaluate, setEvaluate] = useState<
    ((value: string) => PasswordStrengthEvaluation) | null
  >(null)
  const [loadError, setLoadError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const loadPromise = useRef<Promise<typeof import('../password-strength')> | null>(null)
  const assessment = getPasswordAssessment(password)
  const hasInput = password.length > 0

  useEffect(() => {
    if (!hasInput) return

    let active = true
    loadPromise.current ??= import('../password-strength').catch((error: unknown) => {
      loadPromise.current = null
      throw error
    })
    void loadPromise.current
      .then(({ evaluatePasswordStrength }) => {
        if (active) {
          setEvaluate(() => evaluatePasswordStrength)
          setLoadError(false)
        }
      })
      .catch(() => {
        if (active) setLoadError(true)
      })

    return () => {
      active = false
    }
  }, [hasInput, retryKey])

  function retryEvaluation() {
    setLoadError(false)
    setRetryKey((current) => current + 1)
  }

  const evaluation = useMemo(
    () => {
      if (!hasInput || !evaluate) return null
      try {
        return evaluate(password)
      } catch {
        return null
      }
    },
    [evaluate, hasInput, password],
  )
  const evaluationError = hasInput && evaluate !== null && evaluation === null
  const score = evaluation?.display.score ?? null
  const loading = hasInput && !evaluate && !loadError
  const label = !hasInput
    ? 'Chưa nhập'
    : loading
      ? 'Đang đánh giá…'
      : loadError || evaluationError
        ? 'Chưa thể đánh giá'
        : evaluation?.display.label ?? 'Đang đánh giá…'
  const progress = evaluation?.display.progress ?? 0

  return (
    <section className={styles.meter} id={id} aria-label="Đánh giá mật khẩu">
      <div className={styles.meterHeading}>
        <span className={styles.meterTitle}>Độ mạnh mật khẩu</span>
        <span
          className={`${styles.strengthLabel} ${score === null ? '' : styles[`scoreLabel${score}`]}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {label}
        </span>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label="Độ mạnh mật khẩu"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score ?? undefined}
        aria-valuetext={label}
      >
        <span
          className={`${styles.progressBar} ${score === null ? '' : styles[`score${score}`]}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className={styles.checks} aria-label="Điều kiện bắt buộc và gợi ý tăng độ mạnh">
        <Requirement active={hasInput} met={assessment.criteria.minLength}>8+ ký tự</Requirement>
        <Requirement active={hasInput} met={assessment.criteria.uppercase}>A - Z</Requirement>
        <Requirement active={hasInput} met={assessment.criteria.lowercase}>a - z</Requirement>
        <Requirement active={hasInput} met={assessment.criteria.number}>0 - 9</Requirement>
        <Requirement active={hasInput} met={assessment.criteria.special}>@#$</Requirement>
      </ul>
      {hasInput && (loadError || evaluationError) ? (
        <div className={styles.loadError}>
          <p role="status">Không thể đánh giá độ mạnh.</p>
          <button type="button" onClick={retryEvaluation}>Thử lại đánh giá</button>
        </div>
      ) : null}
    </section>
  )
}
