import type { SourceMap } from 'magic-string'

interface Position {
  line: number
  column: number
}
interface SourceLocation {
  start: Position
  end: Position
}
interface UpdateError {
  error: boolean
  msg: string
  filename?: string
  syntaxError?: {
    code: string
    reasonCode: string
    pos: number
    loc: Position
  }
}
interface Spec {
  type: 'StringLiteral' | 'TemplateLiteral' | 'BinaryExpression' | 'NewExpression'
  start: number
  end: number
  value: string
  loc: SourceLocation
}
interface Opts {
  dts?: boolean
  sourceMap?: boolean
}
interface Update {
  code?: string
  map?: SourceMap | null
  error?: UpdateError
}
interface RegexMap {
  [regex: string]: string
}
type Callback = (spec: Spec) => string

interface Specifier {
  mapper: (
    filename: string,
    map: { [regex: string]: string },
  ) => Promise<string | UpdateError>
  update: (
    filename: string,
    callbackOrMap: Callback | RegexMap,
  ) => Promise<string | UpdateError>
  updateSrc: (
    code: string,
    callbackOrMap: Callback | RegexMap,
    opts?: Opts,
  ) => Promise<Update>
}

export const specifier: Specifier
export type { Specifier, Spec, Callback, RegexMap, Update, UpdateError, Opts }
