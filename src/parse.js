import { parse as babelParse } from '@babel/parser'

const parse = source => {
  const ast = babelParse(source, {
    sourceType: 'module',
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
    allowImportExportEverywhere: true,
    plugins: ['jsx', ['typescript', { dts: true }]],
  })

  return ast
}

export { parse }
