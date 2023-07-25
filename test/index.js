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
  it('updates specifiers in a import declarations', async () => {
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
        case 'Literal':
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
    assert.ok(Number.isFinite(ret.errorContext.pos))
    assert.ok(Number.isFinite(ret.errorContext.raisedAt))
    assert.ok(ret.errorContext.loc !== null && typeof ret.errorContext.loc === 'object')
  })
})
