import MagicString from 'magic-string'
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
type Scope = {
  parent: Scope | null
  functionScope: boolean
  bindings: Map<string, BindingKind>
}
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
const collectBindingNames = (target: unknown): string[] => {
  if (!isRecord(target)) {
    return []
  }

  const nodeType = target.type

  if (isIdentifier(target)) {
    return [target.name]
  }

  const record = target

  if (nodeType === 'AssignmentPattern') {
    return collectBindingNames(record.left)
  }

  if (nodeType === 'RestElement') {
    return collectBindingNames(record.argument)
  }

  if (nodeType === 'ArrayPattern') {
    const elements = Array.isArray(record.elements) ? record.elements : []
    return elements.flatMap(element => collectBindingNames(element))
  }

  if (nodeType === 'ObjectPattern') {
    const properties = (Array.isArray(record.properties) ? record.properties : []).filter(
      isRecord,
    )

    return properties.flatMap(property => {
      const propertyType = property.type

      const propertyRecord = property

      if (propertyType === 'Property') {
        return collectBindingNames(propertyRecord.value)
      }

      if (propertyType === 'RestElement') {
        return collectBindingNames(propertyRecord.argument)
      }

      return []
    })
  }

  return []
}

const format = async (src: string, ast: ParseResult, cb: Callback) => {
  const code = new MagicString(src)
  let scope: Scope = {
    parent: null,
    functionScope: true,
    bindings: new Map(),
  }
  const variableDeclarationKinds: string[] = []
  const pushScope = (options?: { functionScope?: boolean }) => {
    scope = {
      parent: scope,
      functionScope: options?.functionScope ?? false,
      bindings: new Map(),
    }
  }
  const popScope = () => {
    if (scope.parent) {
      scope = scope.parent
    }
  }
  const getNearestFunctionScope = () => {
    let cursor: Scope | null = scope

    while (cursor) {
      if (cursor.functionScope) {
        return cursor
      }

      cursor = cursor.parent
    }

    return scope
  }
  const defineBinding = (
    name: string,
    kind: BindingKind = 'other',
    options?: { varScoped?: boolean },
  ) => {
    const targetScope = options?.varScoped ? getNearestFunctionScope() : scope
    targetScope.bindings.set(name, kind)
  }
  const getBindingScope = (name: string) => {
    let cursor: Scope | null = scope

    while (cursor) {
      if (cursor.bindings.has(name)) {
        return cursor
      }

      cursor = cursor.parent
    }

    return null
  }
  const getBindingKind = (name: string) => {
    const bindingScope = getBindingScope(name)

    if (!bindingScope) {
      return null
    }

    return bindingScope.bindings.get(name) ?? null
  }
  const updateBinding = (name: string, kind: BindingKind) => {
    const bindingScope = getBindingScope(name)

    if (!bindingScope) {
      return false
    }

    bindingScope.bindings.set(name, kind)
    return true
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

      defineBinding(specifier.local.name, 'createRequireFactory')
    }
  }
  const markRequireDestructureCreateRequire = (
    node: VariableDeclarator,
    options?: { varScoped?: boolean },
  ) => {
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

      for (const name of collectBindingNames(property.value)) {
        defineBinding(name, 'createRequireFactory', options)
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
    Program() {
      pushScope({ functionScope: true })
    },
    'Program:exit'() {
      popScope()
    },
    FunctionDeclaration(node) {
      if (node.id && node.id.type === 'Identifier') {
        defineBinding(node.id.name)
      }

      pushScope({ functionScope: true })

      for (const parameter of node.params) {
        for (const name of collectBindingNames(parameter)) {
          defineBinding(name)
        }
      }
    },
    'FunctionDeclaration:exit'() {
      popScope()
    },
    FunctionExpression(node) {
      pushScope({ functionScope: true })

      if (node.id && node.id.type === 'Identifier') {
        defineBinding(node.id.name)
      }

      for (const parameter of node.params) {
        for (const name of collectBindingNames(parameter)) {
          defineBinding(name)
        }
      }
    },
    'FunctionExpression:exit'() {
      popScope()
    },
    ArrowFunctionExpression(node) {
      pushScope({ functionScope: true })

      for (const parameter of node.params) {
        for (const name of collectBindingNames(parameter)) {
          defineBinding(name)
        }
      }

      const { body } = node

      if (body.type === 'ImportExpression') {
        formatExpression(body)
      }
    },
    'ArrowFunctionExpression:exit'() {
      popScope()
    },
    BlockStatement() {
      pushScope()
    },
    'BlockStatement:exit'() {
      popScope()
    },
    CatchClause(node) {
      pushScope()

      if (node.param) {
        for (const name of collectBindingNames(node.param)) {
          defineBinding(name)
        }
      }
    },
    'CatchClause:exit'() {
      popScope()
    },
    ImportDeclaration(node) {
      for (const specifier of node.specifiers) {
        if ('local' in specifier && specifier.local.type === 'Identifier') {
          defineBinding(specifier.local.name)
        }
      }

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
    VariableDeclaration(node) {
      variableDeclarationKinds.push(node.kind)
    },
    'VariableDeclaration:exit'() {
      variableDeclarationKinds.pop()
    },
    VariableDeclarator(node) {
      const varScoped = variableDeclarationKinds.at(-1) === 'var'
      const names = collectBindingNames(node.id)

      for (const name of names) {
        defineBinding(name, 'other', { varScoped })
      }

      markRequireDestructureCreateRequire(node, { varScoped })

      if (node.id.type !== 'Identifier' || node.init?.type !== 'CallExpression') {
        return
      }

      if (isCreateRequireCall(node.init)) {
        defineBinding(node.id.name, 'requireAlias', { varScoped })
      }
    },
    AssignmentExpression(node) {
      if (node.left.type !== 'Identifier') {
        return
      }

      const { name } = node.left

      if (node.right.type === 'CallExpression' && isCreateRequireCall(node.right)) {
        updateBinding(name, 'requireAlias')
        return
      }

      if (getBindingKind(name) === 'requireAlias') {
        updateBinding(name, 'other')
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
