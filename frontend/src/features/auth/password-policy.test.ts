import { describe, expect, it } from 'vitest'
import { getPasswordRequirements } from './password-policy'

describe('password requirements', () => {
  it('keeps an empty password neutral for the minimum requirement', () => {
    expect(getPasswordRequirements('')).toEqual({
      minLength: false,
      maxLength: true,
      maxUtf8Bytes: true,
    })
  })

  it('checks the 8 to 72 character range without adding composition rules', () => {
    expect(getPasswordRequirements('short')).toEqual({
      minLength: false,
      maxLength: true,
      maxUtf8Bytes: true,
    })
    expect(getPasswordRequirements('12345678')).toEqual({
      minLength: true,
      maxLength: true,
      maxUtf8Bytes: true,
    })
    expect(getPasswordRequirements('a'.repeat(72)).maxLength).toBe(true)
    expect(getPasswordRequirements('a'.repeat(73)).maxLength).toBe(false)
  })

  it('checks the byte limit independently from character length for Unicode', () => {
    expect(getPasswordRequirements('é'.repeat(36))).toEqual({
      minLength: true,
      maxLength: true,
      maxUtf8Bytes: true,
    })
    expect(getPasswordRequirements('é'.repeat(37)).maxUtf8Bytes).toBe(false)
    expect(getPasswordRequirements('😀'.repeat(19)).maxUtf8Bytes).toBe(false)
  })
})
