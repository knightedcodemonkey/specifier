import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { readFile } from 'node:fs/promises'

import { specifier } from '../src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fixtures = resolve(__dirname, '__fixtures__')
const { updateSrc } = specifier

describe('updateSrc', () => {
  it('accepts source code as a string instead of a filename', async () => {
    const source = (await readFile(join(fixtures, 'types.d.ts'))).toString()
    const { code } = await updateSrc(
      source,
      ({ value }) => {
        if (value === './some-types.js') {
          return './types.cjs'
        }
      },
      { dts: true },
    )

    assert.ok(code.indexOf('./types.cjs') > -1)
  })

  it('reports errors from parsing of the code in an object', async () => {
    let ret = await updateSrc('const foo = "')

    assert.equal(ret.code, undefined)
    assert.equal(ret.error, true)
    assert.ok(ret.msg.startsWith('Unterminated string constant'))
    assert.ok(typeof ret.syntaxError.reasonCode === 'string')
    assert.ok(Number.isFinite(ret.syntaxError.pos))
    assert.ok(ret.syntaxError.loc !== null && typeof ret.syntaxError.loc === 'object')
  })

  it('supports a mapper regex object instead of callback', async () => {
    const source = (await readFile(join(fixtures, 'mapper.js'))).toString()
    const { code } = await updateSrc(source, {
      foo: 'bar',
      dynamic: './import.js',
    })

    assert.ok(code.indexOf('bar') > -1)
    assert.ok(code.indexOf('./import.js') > -1)

    // Check error handling when converting the map
    const ret = await updateSrc(source, {
      ')': './invalid-regex.js',
    })

    assert.equal(ret.error, true)
    assert.ok(ret.msg.indexOf('Invalid regular expression') > -1)
  })

  it('allows options to return source mappings', async () => {
    const source = (await readFile(join(fixtures, 'importDeclaration.js'))).toString()
    const { code, map } = await updateSrc(
      source,
      () => {
        return './source-maps.js'
      },
      { sourceMap: true },
    )

    assert.ok(code.indexOf('./source-maps.js') > -1)
    assert.ok(typeof map.mappings === 'string')

    const { map: noMap } = await updateSrc(source, { '': '' }, { sourceMap: false })

    assert.equal(noMap, null)
  })
})
