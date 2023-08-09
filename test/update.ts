import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

import { specifier } from '../src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fixtures = resolve(__dirname, '__fixtures__')

describe('update', () => {
  it('updates specifiers in import declarations', async () => {
    const update = await specifier.update(
      join(fixtures, 'importDeclaration.js'),
      spec => {
        return spec.value.replace(/(.+)\.js$/, '$1.mjs')
      },
    )

    assert.ok(update.error === undefined)

    if (update.code) {
      assert.ok(update.code.indexOf('./path/to/module.mjs') > -1)
    }
  })

  it('updates specifiers in export named declrations', async () => {
    const { code, error } = await specifier.update(
      join(fixtures, 'exportNamedDeclaration.js'),
      spec => {
        if (spec.loc.start.line === 2) {
          return './other-module.js'
        }
      },
    )

    assert.equal(error, undefined)

    if (code) {
      assert.ok(code.indexOf('./other-module.js') > -1)
    }
  })

  it('updates specifiers in export all declarations', async () => {
    const { code, error } = await specifier.update(
      join(fixtures, 'exportAllDeclaration.js'),
      spec => {
        if (spec.value.indexOf('other') > -1) {
          return './other.cjs'
        }

        return spec.value.replace(/(.+)\.js$/, '$1.cjs')
      },
    )

    assert.equal(error, undefined)

    if (code) {
      assert.ok(code.indexOf('./path/to/module.cjs') > -1)
      assert.ok(code.indexOf('./other.cjs') > -1)
    }
  })

  it('updates specifiers in import expressions', async () => {
    const lit = './dynamic/import.js'
    const be = "'./module.cjs'"
    const ne = 'new String("foo")'
    const tl = './foo/${bar}.mjs'
    const { code, error } = await specifier.update(
      join(fixtures, 'importExpression.js'),
      spec => {
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
      },
    )

    assert.equal(error, undefined)

    if (code) {
      assert.ok(code.indexOf(lit) > -1)
      assert.ok(code.indexOf(be) > -1)
      assert.ok(code.indexOf(ne) > -1)
      assert.ok(code.indexOf(tl) > -1)
    }
  })

  it('returns an object when errors happen', async () => {
    let ret = await specifier.update('/foo', {})

    assert.equal(ret.error?.error, true)
    assert.equal(
      ret.error?.msg,
      'The provided path /foo does not resolve to a file on disk.',
    )

    ret = await specifier.update('test/__fixtures__', {})

    assert.equal(ret.error?.error, true)
    assert.equal(
      ret.error?.msg,
      'The provided path test/__fixtures__ does not resolve to a file on disk.',
    )

    ret = await specifier.update('test/__fixtures__/syntaxError.js', {})

    assert.equal(ret.error?.error, true)
    assert.ok(typeof ret.error?.syntaxError?.reasonCode === 'string')
  })

  it('works with typescript', async () => {
    let update = await specifier.update(join(fixtures, 'types.d.ts'), spec => {
      if (spec.value === './user.js') {
        return './user.mjs'
      }
    })

    assert.equal(update.error, undefined)

    if (update.code) {
      assert.ok(update.code.match(/\.\/user\.mjs/g)?.length === 2)
    }

    update = await specifier.update('test/__fixtures__/code.ts', () => {
      return './types.js'
    })

    assert.equal(update.error, undefined)
    assert.ok(update.code?.indexOf('./types.js') ?? 1 > -1)
  })

  it('works with jsx', async () => {
    const { code, error } = await specifier.update(join(fixtures, 'jsx.jsx'), () => {
      return './jsx.js'
    })

    assert.equal(error, undefined)

    if (code) {
      assert.equal(code.match(/\.\/jsx\.js/g)?.length, 2)
    }
  })

  it('wraps specifier.mapper if second arg is an object', async () => {
    const { code, error } = await specifier.update(
      join(fixtures, 'importDeclaration.js'),
      {
        '([^.]+)\\.js$': '$1.cjs',
      },
    )

    assert.equal(error, undefined)
    assert.ok(code?.indexOf('./path/to/module.cjs') ?? 1 > -1)
  })

  it('updates id strings in require expressions', async () => {
    const { code, error } = await specifier.update(join(fixtures, 'require.js'), spec => {
      // Collapse any BinaryExpression or NewExpression first
      const collapsed = spec.value.replace(/['"`+)\s]|new String\(/g, '')
      const relativeIdRegex = /^(?:\.|\.\.)\//i

      if (relativeIdRegex.test(collapsed)) {
        // $2 is for any closing quotation/parens around BE or NE
        return spec.value.replace(/(.+)\.js([)'"`]*)?$/, '$1.cjs$2')
      }
    })

    assert.equal(error, undefined)

    if (code) {
      assert.ok(code.indexOf('require("./folder/module.cjs")') > -1)
      assert.ok(code.indexOf("require(new String('./foo.cjs'))") > -1)
      assert.ok(code.indexOf('require(`./template/${string}.cjs`)') > -1)
      assert.ok(code.indexOf("require('./binary' + '/expression.cjs')") > -1)
      // Check that .mjs was left alone
      assert.ok(code.indexOf('require("./esm.mjs")') > -1)
    }
  })
})
