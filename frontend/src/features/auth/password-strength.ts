import { ZxcvbnFactory } from '@zxcvbn-ts/core'
import * as commonPackage from '@zxcvbn-ts/language-common'
import { getPasswordRequirements, type PasswordRequirements } from './password-policy'

const strengthEstimator = new ZxcvbnFactory({ ...commonPackage })

export type PasswordStrengthEvaluation = {
  score: 0 | 1 | 2 | 3 | 4
  requirements: PasswordRequirements
}

export function evaluatePasswordStrength(password: string): PasswordStrengthEvaluation {
  const { score } = strengthEstimator.check(password)

  return {
    score,
    requirements: getPasswordRequirements(password),
  }
}
