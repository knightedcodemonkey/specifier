import { resolve } from 'node:path'
import { stat, readFile } from 'node:fs/promises'

import MagicString from 'magic-string'

import { parse } from './parse.js'
import { format } from './format.js'

import type { Stats } from 'node:fs'
import type { ParseError } from '@babel/parser'
import type { SourceMap } from 'magic-string'

interface Position {
  line: number
  column: number
}
interface SourceLocation {
  start: Position
  end: Position
}
interface CodeSyntaxError {
  code: string
  reasonCode: string
}
/**
 * An error if either of the following happens:
 * - Filename can not be found on disk.
 * - Regex map produces an invalid regular expression.
 * - There is a syntax error while parsing.
 */
interface UpdateError {
  error: boolean
  msg: string
  filename?: string
  syntaxError?: CodeSyntaxError
}
/**
 * Argument passed to callbacks.
 * The properties are derived from an AST node.
 */
interface Spec {
  type: 'StringLiteral' | 'TemplateLiteral' | 'BinaryExpression' | 'NewExpression'
  start: number
  end: number
  value: string
  loc: SourceLocation
}
/**
 * Options for parsing a TS ambient context, or generating source maps.
 */
interface Opts {
  dts?: boolean
  sourceMap?: boolean
}
/**
 * Response from a specifier method call.
 * One of `code` or `error` will always be present.
 */
interface Update {
  code?: string
  map?: SourceMap | null
  error?: UpdateError
}
interface RegexMap {
  [regex: string]: string
}
type Callback = (spec: Spec) => string | undefined
interface Specifier {
  mapper: (filename: string, map: { [regex: string]: string }) => Promise<Update>
  update: (filename: string, callbackOrMap: Callback | RegexMap) => Promise<Update>
  updateSrc: (
    code: string,
    callbackOrMap: Callback | RegexMap,
    opts?: Opts,
  ) => Promise<Update>
}
interface AnError {
  error: Error
}

const anError = (error: unknown) => {
  if (error instanceof Error) {
    return { error }
  }

  return { error: new Error(`An unexpected error occured: ${error}`) }
}
const isAnError = (x: unknown): x is AnError => {
  if (x && typeof x === 'object' && 'error' in x) {
    return true
  }

  return false
}
const updateSrcOpts = { dts: false, sourceMap: false }
const makeError = (
  msg: string,
  filename?: string,
  ctx?: CodeSyntaxError,
): UpdateError => {
  return {
    msg,
    filename,
    error: true,
    syntaxError: ctx,
  }
}
const isValidFilename = async (filename: string) => {
  let stats: Stats

  try {
    stats = await stat(filename)
  } catch {
    return false
  }

  if (!stats.isFile()) {
    return false
  }

  return true
}
const getAst = (file: string, filename: string) => {
  try {
    return {
      ast: parse(file, /\.d\.[mc]?ts$/.test(filename)),
    }
  } catch (error) {
    return anError(error)
  }
}
const getCodeAst = (code: string, dts = false) => {
  try {
    return {
      ast: parse(code, dts),
    }
  } catch (error) {
    return anError(error)
  }
}
const getConvertedMap = (map: RegexMap) => {
  const entries = Object.entries(map)
  const mapped: [RegExp, string][] = []

  for (const [key, value] of entries) {
    try {
      mapped.push([new RegExp(key), value])
    } catch (error) {
      return anError(error)
    }
  }

  return { mapped }
}
const getAstError = (error: Error, filename?: string) => {
  if (error instanceof SyntaxError) {
    const { code, reasonCode } = error as unknown as ParseError

    return {
      error: makeError(error.message, filename, { code, reasonCode }),
    }
  }

  return {
    error: makeError(error.message, filename),
  }
}
const specifier = {
  async update(path: string, callbackOrMap: Callback | RegexMap): Promise<Update> {
    if (callbackOrMap !== null && typeof callbackOrMap === 'object') {
      return specifier.mapper(path, callbackOrMap)
    }

    const filename = resolve(path)
    const validated = await isValidFilename(filename)

    if (!validated) {
      return {
        error: makeError(
          `The provided path ${path} does not resolve to a file on disk.`,
          filename,
        ),
      }
    }

    const file = (await readFile(filename)).toString()
    const ret = getAst(file, filename)

    if (isAnError(ret)) {
      return getAstError(ret.error, filename)
    }

    return {
      code: format(file, ret.ast, callbackOrMap).toString(),
    }
  },

  async updateSrc(
    code: string,
    callbackOrMap: Callback | RegexMap,
    opts: Opts = updateSrcOpts,
  ): Promise<Update> {
    const options = { ...updateSrcOpts, ...opts }
    const res = getCodeAst(code, options.dts)
    const getUpdate = (magic: MagicString) => {
      return {
        code: magic.toString(),
        map: options.sourceMap ? magic.generateMap({ hires: true }) : null,
      }
    }

    if (isAnError(res)) {
      return getAstError(res.error)
    }

    if (typeof callbackOrMap === 'function') {
      return getUpdate(format(code, res.ast, callbackOrMap))
    }

    const ret = getConvertedMap(callbackOrMap)

    if (isAnError(ret)) {
      return {
        error: makeError(ret.error.message),
      }
    }

    return getUpdate(format(code, res.ast, ret.mapped))
  },

  async mapper(path: string, map: RegexMap): Promise<Update> {
    const filename = resolve(path)
    const validated = await isValidFilename(filename)

    if (!validated) {
      return {
        error: makeError(
          `The provided path ${path} does not resolve to a file on disk.`,
          filename,
        ),
      }
    }

    const file = (await readFile(filename)).toString()
    const res = getAst(file, filename)

    if (isAnError(res)) {
      return getAstError(res.error, filename)
    }

    const ret = getConvertedMap(map)

    if (isAnError(ret)) {
      return {
        error: makeError(ret.error.message, filename),
      }
    }

    return {
      code: format(file, res.ast, ret.mapped).toString(),
    }
  },
}

export { specifier }
export type {
  Specifier,
  Spec,
  Callback,
  RegexMap,
  Update,
  UpdateError,
  CodeSyntaxError,
  Opts,
}
