import { simple } from 'acorn-walk'
import MagicString from 'magic-string'

const update = (sourceNode, code, callback) => {
  const { type, start, end, loc, value } = sourceNode
  const updated = callback({ type, start, end, loc, value })

  if (typeof updated === 'string') {
    code.update(start + 1, end - 1, updated)
  }
}
const format = (file, ast, callback) => {
  const code = new MagicString(file)

  simple(ast, {
    ImportDeclaration(node) {
      update(node.source, code, callback)
    },
    ImportExpression(node) {
      const { source } = node
      const { type, start, end, loc } = source

      switch (source.type) {
        case 'Literal': {
          update(source, code, callback)
          break
        }
        case 'NewExpression': {
          const { name } = source.callee

          if (source.callee.type === 'Identifier' && name === 'String') {
            const value = file.slice(source.start, source.end)
            const updated = callback({ type, start, end, loc, value })

            if (typeof updated === 'string') {
              // Should provide "raw" updated value
              code.update(start, end, updated)
            }
          }
          break
        }
        case 'BinaryExpression': {
          const value = file.slice(source.start, source.end)
          const updated = callback({ type, start, end, loc, value })

          if (typeof updated === 'string') {
            // Should provide "raw" updated value
            code.update(start, end, updated)
          }
          break
        }
        case 'TemplateLiteral': {
          const value = file.slice(source.start + 1, source.end - 1)
          const updated = callback({ type, start, end, loc, value })

          if (typeof updated === 'string') {
            code.update(start + 1, end - 1, updated)
          }
          break
        }
      }
    },
    ExportNamedDeclaration(node) {
      const { source } = node

      if (source) {
        update(source, code, callback)
      }
    },
    ExportAllDeclaration(node) {
      update(node.source, code, callback)
    },
  })

  return code.toString()
}

export { format }
