/* eslint-disable no-console */

import { parse } from 'acorn'
import { analyze } from 'periscopic'

const source = `
export { foo } from './reexport.js'
const { createRequire } = require('node:module')
const customRequire = createRequire(import.meta.url)
`

const program = parse(source, {
  ecmaVersion: 'latest',
  sourceType: 'module',
})

const { map, scope: rootScope } = analyze(program)

const exportNode = program.body.find(node => node.type === 'ExportNamedDeclaration')
const exportScope = map.get(exportNode)
const ownerFromExportScope = exportScope.find_owner('customRequire')
const ownerFromRootScope = rootScope.find_owner('customRequire')

console.log('periscopic scope ownership repro')
console.log(
  `exportScope.find_owner('customRequire') === exportScope: ${ownerFromExportScope === exportScope}`,
)
console.log(
  `rootScope.find_owner('customRequire') === null: ${ownerFromRootScope === null}`,
)
console.log('rootScope has no declarations', rootScope.declarations.size === 0)
console.log('Reproduced: customRequire is owned by export-created child scope')
