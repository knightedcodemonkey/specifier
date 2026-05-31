import MagicString from 'magic-string'
import { analyze, extract_names, Scope as PeriscopicScope } from 'periscopic'
import type {
  ParseResult,
  Node,
  StringLiteral,
  BinaryExpression,
  ImportExpression,
  CallExpression,
  ImportDeclaration,
  VariableDeclarator,
} from 'oxc-parser'
import { Visitor } from 'oxc-parser'

import type { Callback } from './types.js'

type BindingKind = 'other' | 'createRequireFactory' | 'requireAlias'
type PeriscopicNode = Parameters<typeof analyze>[0]
type UnknownRecord = Record<string, unknown>

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
const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null
}
const isIdentifier = (value: unknown): value is { type: 'Identifier'; name: string } => {
  return isRecord(value) && value.type === 'Identifier' && typeof value.name === 'string'
}
const isModuleCreateRequireSource = (value: string) => {
  return value === 'module' || value === 'node:module'
}
const isRequireCallForModule = (node: CallExpression) => {
  if (
    node.callee.type !== 'Identifier' ||
    node.callee.name !== 'require' ||
    node.arguments.length === 0
  ) {
    return false
  }

  const first = node.arguments[0]

  return isStringLiteral(first) && isModuleCreateRequireSource(first.value)
}
const asPeriscopicNode = (node: Node | unknown) => node as PeriscopicNode
const getOrCreateKinds = (
  kindsByScope: WeakMap<PeriscopicScope, Map<string, BindingKind>>,
  scope: PeriscopicScope,
) => {
  let kinds = kindsByScope.get(scope)

  if (!kinds) {
    kinds = new Map()
    kindsByScope.set(scope, kinds)
  }

  return kinds
}

const format = async (src: string, ast: ParseResult, cb: Callback) => {
  const code = new MagicString(src)
  const { map: scopeMap, scope: rootScope } = analyze(asPeriscopicNode(ast.program))
  const bindingKinds = new WeakMap<PeriscopicScope, Map<string, BindingKind>>()
  let scope = rootScope
  const enterScope = (node: Node) => {
    const nextScope = scopeMap.get(asPeriscopicNode(node))

    if (nextScope) {
      scope = nextScope
    }
  }
  const exitScope = (node: Node) => {
    if (scopeMap.has(asPeriscopicNode(node)) && scope.parent) {
      scope = scope.parent
    }
  }
  const setBindingKind = (name: string, kind: BindingKind) => {
    const owner = scope.find_owner(name)

    if (!owner) {
      return false
    }

    getOrCreateKinds(bindingKinds, owner).set(name, kind)
    return true
  }
  const getBindingKind = (name: string) => {
    const owner = scope.find_owner(name)

    if (!owner) {
      return null
    }

    return bindingKinds.get(owner)?.get(name) ?? 'other'
  }
  const isCreateRequireCall = (node: CallExpression) => {
    if (!isIdentifier(node.callee)) {
      return false
    }

    return getBindingKind(node.callee.name) === 'createRequireFactory'
  }
  const isRequireLikeIdentifier = (name: string) => {
    const kind = getBindingKind(name)

    if (kind === 'requireAlias') {
      return true
    }

    return name === 'require' && kind === null
  }
  const markModuleImportCreateRequire = (node: ImportDeclaration) => {
    if (!isModuleCreateRequireSource(node.source.value)) {
      return
    }

    for (const specifier of node.specifiers) {
      if (specifier.type !== 'ImportSpecifier') {
        continue
      }

      if (
        !isIdentifier(specifier.imported) ||
        specifier.imported.name !== 'createRequire'
      ) {
        continue
      }

      setBindingKind(specifier.local.name, 'createRequireFactory')
    }
  }
  const markRequireDestructureCreateRequire = (node: VariableDeclarator) => {
    if (node.id.type !== 'ObjectPattern' || node.init?.type !== 'CallExpression') {
      return
    }

    if (!isRequireCallForModule(node.init)) {
      return
    }

    const properties = Array.isArray(node.id.properties) ? node.id.properties : []

    for (const property of properties) {
      if (property.type !== 'Property') {
        continue
      }

      if (!isIdentifier(property.key) || property.key.name !== 'createRequire') {
        continue
      }

      for (const name of extract_names(asPeriscopicNode(property.value))) {
        setBindingKind(name, 'createRequireFactory')
      }
    }
  }
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

  const visitor = new Visitor({
    FunctionDeclaration: enterScope,
    'FunctionDeclaration:exit': exitScope,
    FunctionExpression: enterScope,
    'FunctionExpression:exit': exitScope,
    ArrowFunctionExpression(node) {
      enterScope(node)

      const { body } = node

      if (body.type === 'ImportExpression') {
        formatExpression(body)
      }
    },
    'ArrowFunctionExpression:exit': exitScope,
    BlockStatement: enterScope,
    'BlockStatement:exit': exitScope,
    CatchClause: enterScope,
    'CatchClause:exit': exitScope,
    ForStatement: enterScope,
    'ForStatement:exit': exitScope,
    ForInStatement: enterScope,
    'ForInStatement:exit': exitScope,
    ForOfStatement: enterScope,
    'ForOfStatement:exit': exitScope,
    SwitchStatement: enterScope,
    'SwitchStatement:exit': exitScope,
    ImportDeclaration(node) {
      markModuleImportCreateRequire(node)

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
    },
    VariableDeclarator(node) {
      markRequireDestructureCreateRequire(node)

      if (node.id.type !== 'Identifier' || node.init?.type !== 'CallExpression') {
        return
      }

      if (isCreateRequireCall(node.init)) {
        setBindingKind(node.id.name, 'requireAlias')
      }
    },
    AssignmentExpression(node) {
      if (node.left.type !== 'Identifier') {
        return
      }

      const { name } = node.left

      if (node.right.type === 'CallExpression' && isCreateRequireCall(node.right)) {
        setBindingKind(name, 'requireAlias')
        return
      }

      if (getBindingKind(name) === 'requireAlias') {
        setBindingKind(name, 'other')
      }
    },
    ExpressionStatement(node) {
      const { expression } = node

      if (expression.type === 'ImportExpression') {
        formatExpression(expression)
      }
    },
    CallExpression(node) {
      /**
       * Check for:
       *
       * require()
       * require.resolve()
       * import.meta.resolve()
       * createRequire-backed aliases (including `require`)
       */
      if (
        (node.callee.type === 'Identifier' &&
          isRequireLikeIdentifier(node.callee.name)) ||
        (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          isRequireLikeIdentifier(node.callee.object.name) &&
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
    },
    MemberExpression(node) {
      if (
        node.object.type === 'ImportExpression' &&
        node.property.type === 'Identifier' &&
        node.property.name === 'then'
      ) {
        formatExpression(node.object)
      }
    },
    TSImportType(node) {
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
    },
    ExportNamedDeclaration(node) {
      if (!node.source) {
        return
      }

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
    },
    ExportAllDeclaration(node) {
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
    },
  })

  visitor.visit(ast.program)

  return code.toString()
}

export { format }
