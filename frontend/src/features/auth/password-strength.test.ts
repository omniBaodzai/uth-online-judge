import { describe, expect, it } from 'vitest'
import { evaluatePasswordStrength } from './password-strength'

describe('password strength evaluation', () => {
  it('does not rate a common composition-pattern password as very strong', () => {
    const result = evaluatePasswordStrength('Password123!')

    expect(result.score).toBeLessThan(4)
    expect(result).not.toHaveProperty('password')
  })

  it('recognizes repeated and sequential patterns as weak', () => {
    const repeated = evaluatePasswordStrength('aaaaaaaaaaaa')
    const sequential = evaluatePasswordStrength('abcdef123456')

    expect(repeated.score).toBeLessThanOrEqual(1)
    expect(sequential.score).toBeLessThanOrEqual(2)
  })

  it('evaluates a long passphrase and handles Unicode locally', () => {
    const passphrase = evaluatePasswordStrength('Lantern meadow orbit velvet compass')
    const unicode = evaluatePasswordStrength('đường-mây-rừng-sông-2026')

    expect(passphrase.score).toBeGreaterThanOrEqual(3)
    expect(unicode.score).toBeGreaterThanOrEqual(0)
    expect(unicode.requirements.maxUtf8Bytes).toBe(true)
  })

  it('reports the byte limit for an oversized Unicode password', () => {
    const result = evaluatePasswordStrength('😀'.repeat(19))

    expect(result.requirements.maxUtf8Bytes).toBe(false)
  })
})
