import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { config } from '../config.js'

export interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number  // Unix ms
}

const tokenPath = () => join(config.dataDir, 'tokens.json')

export async function loadTokens(): Promise<TokenSet | null> {
  try {
    const raw = await readFile(tokenPath(), 'utf-8')
    return JSON.parse(raw) as TokenSet
  } catch {
    return null
  }
}

export async function saveTokens(tokens: TokenSet): Promise<void> {
  await mkdir(config.dataDir, { recursive: true })
  await writeFile(tokenPath(), JSON.stringify(tokens, null, 2), 'utf-8')
}

export async function clearTokens(): Promise<void> {
  try {
    await writeFile(tokenPath(), JSON.stringify(null), 'utf-8')
  } catch {
    // ignore if file doesn't exist
  }
}

export function isExpiringSoon(tokens: TokenSet): boolean {
  // Refresh if within 5 minutes of expiry
  return Date.now() >= tokens.expiresAt - 5 * 60 * 1000
}
