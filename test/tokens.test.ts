import { describe, it, expect } from 'vitest'
import { isExpiringSoon } from '../src/auth/tokens.js'
import type { TokenSet } from '../src/auth/tokens.js'

describe('isExpiringSoon', () => {
  it('returns false when token expires in 10 minutes', () => {
    const tokens: TokenSet = {
      accessToken: 'tok',
      refreshToken: 'ref',
      expiresAt: Date.now() + 10 * 60 * 1000,
    }
    expect(isExpiringSoon(tokens)).toBe(false)
  })

  it('returns true when token expires in 4 minutes', () => {
    const tokens: TokenSet = {
      accessToken: 'tok',
      refreshToken: 'ref',
      expiresAt: Date.now() + 4 * 60 * 1000,
    }
    expect(isExpiringSoon(tokens)).toBe(true)
  })

  it('returns true when token is already expired', () => {
    const tokens: TokenSet = {
      accessToken: 'tok',
      refreshToken: 'ref',
      expiresAt: Date.now() - 1000,
    }
    expect(isExpiringSoon(tokens)).toBe(true)
  })
})
