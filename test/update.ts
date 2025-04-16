import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

import { specifier } from '../src/specifier.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fixtures = resolve(__dirname, '__fixtures__')

describe('update', () => {
  it('updates specifiers in import declarations', async () => {
    const update = await specifier.update(
      join(fixtures, 'importDeclaration.js'),
      spec => {
        return spec.value.replace(/^\.(.+)\.js$/, '.$1.mjs')
      },
    )

    assert.ok(update.indexOf('./path/to/module.mjs') > -1)
  })

  it('updates specifiers in export named declarations', async () => {
    const update = await specifier.update(
      join(fixtures, 'exportNamedDeclaration.js'),
      spec => {
        if (spec.value === './path/to/module.js') {
          return './other-module.js'
        }
      },
    )

    assert.ok(update.indexOf('./other-module.js') > -1)
  })

  it('updates specifiers in export all declarations', async () => {
    const update = await specifier.update(
      join(fixtures, 'exportAllDeclaration.js'),
      spec => {
        if (spec.value.indexOf('other') > -1) {
          return './other.cjs'
        }

        return spec.value.replace(/(.+)\.js$/, '$1.cjs')
      },
    )

    assert.ok(update.indexOf('./path/to/module.cjs') > -1)
    assert.ok(update.indexOf('./other.cjs') > -1)
  })

  it('updates specifiers in import expressions', async () => {
    const lit = './dynamic/import.js'
    const be = "'./module.cjs'"
    const ne = 'new String("foo")'
    const tl = './foo/${bar}.mjs'
    const update = await specifier.update(join(fixtures, 'importExpression.js'), spec => {
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

    assert.ok(update.indexOf(lit) > -1)
    assert.ok(update.indexOf(be) > -1)
    assert.ok(update.indexOf(ne) > -1)
    assert.ok(update.indexOf(tl) > -1)
  })

  it('updates complex import expressions', async () => {
    const update = await specifier.update(
      join(fixtures, 'complexImportExpression.ts'),
      spec => {
        if (spec.value === './user.js') {
          return './other-user.js'
        }

        if (spec.value === './code.js') {
          return './other-code.js'
        }
      },
    )

    assert.ok(update.indexOf('./other-user.js') > -1)
    assert.equal([...update.matchAll(/other-code\.js/g)].length, 5)
  })

  it('works with typescript', async () => {
    let update = await specifier.update(join(fixtures, 'types.d.ts'), spec => {
      if (spec.value === './user.js') {
        return './user.mjs'
      }
    })

    assert.ok(update.match(/\.\/user\.mjs/g)?.length === 2)
    update = await specifier.update(join(fixtures, 'code.ts'), () => {
      return './types.js'
    })
    assert.ok(update.indexOf('./types.js') ?? 1 > -1)
  })

  it('works with jsx', async () => {
    const update = await specifier.update(join(fixtures, 'jsx.jsx'), () => {
      return './jsx.js'
    })

    assert.equal(update.match(/\.\/jsx\.js/g)?.length, 2)
  })

  it('updates id strings in require expressions', async () => {
    const update = await specifier.update(join(fixtures, 'require.js'), spec => {
      // Collapse any BinaryExpression or NewExpression first
      const collapsed = spec.value.replace(/['"`+)\s]|new String\(/g, '')
      const relativeIdRegex = /^(?:\.|\.\.)\//i

      if (relativeIdRegex.test(collapsed)) {
        // $2 is for any closing quotation/parens around BE or NE
        return spec.value.replace(/(.+)\.js([)'"`]*)?$/, '$1.cjs$2')
      }
    })

    assert.ok(update.indexOf('require("./folder/module.cjs")') > -1)
    assert.ok(update.indexOf("require(new String('./foo.cjs'))") > -1)
    assert.ok(update.indexOf('require(`./template/${string}.cjs`)') > -1)
    assert.ok(update.indexOf("require('./binary' + '/expression.cjs')") > -1)
    // Check that .mjs was left alone
    assert.ok(update.indexOf('require("./esm.mjs")') > -1)
  })

  it('updates complex require expressions', async () => {
    const update = await specifier.update(join(fixtures, 'complexRequire.js'), spec => {
      if (spec.value === './user.js') {
        return './other-user.js'
      }

      if (spec.value === './code.js') {
        return './other-code.js'
      }
    })

    assert.ok(update.indexOf('./other-user.js') > -1)
    assert.equal([...update.matchAll(/other-code\.js/g)].length, 3)
  })

  it('updates `resolve` from different module types', async () => {
    const update = await specifier.update(join(fixtures, 'modules.js'), ({ value }) => {
      if (value === './require/file.js') {
        return './require-test.js'
      }

      if (value === './meta/file.js') {
        return './meta-test.js'
      }

      if (value === './skip/file.js') {
        throw new Error('should have skipped this')
      }
    })

    assert.ok(update.indexOf('./require-test.js') > -1)
    assert.ok(update.indexOf('./meta-test.js') > -1)
  })

  it('throws an error if the file does not exist', async () => {
    await assert.rejects(
      () => specifier.update(join(fixtures, 'does-not-exist.js'), () => {}),
      {
        message: /The provided path .+ does not resolve to a file on disk\./,
      },
    )
  })

  it('throws an error if the file is a directory', async () => {
    await assert.rejects(() => specifier.update(fixtures, () => {}), {
      message: /The provided path .+ does not resolve to a file on disk\./,
    })
  })
})
