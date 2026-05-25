import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { readFile } from 'node:fs/promises'

import { specifier } from '../src/specifier.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fixtures = resolve(__dirname, '__fixtures__')

describe('updateSrc', () => {
  it('upates ts source code', async () => {
    const source = (await readFile(join(fixtures, 'types.d.ts'))).toString()
    const update = await specifier.updateSrc(source, 'ts', ({ value }) => {
      if (value === './user.js') {
        return './types.cjs'
      }
    })

    assert.ok(update.indexOf('./types.cjs') > -1)
  })

  it('updates js source code', async () => {
    const source = (await readFile(join(fixtures, 'importDeclaration.js'))).toString()
    const update = await specifier.updateSrc(source, 'js', spec => {
      return spec.value.replace(/^\.(.+)\.js$/, '.$1.mjs')
    })

    assert.ok(update.indexOf('./path/to/module.mjs') > -1)
  })

  it('updates tsx source code', async () => {
    const update = await specifier.updateSrc(
      `
        import { useState } from 'react'
        import './path/to/module.js'

        const Component = () => {
          const [state, setState] = useState<string>('Hello World')

          return (
            <div>
              <h1>{state}</h1>
            </div>
          )
        }

        export default Component
      `,
      'tsx',
      spec => {
        if (spec.value === './path/to/module.js') {
          return './path/to/module.mjs'
        }
      },
    )

    assert.ok(update.indexOf('./path/to/module.mjs') > -1)
  })

  it('updates jsx source code', async () => {
    const update = await specifier.updateSrc(
      `
        import { useState } from 'react'
        import './path/to/module.js'

        const Component = () => {
          const [state, setState] = useState('Hello World')

          return (
            <div>
              <h1>{state}</h1>
            </div>
          )
        }

        export default Component
      `,
      'jsx',
      spec => {
        if (spec.value === './path/to/module.js') {
          return './path/to/module.mjs'
        }

        if (spec.value === 'react') {
          return 'preact'
        }
      },
    )

    assert.ok(update.indexOf('./path/to/module.mjs') > -1)
    assert.ok(update.indexOf('preact') > -1)
    assert.ok(update.indexOf("import 'react'") === -1)
  })

  it('updates createRequire alias calls', async () => {
    const update = await specifier.updateSrc(
      `
        import { createRequire } from 'node:module'
        const loader = createRequire(import.meta.url)
        loader('./some/file.js')
      `,
      'js',
      spec => {
        return spec.value.replace('.js', '.mjs')
      },
    )

    assert.ok(update.indexOf("loader('./some/file.mjs')") > -1)
  })

  it('updates renamed createRequire alias calls', async () => {
    const update = await specifier.updateSrc(
      `
        import { createRequire as makeRequire } from 'module'
        const load = makeRequire(import.meta.url)
        load('./renamed.js')
      `,
      'js',
      spec => {
        return spec.value.replace('.js', '.mjs')
      },
    )

    assert.ok(update.indexOf("load('./renamed.mjs')") > -1)
  })

  it('updates createRequire resolve calls', async () => {
    const update = await specifier.updateSrc(
      `
        import { createRequire } from 'node:module'
        const loader = createRequire(import.meta.url)
        loader.resolve('./resolve.js')
      `,
      'js',
      spec => {
        return spec.value.replace('.js', '.mjs')
      },
    )

    assert.ok(update.indexOf("loader.resolve('./resolve.mjs')") > -1)
  })

  it('does not rewrite shadowed createRequire aliases', async () => {
    const update = await specifier.updateSrc(
      `
        import { createRequire } from 'node:module'
        const loader = createRequire(import.meta.url)
        {
          const loader = value => value
          loader('./skip.js')
        }
        loader('./keep.js')
      `,
      'js',
      spec => {
        return spec.value.replace('.js', '.mjs')
      },
    )

    assert.ok(update.indexOf("loader('./skip.js')") > -1)
    assert.ok(update.indexOf("loader('./keep.mjs')") > -1)
  })

  it('stops rewriting after createRequire alias reassignment', async () => {
    const update = await specifier.updateSrc(
      `
        import { createRequire } from 'node:module'
        let loader = createRequire(import.meta.url)
        loader('./before.js')
        loader = value => value
        loader('./after.js')
      `,
      'js',
      spec => {
        return spec.value.replace('.js', '.mjs')
      },
    )

    assert.ok(update.indexOf("loader('./before.mjs')") > -1)
    assert.ok(update.indexOf("loader('./after.js')") > -1)
  })

  it('updates require identifier created from createRequire', async () => {
    const update = await specifier.updateSrc(
      `
        import { createRequire } from 'node:module'
        let require = createRequire(import.meta.url)
        require('./before.js')
        require = value => value
        require('./after.js')
      `,
      'js',
      spec => {
        return spec.value.replace('.js', '.mjs')
      },
    )

    assert.ok(update.indexOf("require('./before.mjs')") > -1)
    assert.ok(update.indexOf("require('./after.js')") > -1)
  })

  it('updates require.resolve when require is created from createRequire', async () => {
    const update = await specifier.updateSrc(
      `
        import { createRequire } from 'node:module'
        const require = createRequire(import.meta.url)
        require.resolve('./resolve-before.js')
      `,
      'js',
      spec => {
        return spec.value.replace('.js', '.mjs')
      },
    )

    assert.ok(update.indexOf("require.resolve('./resolve-before.mjs')") > -1)
  })

  it('covers createRequire tracking with mixed declarations and scopes', async () => {
    const update = await specifier.updateSrc(
      `
        import moduleDefault, { createRequire as cr, syncBuiltinESMExports } from 'node:module'
        import * as moduleNS from 'module'

        let declaredWithoutInit
        let loader
        loader = cr(import.meta.url)
        loader.resolve('./assign.js')

        // Exercise updateBinding(false) path for undeclared assignment target.
        globalLoader = cr(import.meta.url)

        const notTracked = (0, cr)(import.meta.url)
        notTracked('./skip.js')

        const { createRequire: fromRequire } = require('module')
        const reqFromRequire = fromRequire(import.meta.url)
        reqFromRequire('./from-require.js')

        const { createRequire: ignoredFromOtherFactory } = createFactory()
        void ignoredFromOtherFactory

        const namedExpression = function namedExpressionFn(
          [head, ...tail],
          { nested: { value }, ...restObject } = {},
        ) {
          return head ?? tail ?? value ?? restObject
        }

        try {
          throw { message: 'oops', code: 1 }
        } catch ({ message, ...restError }) {
          void message
          void restError
        }

        void moduleDefault
        void moduleNS
        void syncBuiltinESMExports
        void declaredWithoutInit
        void namedExpression
      `,
      'js',
      spec => {
        return spec.value.replace('.js', '.mjs')
      },
    )

    assert.ok(update.indexOf("loader.resolve('./assign.mjs')") > -1)
    assert.ok(update.indexOf("reqFromRequire('./from-require.mjs')") > -1)
    assert.ok(update.indexOf("notTracked('./skip.js')") > -1)
  })

  it('covers function-declaration bindings and non-createRequire object keys', async () => {
    const update = await specifier.updateSrc(
      `
        function useBindings([, first], { nested: { value } = {}, ...restObj } = {}) {
          const { notCreateRequire: localFactory, ...otherExports } = require('module')
          const local = localFactory(import.meta.url)
          local('./should-skip.js')
          return [first, value, restObj, otherExports]
        }

        void useBindings
      `,
      'js',
      spec => {
        return spec.value.replace('.js', '.mjs')
      },
    )

    assert.ok(update.indexOf("local('./should-skip.js')") > -1)
  })
})
