import _traverse from '@babel/traverse'
import MagicString from 'magic-string'

const traverse = _traverse.default
const getUpdateFromMap = (map, value) => {
  /**
   * This should be run in insertion order of the original
   * map keys. The array was built with Object.entries()
   * which uses the same ordering as for...in.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...in#description
   */
  for (const [regexp, sub] of map) {
    if (regexp.test(value)) {
      return value.replace(regexp, sub)
    }
  }
}
const getUpdated = (resolver, opts, specifier) => {
  if (typeof resolver === 'function') {
    return resolver({ ...opts, value: specifier })
  }

  if (Array.isArray(resolver)) {
    return getUpdateFromMap(resolver, specifier)
  }
}
const update = (sourceNode, code, callbackOrMap) => {
  const { type, start, end, loc, value } = sourceNode
  const updated = getUpdated(callbackOrMap, { type, start, end, loc }, value)

  if (typeof updated === 'string') {
    code.update(start + 1, end - 1, updated)
  }
}
const format = (file, ast, callbackOrMap) => {
  const code = new MagicString(file)

  traverse(ast, {
    ImportDeclaration({ node }) {
      update(node.source, code, callbackOrMap)
    },
    CallExpression({ node }) {
      const { callee } = node

      if (
        callee.type === 'Import' ||
        (callee.type === 'Identifier' && callee.name === 'require')
      ) {
        const source = node.arguments[0]
        const { type, start, end, loc } = source

        switch (source.type) {
          case 'StringLiteral': {
            update(source, code, callbackOrMap)
            break
          }
          case 'NewExpression': {
            const { name } = source.callee

            if (source.callee.type === 'Identifier' && name === 'String') {
              const value = file.slice(source.start, source.end)
              const updated = getUpdated(callbackOrMap, { type, start, end, loc }, value)

              if (typeof updated === 'string') {
                // Should provide "raw" updated value
                code.update(start, end, updated)
              }
            }
            break
          }
          case 'BinaryExpression': {
            const value = file.slice(source.start, source.end)
            const updated = getUpdated(callbackOrMap, { type, start, end, loc }, value)

            if (typeof updated === 'string') {
              // Should provide "raw" updated value
              code.update(start, end, updated)
            }
            break
          }
          case 'TemplateLiteral': {
            const value = file.slice(source.start + 1, source.end - 1)
            const updated = getUpdated(callbackOrMap, { type, start, end, loc }, value)

            if (typeof updated === 'string') {
              code.update(start + 1, end - 1, updated)
            }
            break
          }
        }
      }
    },
    ExportNamedDeclaration({ node }) {
      const { source } = node

      if (source) {
        update(source, code, callbackOrMap)
      }
    },
    ExportAllDeclaration({ node }) {
      update(node.source, code, callbackOrMap)
    },
    TSImportType({ node }) {
      update(node.argument, code, callbackOrMap)
    },
  })

  return code.toString()
}

export { format }
