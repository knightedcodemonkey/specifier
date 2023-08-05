import { resolve } from 'node:path'
import { stat, readFile } from 'node:fs/promises'

import { parse } from './parse.js'
import { format } from './format.js'

const updateSrcOpts = { dts: false, sourceMap: false }
const makeError = (filename, msg, ctx) => {
  return {
    msg,
    filename,
    error: true,
    syntaxError: ctx,
  }
}
const validateFilename = async (filename, path) => {
  let stats = null

  try {
    stats = await stat(filename)
  } catch {
    return {
      error: makeError(
        filename,
        `The provided path ${path} does not resolve to a file on disk.`,
      ),
    }
  }

  if (!stats.isFile()) {
    return {
      error: makeError(filename, `The provided path ${path} is not a file.`),
    }
  }

  return { error: false }
}
const getAst = (file, filename) => {
  try {
    return parse(file, /\.d\.[mc]?ts$/.test(filename))
  } catch (err) {
    const { code, reasonCode, loc, pos } = err

    return {
      error: makeError(filename, err.message, { code, reasonCode, loc, pos }),
    }
  }
}
const getCodeAst = (code, dts = false) => {
  try {
    return parse(code, dts)
  } catch (err) {
    const { code, reasonCode, loc, pos } = err

    return {
      error: makeError(undefined, err.message, { code, reasonCode, loc, pos }),
    }
  }
}
const getConvertedMap = (map, filename) => {
  const entries = Object.entries(map)
  const mapped = []

  for (const [key, value] of entries) {
    try {
      mapped.push([new RegExp(key), value])
    } catch (err) {
      return {
        error: makeError(
          filename,
          `Could not create RegExp from provided map: ${err.message}`,
        ),
      }
    }
  }

  return mapped
}
const specifier = {
  async update(path, callback) {
    if (callback !== null && typeof callback === 'object') {
      return specifier.mapper(path, callback)
    }

    const filename = resolve(path)
    const validation = await validateFilename(filename, path)

    if (validation.error) {
      return validation.error
    }

    const file = (await readFile(filename)).toString()
    const ast = getAst(file, filename)

    if (ast.error) {
      return ast.error
    }

    return format(file, ast, callback)
  },

  /**
   * A less functional version of of `updateSrc`.
   * You should use that instead.
   */
  async updateCode(code, callback, dts = false) {
    const ast = getCodeAst(code, dts)

    if (ast.error) {
      return ast.error
    }

    return format(code, ast, callback)
  },

  /**
   * Useful for clients that are part of a plugin system
   * where available build hooks provide the source code.
   *
   * @TODO Test whether Rollup/Vite works with Babel's AST,
   * as their documentation says they only inspect start/end
   * of a node, and I believe their bundles are derived from
   * string manipulation via magic-string (not AST generated).
   *
   * @see https://github.com/rollup/rollup/issues/782#issuecomment-231721242
   *
   * @param {string} code The source code to update.
   * @param {function | object} callbackOrMap The callback or map object used to update specifiers.
   * @param {object} opts Options for parsing TS ambient context, or generating source maps.
   * @returns Promise<{ updatedCode, sourceMap }>
   */
  async updateSrc(code, callbackOrMap, opts = updateSrcOpts) {
    const options = { ...updateSrcOpts, ...opts }
    const ast = getCodeAst(code, options.dts)

    if (ast.error) {
      return ast.error
    }

    const operator =
      typeof callbackOrMap === 'object'
        ? getConvertedMap(callbackOrMap, undefined)
        : callbackOrMap

    if (operator.error) {
      return operator.error
    }

    const recoded = format(code, ast, operator, options.sourceMap)

    return {
      map: options.sourceMap ? recoded.generateMap({ hires: true }) : null,
      code: options.sourceMap ? recoded.toString() : recoded,
    }
  },

  async mapper(path, map) {
    const filename = resolve(path)
    const validation = await validateFilename(filename, path)

    if (validation.error) {
      return validation.error
    }

    const file = (await readFile(filename)).toString()
    const ast = getAst(file, filename)

    if (ast.error) {
      return ast.error
    }

    const mapped = getConvertedMap(map, filename)

    if (mapped.error) {
      return mapped.error
    }

    return format(file, ast, mapped)
  },
}

export { specifier }
