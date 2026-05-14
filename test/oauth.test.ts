import { describe, it, expect } from 'vitest'
import { extractCodeFromCallbackUrl } from '../src/auth/flow.js'

describe('extractCodeFromCallbackUrl', () => {
  it('extracts code and state from a valid callback URL', () => {
    const url = 'https://auth.tesla.com/void/callback?code=abc123&state=xyz789'
    const result = extractCodeFromCallbackUrl(url)
    expect(result).toEqual({ code: 'abc123', state: 'xyz789' })
  })

  it('returns null for a URL missing the code param', () => {
    expect(extractCodeFromCallbackUrl('https://auth.tesla.com/void/callback?state=xyz')).toBeNull()
  })

  it('returns null for a URL missing the state param', () => {
    expect(extractCodeFromCallbackUrl('https://auth.tesla.com/void/callback?code=abc')).toBeNull()
  })

  it('returns null for a completely invalid string', () => {
    expect(extractCodeFromCallbackUrl('not a url')).toBeNull()
  })

  it('handles extra query params', () => {
    const url = 'https://auth.tesla.com/void/callback?code=abc&state=xyz&issuer=tesla'
    const result = extractCodeFromCallbackUrl(url)
    expect(result).toEqual({ code: 'abc', state: 'xyz' })
  })
})
