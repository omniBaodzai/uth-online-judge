import { ZxcvbnFactory } from '@zxcvbn-ts/core'
import * as commonPackage from '@zxcvbn-ts/language-common'
import { getPasswordAssessment, type PasswordAssessment } from './password-policy'

const strengthEstimator = new ZxcvbnFactory({ ...commonPackage })
const strengthLabels = ['Rất yếu', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh'] as const

export type StrengthScore = 0 | 1 | 2 | 3 | 4

export type PasswordStrengthDisplay = {
  score: StrengthScore | null
  label: string
  progress: number
}

export type PasswordStrengthEvaluation = PasswordAssessment & {
  zxcvbnScore: StrengthScore
  display: PasswordStrengthDisplay
}

export function getPasswordStrengthDisplay(
  zxcvbnScore: StrengthScore,
  criteriaCount: number,
  policyValid: boolean,
  hasInput: boolean,
): PasswordStrengthDisplay {
  if (!hasInput) {
    return { score: null, label: 'Chưa nhập', progress: 0 }
  }

  const criteriaMaxScore = Math.max(0, Math.min(4, criteriaCount - 1)) as StrengthScore
  const policyMaxScore: StrengthScore = policyValid ? 4 : 3
  const score = Math.min(zxcvbnScore, criteriaMaxScore, policyMaxScore) as StrengthScore

  return {
    score,
    label: strengthLabels[score],
    progress: ((score + 1) / strengthLabels.length) * 100,
  }
}

export function evaluatePasswordStrength(password: string): PasswordStrengthEvaluation {
  const { score: zxcvbnScore } = strengthEstimator.check(password)
  const assessment = getPasswordAssessment(password)

  return {
    ...assessment,
    zxcvbnScore,
    display: getPasswordStrengthDisplay(
      zxcvbnScore,
      assessment.criteriaCount,
      assessment.requirements.minLength
        && assessment.requirements.maxLength
        && assessment.requirements.maxUtf8Bytes,
      password.length > 0,
    ),
  }
}
