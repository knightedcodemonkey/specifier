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
const specifier = {
  async update(path, callback) {
    const filename = resolve(path)
    let stats = null

    try {
      stats = await stat(filename)
    } catch {
      return makeError(
        filename,
        `The provided path ${path} does not resolve to a file on disk.`,
      )
    }

    if (!stats.isFile()) {
      return makeError(filename, `The provided path ${path} is not a file.`)
    }

    const file = (await readFile(filename)).toString()
    let ast = null

    try {
      ast = parse(file)
    } catch (err) {
      const { loc, pos, raisedAt } = err

      return makeError(filename, err.message, { loc, pos, raisedAt })
    }

    return format(file, ast, callback)
  },
}

export { specifier }
