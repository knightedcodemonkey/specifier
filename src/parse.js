import { Parser } from 'acorn'
import jsx from 'acorn-jsx'

const parser = Parser.extend(jsx())

const parse = source => {
  const ast = parser.parse(source, {
    locations: true,
    ecmaVersion: 2023,
    sourceType: 'module',
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
    allowImportExportEverywhere: true,
  })

  return ast
}

export { parse }
