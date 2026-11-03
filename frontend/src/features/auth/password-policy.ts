export type PasswordRequirements = {
  minLength: boolean
  maxLength: boolean
  maxUtf8Bytes: boolean
}

export type PasswordStrengthCriteria = {
  minLength: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  special: boolean
}

export type PasswordAssessment = {
  requirements: PasswordRequirements
  criteria: PasswordStrengthCriteria
  criteriaCount: number
}

export function getPasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    maxLength: password.length <= 72,
    maxUtf8Bytes: new TextEncoder().encode(password).length <= 72,
  }
}

export function getPasswordAssessment(password: string): PasswordAssessment {
  const requirements = getPasswordRequirements(password)
  const criteria: PasswordStrengthCriteria = {
    minLength: requirements.minLength,
    uppercase: /\p{Lu}/u.test(password),
    lowercase: /\p{Ll}/u.test(password),
    number: /\p{N}/u.test(password),
    special: /[^\p{L}\p{N}]/u.test(password),
  }

  return {
    requirements,
    criteria,
    criteriaCount: Object.values(criteria).filter(Boolean).length,
  }
}
