import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

import { specifier } from '../src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fixtures = resolve(__dirname, '__fixtures__')
const { mapper } = specifier

describe('mapper', () => {
  it('updates specifiers in a file given a map of regex to new value', async () => {
    const { code, error } = await mapper(join(fixtures, 'mapper.js'), {
      foo: 'bar',
      '(.+)\\${.+}(.+)?': '$1string$2',
      '^new String\\((.+)\\)$': '$1',
      "'(.+)'\\s*\\+\\s*'(.+)'": '"./be.js"',
      '([^.]+)\\.js$': '$1.cjs',
    })

    assert.equal(error, undefined)

    if (code) {
      assert.ok(code.indexOf('bar') > -1)
      assert.ok(code.indexOf('./module.cjs') > -1)
      assert.ok(code.indexOf('123.cjs') > -1)
      assert.ok(code.indexOf('./not-matched.mjs') > -1)
      assert.ok(code.indexOf('import(`./template/string.js`') > -1)
      // Binary expressions and new expressions need to return the "raw" value, i.e. including any quotes.
      assert.ok(code.indexOf('import("./be.js")') > -1)
      assert.ok(code.indexOf("import('./ctor.cjs')") > -1)
    }
  })

  it('returns an object when errors happen', async () => {
    let ret = await mapper('/foo', {})

    assert.equal(ret.error?.error, true)
    assert.equal(
      ret.error?.msg,
      'The provided path /foo does not resolve to a file on disk.',
    )

    ret = await mapper('test/__fixtures__', {})

    assert.ok(typeof ret.error === 'object')
    assert.equal(ret.error?.error, true)
    assert.equal(
      ret.error?.msg,
      'The provided path test/__fixtures__ does not resolve to a file on disk.',
    )

    ret = await mapper('test/__fixtures__/syntaxError.js', {})

    assert.equal(ret.error?.error, true)
    assert.equal(ret.error?.syntaxError?.reasonCode, 'UnterminatedString')

    ret = await mapper('test/__fixtures__/mapper.js', {
      '(': './invalid-regex.js',
    })

    assert.equal(ret.error?.error, true)
    assert.ok(ret.error?.msg.indexOf('Invalid regular expression') > -1)
  })
})
