import { describe, expect, it } from 'vitest'
import {
  evaluatePasswordStrength,
  getPasswordStrengthDisplay,
} from './password-strength'

describe('password strength evaluation', () => {
  it('keeps an empty password neutral', () => {
    const result = evaluatePasswordStrength('')

    expect(result.display).toEqual({
      score: null,
      label: 'Chưa nhập',
      progress: 0,
    })
    expect(result.criteriaCount).toBe(0)
  })

  it.each([
    [1, 'Rất yếu', 20],
    [2, 'Yếu', 40],
    [3, 'Trung bình', 60],
    [4, 'Mạnh', 80],
    [5, 'Rất mạnh', 100],
  ] as const)(
    'caps zxcvbn score 4 at %i/5 criteria and keeps label/progress aligned',
    (criteriaCount, label, progress) => {
      expect(getPasswordStrengthDisplay(4, criteriaCount, true, true)).toEqual({
        score: criteriaCount - 1,
        label,
        progress,
      })
    },
  )

  it.each([
    ['漢字漢字漢字漢字', 1],
    ['abcdefgh', 2],
    ['abcdefg1', 3],
    ['abcdefg1!', 4],
    ['J8!vQ2#rLm5@', 5],
  ] as const)(
    'counts the expected composition criteria for %s',
    (password, count) => {
      const result = evaluatePasswordStrength(password)

      expect(result.criteriaCount).toBe(count)
      expect(result.display.score).toBeLessThanOrEqual(Math.max(0, count - 1))
    },
  )

  it('does not rate a common composition-pattern password as very strong', () => {
    const result = evaluatePasswordStrength('Password123!')

    expect(result.criteriaCount).toBe(5)
    expect(result.zxcvbnScore).toBeLessThan(4)
    expect(result.display.label).toBe('Yếu')
    expect(result).not.toHaveProperty('password')
  })

  it('recognizes repeated and sequential patterns as weak', () => {
    const repeated = evaluatePasswordStrength('aaaaaaaaaaaa')
    const sequential = evaluatePasswordStrength('abcdef123456')

    expect(repeated.zxcvbnScore).toBeLessThanOrEqual(1)
    expect(sequential.zxcvbnScore).toBeLessThanOrEqual(2)
  })

  it('evaluates a long passphrase and handles Unicode locally', () => {
    const passphrase = evaluatePasswordStrength('Lantern meadow orbit velvet compass')
    const unicode = evaluatePasswordStrength('đường-mây-rừng-sông-2026')

    expect(passphrase.zxcvbnScore).toBeGreaterThanOrEqual(3)
    expect(unicode.zxcvbnScore).toBeGreaterThanOrEqual(0)
    expect(unicode.requirements.maxUtf8Bytes).toBe(true)
  })

  it('can rate a long lowercase-only passphrase very strong without composition rules', () => {
    const result = evaluatePasswordStrength(
      'thisisaverylonglowercasepassphrasewithuncommonwords',
    )

    expect(result.zxcvbnScore).toBe(4)
    expect(result.criteriaCount).toBe(2)
    expect(result.display).toEqual({
      score: 1,
      label: 'Yếu',
      progress: 40,
    })
    expect(result.requirements).toEqual({
      minLength: true,
      maxLength: true,
      maxUtf8Bytes: true,
    })
  })

  it('evaluates mixed-character passwords with the same guessability scoring', () => {
    const result = evaluatePasswordStrength('J8!vQ2#rLm5@')

    expect(result.zxcvbnScore).toBe(4)
    expect(result.criteriaCount).toBe(5)
    expect(result.display).toEqual({
      score: 4,
      label: 'Rất mạnh',
      progress: 100,
    })
    expect(result.requirements).toEqual({
      minLength: true,
      maxLength: true,
      maxUtf8Bytes: true,
    })
  })

  it('reports policy failures independently from the strength score', () => {
    const tooShort = evaluatePasswordStrength('short')
    const tooLong = evaluatePasswordStrength(
      'mN7#qZ2!xR9@kL5$wP3^cT8&vB1fG4!pX9@rC2#vM6$kT1&nH8^wA3!dJ7@qS5#yL2%uE6&zP9!xQ4@vB8$',
    )

    expect(tooShort.requirements.minLength).toBe(false)
    expect(tooLong.requirements.maxLength).toBe(false)
    expect(tooLong.zxcvbnScore).toBe(4)
    expect(tooLong.criteriaCount).toBe(5)
    expect(tooLong.display).toEqual({
      score: 3,
      label: 'Mạnh',
      progress: 80,
    })
    expect(tooShort.display.score).toBeLessThan(4)
  })

  it('does not display very strong when the UTF-8 byte limit is exceeded', () => {
    const result = evaluatePasswordStrength('éA1!'.repeat(15))

    expect(result.requirements.maxLength).toBe(true)
    expect(result.requirements.maxUtf8Bytes).toBe(false)
    expect(result.criteriaCount).toBe(5)
    expect(result.display.score).toBeLessThan(4)
  })

  it('reports the byte limit for an oversized Unicode password', () => {
    const result = evaluatePasswordStrength('😀'.repeat(19))

    expect(result.requirements.maxUtf8Bytes).toBe(false)
  })
})
