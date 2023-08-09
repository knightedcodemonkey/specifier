import _traverse from '@babel/traverse'
import MagicString from 'magic-string'

import type { ParseResult } from '@babel/parser'
import type {
  CallExpression,
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportAllDeclaration,
  TSImportType,
  File,
  StringLiteral,
  NewExpression,
  BinaryExpression,
  TemplateLiteral,
} from '@babel/types'
import type { NodePath } from '@babel/traverse'

import type { Callback, Spec } from './index.js'

type Mapped = [RegExp, string][]
type DynamicImportOrRequireArg =
  | StringLiteral
  | TemplateLiteral
  | BinaryExpression
  | NewExpression

const traverse = _traverse.default
const getUpdateFromMap = (map: [RegExp, string][], value: string) => {
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
const getUpdated = (
  resolver: Callback | Mapped,
  opts: Omit<Spec, 'value'>,
  specifier: string,
) => {
  if (typeof resolver === 'function') {
    return resolver({ ...opts, value: specifier })
  }

  if (Array.isArray(resolver)) {
    return getUpdateFromMap(resolver, specifier)
  }
}
const update = (
  sourceNode: StringLiteral,
  code: MagicString,
  callbackOrMap: Callback | Mapped,
) => {
  const { type, start, end, loc, value } = sourceNode

  if (typeof start === 'number' && typeof end === 'number' && loc) {
    const updated = getUpdated(callbackOrMap, { type, start, end, loc }, value)

    if (typeof updated === 'string') {
      code.update(start + 1, end - 1, updated)
    }
  }
}
const format = (
  src: string,
  ast: ParseResult<File>,
  callbackOrMap: Callback | Mapped,
): MagicString => {
  const code = new MagicString(src)

  traverse(ast, {
    ImportDeclaration({ node }: NodePath<ImportDeclaration>) {
      update(node.source, code, callbackOrMap)
    },
    CallExpression({ node }: NodePath<CallExpression>) {
      const { callee } = node

      if (
        callee.type === 'Import' ||
        (callee.type === 'Identifier' && callee.name === 'require')
      ) {
        const source = node.arguments[0] as DynamicImportOrRequireArg
        const { type, start, end, loc } = source

        if (typeof start === 'number' && typeof end === 'number' && loc) {
          switch (source.type) {
            case 'StringLiteral': {
              update(source, code, callbackOrMap)
              break
            }
            case 'NewExpression': {
              if (
                source.callee.type === 'Identifier' &&
                source.callee.name === 'String'
              ) {
                const value = src.slice(start, end)
                const updated = getUpdated(
                  callbackOrMap,
                  { type, start, end, loc },
                  value,
                )

                if (typeof updated === 'string') {
                  // Should provide "raw" updated value
                  code.update(start, end, updated)
                }
              }
              break
            }
            case 'BinaryExpression': {
              const value = src.slice(start, end)
              const updated = getUpdated(callbackOrMap, { type, start, end, loc }, value)

              if (typeof updated === 'string') {
                // Should provide "raw" updated value
                code.update(start, end, updated)
              }
              break
            }
            case 'TemplateLiteral': {
              const value = src.slice(start + 1, end - 1)
              const updated = getUpdated(callbackOrMap, { type, start, end, loc }, value)

              if (typeof updated === 'string') {
                code.update(start + 1, end - 1, updated)
              }
              break
            }
          }
        }
      }
    },
    ExportNamedDeclaration({ node }: NodePath<ExportNamedDeclaration>) {
      const { source } = node

      if (source) {
        update(source, code, callbackOrMap)
      }
    },
    ExportAllDeclaration({ node }: NodePath<ExportAllDeclaration>) {
      update(node.source, code, callbackOrMap)
    },
    TSImportType({ node }: NodePath<TSImportType>) {
      update(node.argument, code, callbackOrMap)
    },
  })

  return code
}

export { format }
