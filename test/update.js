import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

import { specifier } from '../src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fixtures = resolve(__dirname, '__fixtures__')
const { update } = specifier

describe('update', () => {
  it('updates specifiers in import declarations', async () => {
    const code = await update(join(fixtures, 'importDeclaration.js'), spec => {
      return spec.value.replace(/(.+)\.js$/, '$1.mjs')
    })

    assert.ok(code.indexOf('./path/to/module.mjs') > -1)
  })

  it('updates specifiers in export named declrations', async () => {
    const code = await update(join(fixtures, 'exportNamedDeclaration.js'), spec => {
      if (spec.loc.start.line === 2) {
        return './other-module.js'
      }
    })

    assert.ok(code.indexOf('./other-module.js') > -1)
  })

  it('updates specifiers in export all declarations', async () => {
    const code = await update(join(fixtures, 'exportAllDeclaration.js'), spec => {
      if (spec.value.indexOf('other') > -1) {
        return './other.cjs'
      }

      return spec.value.replace(/(.+)\.js$/, '$1.cjs')
    })

    assert.ok(code.indexOf('./path/to/module.cjs') > -1)
    assert.ok(code.indexOf('./other.cjs') > -1)
  })

  it('updates specifiers in import expressions', async () => {
    const lit = './dynamic/import.js'
    const be = "'./module.cjs'"
    const ne = 'new String("foo")'
    const tl = './foo/${bar}.mjs'
    const code = await update(join(fixtures, 'importExpression.js'), spec => {
      switch (spec.type) {
        case 'StringLiteral':
          return lit
        case 'BinaryExpression':
          return be
        case 'NewExpression':
          return ne
        case 'TemplateLiteral':
          return tl
      }
    })

    assert.ok(code.indexOf(lit) > -1)
    assert.ok(code.indexOf(be) > -1)
    assert.ok(code.indexOf(ne) > -1)
    assert.ok(code.indexOf(tl) > -1)
  })

  it('returns an object when errors happen', async () => {
    let ret = await update('/foo')

    assert.equal(ret.error, true)
    assert.equal(ret.msg, 'The provided path /foo does not resolve to a file on disk.')

    ret = await update('test/__fixtures__')

    assert.equal(ret.error, true)
    assert.equal(ret.msg, 'The provided path test/__fixtures__ is not a file.')

    ret = await update('test/__fixtures__/syntaxError.js')

    assert.equal(ret.error, true)
    assert.ok(typeof ret.errorContext.reasonCode === 'string')
    assert.ok(Number.isFinite(ret.errorContext.pos))
    assert.ok(ret.errorContext.loc !== null && typeof ret.errorContext.loc === 'object')
  })

  it('works with typescript', async () => {
    const code = await update(join(fixtures, 'types.d.ts'), spec => {
      if (spec.value === './user') {
        return './user.mjs'
      }

      if (spec.value.includes('some-types')) {
        return './other-types.js'
      }
    })

    assert.ok(code.indexOf('./user.mjs') > -1)
    assert.ok(code.indexOf('./other-types.js') > -1)
  })

  it('wraps specifier.mapper if second arg is an object', async () => {
    const code = await update(join(fixtures, 'importDeclaration.js'), {
      '([^.]+)\\.js$': '$1.cjs',
    })

    assert.ok(code.indexOf('./path/to/module.cjs') > -1)
  })

  it('updates id strings in require expressions', async () => {
    const code = await update(join(fixtures, 'require.js'), spec => {
      // Collapse any BinaryExpression or NewExpression first
      const collapsed = spec.value.replace(/['"`+)\s]|new String\(/g, '')
      const relativeIdRegex = /^(?:\.|\.\.)\//i

      if (relativeIdRegex.test(collapsed)) {
        // $2 is for any closing quotation/parens around BE or NE
        return spec.value.replace(/(.+)\.js([)'"`]*)?$/, '$1.cjs$2')
      }
    })

    assert.ok(code.indexOf('require("./folder/module.cjs")') > -1)
    assert.ok(code.indexOf("require(new String('./foo.cjs'))") > -1)
    assert.ok(code.indexOf('require(`./template/${string}.cjs`)') > -1)
    assert.ok(code.indexOf("require('./binary' + '/expression.cjs')") > -1)
    // Check that .mjs was left alone
    assert.ok(code.indexOf('require("./esm.mjs")') > -1)
  })
})