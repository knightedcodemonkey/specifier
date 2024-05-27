import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolve, join } from 'node:path'
import { readFile } from 'node:fs/promises'

import { specifier } from '../src/index.js'
import { parse } from '../src/parse.js'

const fixtures = resolve(import.meta.dirname, '__fixtures__')
const { updateAst } = specifier

describe('updateAst', () => {
  it('accepts a babel AST', async () => {
    const source = (await readFile(join(fixtures, 'importDeclaration.js'))).toString()
    const ast = parse(source)
    const { code, error } = await updateAst(ast, source, ({ value }) => {
      if (value === './path/to/module.js') {
        return './ast-test.js'
      }
    })

    assert.equal(error, undefined)

    if (code) {
      assert.ok(code.indexOf('./ast-test.js') > -1)
    }
  })

  it('updates resolve from different module types', async () => {
    const source = (await readFile(join(fixtures, 'modules.js'))).toString()
    const ast = parse(source)
    const { code, error } = await updateAst(ast, source, ({ value }) => {
      if (value === './require/file.js') {
        return './require-test.js'
      }

      if (value === './meta/file.js') {
        return './meta-test.js'
      }
    })

    assert.equal(error, undefined)

    if (code) {
      assert.ok(code.indexOf('./require-test.js') > -1)
      assert.ok(code.indexOf('./meta-test.js') > -1)
      assert.ok(code.indexOf('./skip/file.js') > -1)
    }
  })
})
