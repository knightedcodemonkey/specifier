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
    const { code, error } = await updateSrc(
      source,
      ({ value }) => {
        if (value === './user.js') {
          return './types.cjs'
        }
      },
      { dts: true },
    )

    assert.equal(error, undefined)

    if (code) {
      assert.ok(code.indexOf('./types.cjs') > -1)
    }
  })

  it('reports errors from parsing of the code in an object', async () => {
    const { code, error } = await updateSrc('const foo = "', {})

    assert.equal(code, undefined)
    assert.equal(error?.error, true)
    assert.ok(error?.msg.startsWith('Unterminated string constant'))
    assert.ok(typeof error?.syntaxError?.reasonCode === 'string')
    assert.ok(typeof error?.syntaxError?.code === 'string')
  })

  it('supports a mapper regex object instead of callback', async () => {
    const source = (await readFile(join(fixtures, 'mapper.js'))).toString()
    const { code, error } = await updateSrc(source, {
      foo: 'bar',
      dynamic: './import.js',
    })

    assert.equal(error, undefined)

    if (code) {
      assert.ok(code.indexOf('bar') > -1)
      assert.ok(code.indexOf('./import.js') > -1)
    }

    // Check error handling when converting the map
    const ret = await updateSrc(source, {
      ')': './invalid-regex.js',
    })

    assert.equal(ret.error?.error, true)
    assert.ok(ret.error?.msg.indexOf('Invalid regular expression') > -1)
  })

  it('allows options to return source mappings', async () => {
    const source = (await readFile(join(fixtures, 'importDeclaration.js'))).toString()
    const { code, map, error } = await updateSrc(
      source,
      () => {
        return './source-maps.js'
      },
      { sourceMap: true },
    )

    assert.equal(error, undefined)

    if (code && map) {
      assert.ok(code.indexOf('./source-maps.js') > -1)
      assert.ok(typeof map.mappings === 'string')
    } else {
      assert.fail('Expected code and map.')
    }

    const { map: noMap } = await updateSrc(source, { '': '' }, { sourceMap: false })

    assert.equal(noMap, null)
  })
})
