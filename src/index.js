import { resolve } from 'node:path'
import { stat, readFile } from 'node:fs/promises'

import { parse } from './parse.js'
import { format } from './format.js'

const makeError = (filename, msg, ctx) => {
  return {
    msg,
    filename,
    error: true,
    syntaxError: Boolean(ctx),
    errorContext: ctx,
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
   * Some client might be part of a particular build's plugin system.
   * This is here to support that use case, where the filename is not
   * provided but rather the source code.
   *
   * @param {string} code The source code to update.
   * @param {Function} callback The function provided the updated specifier value, if any.
   * @param {Boolean} dts Whether to parse for TypeScript's ambient contexts.
   */
  async updateCode(code, callback, dts = false) {
    const ast = getCodeAst(code, dts)

    if (ast.error) {
      return ast.error
    }

    return format(code, ast, callback)
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

    const entries = Object.entries(map)
    const mapped = []

    for (const [key, value] of entries) {
      try {
        mapped.push([new RegExp(key), value])
      } catch (err) {
        return makeError(
          filename,
          `Could not create RegExp from provided map: ${err.message}`,
        )
      }
    }

    return format(file, ast, mapped)
  },
}

export { specifier }
