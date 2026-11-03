export type PasswordRequirements = {
  minLength: boolean
  maxLength: boolean
  maxUtf8Bytes: boolean
}

export function getPasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    maxLength: password.length <= 72,
    maxUtf8Bytes: new TextEncoder().encode(password).length <= 72,
  }
}
