import { parse as babelParse } from '@babel/parser'

const parse = (source, dts = false) => {
  const ast = babelParse(source, {
    sourceType: 'module',
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
    allowImportExportEverywhere: true,
    plugins: ['jsx', ['typescript', { dts }]],
  })

  return ast
}

export { parse }
