import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Circle } from 'lucide-react'
import { getPasswordRequirements } from '../password-policy'
import type { PasswordStrengthEvaluation } from '../password-strength'
import styles from './PasswordStrengthMeter.module.css'

type PasswordStrengthMeterProps = {
  id: string
  password: string
}

const strengthLabels = ['Rất yếu', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh'] as const

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
  const requirements = getPasswordRequirements(password)
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
  const score = evaluation?.score ?? null
  const loading = hasInput && !evaluate && !loadError
  const label = !hasInput
    ? 'Chưa nhập'
    : loading
      ? 'Đang đánh giá…'
      : loadError || evaluationError
        ? 'Chưa thể đánh giá'
        : strengthLabels[score ?? 0]
  const progress = score === null ? 0 : ((score + 1) / strengthLabels.length) * 100
  // const withinPolicy = requirements.minLength && requirements.maxLength && requirements.maxUtf8Bytes
  const upper = /\p{Lu}/u.test(password)
  const lower = /\p{Ll}/u.test(password)
  const number = /\p{N}/u.test(password)
  const special = /[^\p{L}\p{N}]/u.test(password)

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
        <Requirement active={hasInput} met={requirements.minLength}>8+ ký tự</Requirement>
        <Requirement active={hasInput} met={upper}>A - Z</Requirement>
        <Requirement active={hasInput} met={lower}>a - z</Requirement>
        <Requirement active={hasInput} met={number}>0 - 9</Requirement>
        <Requirement active={hasInput} met={special}>@#$</Requirement>
      </ul>
      {/* <p
        className={`${styles.policy} ${hasInput ? (withinPolicy ? styles.policyMet : styles.policyUnmet) : ''}`}
        aria-live="polite"
        aria-atomic="true"
      >
        {hasInput && withinPolicy ? <Check size={12} aria-hidden="true" /> : null}
        {hasInput && !withinPolicy ? <Circle size={12} aria-hidden="true" /> : null}
        Bắt buộc: 8–72 ký tự · ≤72 byte UTF-8
      </p> */}
      {hasInput && (loadError || evaluationError) ? (
        <div className={styles.loadError}>
          <p role="status">Không thể đánh giá độ mạnh.</p>
          <button type="button" onClick={retryEvaluation}>Thử lại đánh giá</button>
        </div>
      ) : null}
    </section>
  )
}
