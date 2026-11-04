import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Circle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('auth')
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
    ? t('strengthEmpty')
    : loading
      ? t('strengthLoading')
      : loadError || evaluationError
        ? t('strengthUnavailable')
        : score !== null
          ? t(`strengthLevel${score}`)
          : t('strengthLoading')
  const progress = evaluation?.display.progress ?? 0

  return (
    <section className={styles.meter} id={id} aria-label={t('strengthSectionLabel')}>
      <div className={styles.meterHeading}>
        <span className={styles.meterTitle}>{t('strengthTitle')}</span>
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
        aria-label={t('strengthTitle')}
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

      <ul className={styles.checks} aria-label={t('strengthChecksLabel')}>
        <Requirement active={hasInput} met={assessment.criteria.minLength}>{t('strengthMinLength')}</Requirement>
        <Requirement active={hasInput} met={assessment.criteria.uppercase}>A - Z</Requirement>
        <Requirement active={hasInput} met={assessment.criteria.lowercase}>a - z</Requirement>
        <Requirement active={hasInput} met={assessment.criteria.number}>0 - 9</Requirement>
        <Requirement active={hasInput} met={assessment.criteria.special}>@#$</Requirement>
      </ul>
      {hasInput && (loadError || evaluationError) ? (
        <div className={styles.loadError}>
          <p role="status">{t('strengthLoadError')}</p>
                    <button type="button" onClick={retryEvaluation}>{t('strengthRetry')}</button>
        </div>
      ) : null}
    </section>
  )
}
