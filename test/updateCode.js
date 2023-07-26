import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { readFile } from 'node:fs/promises'

import { specifier } from '../src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fixtures = resolve(__dirname, '__fixtures__')
const { updateCode } = specifier

describe('updateCode', () => {
  it('accepts source code as a string instead of a filename', async () => {
    const source = (await readFile(join(fixtures, 'code.ts'))).toString()
    const code = await updateCode(source, ({ value }) => {
      if (value === './types') {
        return './types.js'
      }
    })

    assert.ok(code.indexOf('./types.js') > -1)
  })

  it('reports errors from parsing of the code in an object', async () => {
    let ret = await updateCode('const foo = "')

    assert.equal(ret.error, true)
    assert.ok(ret.msg.startsWith('Unterminated string constant'))
    assert.ok(typeof ret.errorContext.reasonCode === 'string')
    assert.ok(Number.isFinite(ret.errorContext.pos))
    assert.ok(ret.errorContext.loc !== null && typeof ret.errorContext.loc === 'object')
  })
})
