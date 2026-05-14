import { describe, it, expect } from 'vitest'
import { isLanIp } from '../src/middleware/lanOnly.js'

describe('isLanIp', () => {
  it('allows 192.168.x.x', () => {
    expect(isLanIp('192.168.1.1')).toBe(true)
    expect(isLanIp('192.168.0.1')).toBe(true)
    expect(isLanIp('192.168.255.255')).toBe(true)
  })

  it('allows 10.x.x.x', () => {
    expect(isLanIp('10.0.0.1')).toBe(true)
    expect(isLanIp('10.255.255.255')).toBe(true)
    expect(isLanIp('10.43.0.100')).toBe(true)  // user's subnet
  })

  it('allows 172.16–31.x.x', () => {
    expect(isLanIp('172.16.0.1')).toBe(true)
    expect(isLanIp('172.31.255.255')).toBe(true)
  })

  it('rejects 172.15 and 172.32 (outside private range)', () => {
    expect(isLanIp('172.15.0.1')).toBe(false)
    expect(isLanIp('172.32.0.1')).toBe(false)
  })

  it('allows loopback', () => {
    expect(isLanIp('127.0.0.1')).toBe(true)
    expect(isLanIp('::1')).toBe(true)
  })

  it('allows IPv4-mapped loopback', () => {
    expect(isLanIp('::ffff:127.0.0.1')).toBe(true)
  })

  it('allows IPv4-mapped private addresses', () => {
    expect(isLanIp('::ffff:192.168.1.1')).toBe(true)
  })

  it('blocks public IPs', () => {
    expect(isLanIp('8.8.8.8')).toBe(false)
    expect(isLanIp('1.1.1.1')).toBe(false)
    expect(isLanIp('203.0.113.1')).toBe(false)
  })
})
