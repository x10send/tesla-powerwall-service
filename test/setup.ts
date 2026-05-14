import { mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Each test file runs in its own fork. Give it a unique DATA_DIR so parallel
// test files don't race on the same tokens.json / config.json files.
const dir = join(tmpdir(), `powerwall-test-${process.pid}`)
mkdirSync(dir, { recursive: true })
process.env['DATA_DIR'] = dir
