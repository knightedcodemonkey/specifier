import {
  StringLiteral,
  TemplateLiteral,
  BinaryExpression,
  NewExpression,
  CallExpression,
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportAllDeclaration,
  ImportExpression,
  TSImportType,
} from 'oxc-parser'

type Spec = {
  type: 'StringLiteral' | 'TemplateLiteral' | 'BinaryExpression' | 'NewExpression'
  node: StringLiteral | TemplateLiteral | BinaryExpression | NewExpression
  parent:
    | CallExpression
    | ImportDeclaration
    | ExportNamedDeclaration
    | ExportAllDeclaration
    | ImportExpression
    | TSImportType
  start: number
  end: number
  value: string
}
type Callback = (spec: Spec) => string | void

export type { Callback, Spec }
