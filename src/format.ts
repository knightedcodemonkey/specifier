import MagicString from 'magic-string'
import { walk } from '@knighted/walk'
import type {
  ParseResult,
  Node,
  StringLiteral,
  BinaryExpression,
  ImportExpression,
  CallExpression,
} from 'oxc-parser'

import type { Callback } from './types.js'

const isStringLiteral = (node: Node): node is StringLiteral => {
  return node.type === 'Literal' && typeof node.value === 'string'
}
const isBinaryExpression = (node: Node): node is BinaryExpression => {
  // Need to distinguish between BinaryExpression and PrivateInExpression
  return node.type === 'BinaryExpression' && node.operator !== 'in'
}
const isCallExpression = (node: Node): node is CallExpression => {
  return node.type === 'CallExpression' && node.callee !== undefined
}
const format = (src: string, ast: ParseResult, cb: Callback) => {
  const code = new MagicString(src)
  const formatExpression = (expression: ImportExpression | CallExpression) => {
    /**
     * When using require(), require.resolve(), or import.meta.resolve()
     * there is only one argument to consider.
     */
    const node = isCallExpression(expression)
      ? expression.arguments[0]
      : expression.source
    const { type } = node

    switch (type) {
      case 'Literal':
        if (isStringLiteral(node)) {
          const { start, end, value } = node
          const updated = cb({
            type: 'StringLiteral',
            parent: expression,
            node,
            start,
            end,
            value,
          })

          if (typeof updated === 'string') {
            code.update(start + 1, end - 1, updated)
          }
        }
        break
      case 'TemplateLiteral':
        {
          const { start, end } = node
          const value = src.slice(start + 1, end - 1)
          const updated = cb({
            type: 'TemplateLiteral',
            parent: expression,
            node,
            start,
            end,
            value,
          })

          if (typeof updated === 'string') {
            code.update(start + 1, end - 1, updated)
          }
        }
        break
      case 'BinaryExpression':
        if (isBinaryExpression(node)) {
          const { start, end } = node
          const value = src.slice(start, end)
          const updated = cb({
            type: 'BinaryExpression',
            parent: expression,
            node,
            start,
            end,
            value,
          })

          if (typeof updated === 'string') {
            code.update(start, end, updated)
          }
        }
        break
      case 'NewExpression':
        {
          if (node.callee.type === 'Identifier' && node.callee.name === 'String') {
            const { start, end } = node
            const value = src.slice(start, end)
            const updated = cb({
              type: 'NewExpression',
              parent: expression,
              node,
              start,
              end,
              value,
            })

            if (typeof updated === 'string') {
              code.update(start, end, updated)
            }
          }
        }
        break
    }
  }

  walk(ast.program, {
    enter(node) {
      if (node.type === 'ExpressionStatement') {
        const { expression } = node

        if (expression.type === 'ImportExpression') {
          formatExpression(expression)
        }
      }

      if (node.type === 'CallExpression') {
        /**
         * Check for:
         *
         * require()
         * require.resolve()
         * import.meta.resolve()
         *
         * Omitted:
         * const require = createRequire(import.meta.url)
         */
        if (
          (node.callee.type === 'Identifier' && node.callee.name === 'require') ||
          (node.callee.type === 'MemberExpression' &&
            node.callee.object.type === 'Identifier' &&
            node.callee.object.name === 'require' &&
            node.callee.property.type === 'Identifier' &&
            node.callee.property.name === 'resolve') ||
          (node.callee.type === 'MemberExpression' &&
            node.callee.object.type === 'MetaProperty' &&
            node.callee.object.meta.name === 'import' &&
            node.callee.property.type === 'Identifier' &&
            node.callee.property.name === 'resolve')
        ) {
          formatExpression(node)
        }
      }

      if (node.type === 'TSImportType') {
        const { argument } = node

        if (argument.type === 'TSLiteralType' && isStringLiteral(argument.literal)) {
          const { start, end, value } = argument.literal
          const updated = cb({
            type: 'StringLiteral',
            node: argument.literal,
            parent: node,
            start,
            end,
            value,
          })

          if (typeof updated === 'string') {
            code.update(start + 1, end - 1, updated)
          }
        }
      }

      if (node.type === 'ImportDeclaration') {
        const { source } = node
        const { start, end, value } = source
        const updated = cb({
          type: 'StringLiteral',
          node: source,
          parent: node,
          start,
          end,
          value,
        })

        if (typeof updated === 'string') {
          code.update(start + 1, end - 1, updated)
        }
      }

      if (node.type === 'ExportNamedDeclaration' && node.source) {
        const { source } = node
        const { start, end, value } = source
        const updated = cb({
          type: 'StringLiteral',
          node: source,
          parent: node,
          start,
          end,
          value,
        })

        if (typeof updated === 'string') {
          code.update(start + 1, end - 1, updated)
        }
      }

      if (node.type === 'ExportAllDeclaration') {
        const { source } = node
        const { start, end, value } = source
        const updated = cb({
          type: 'StringLiteral',
          node: source,
          parent: node,
          start,
          end,
          value,
        })

        if (typeof updated === 'string') {
          code.update(start + 1, end - 1, updated)
        }
      }
    },
  })

  return code.toString()
}

export { format }
