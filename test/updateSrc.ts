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
})
