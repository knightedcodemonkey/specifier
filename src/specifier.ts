import { resolve } from 'node:path'
import { stat, readFile } from 'node:fs/promises'
import type { Stats } from 'node:fs'
import type { ParserOptions } from 'oxc-parser'

import { parse } from './parse.js'
import { format } from './format.js'
import type { Callback } from './types.js'

type Specifier = {
  update: (filename: string, callback: Callback) => Promise<string>
  updateSrc: (
    code: string,
    lang: ParserOptions['lang'],
    callback: Callback,
  ) => Promise<string>
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

const specifier = {
  async update(path: string, callback: Callback) {
    const filename = resolve(path)
    const validated = await isValidFilename(filename)

    if (!validated) {
      throw new Error(`The provided path ${path} does not resolve to a file on disk.`)
    }

    const src = (await readFile(filename)).toString()
    const ast = parse(filename, src)

    return format(src, ast, callback)
  },

  async updateSrc(src: string, lang: ParserOptions['lang'], callback: Callback) {
    const filename =
      lang === 'ts'
        ? 'file.ts'
        : lang === 'tsx'
          ? 'file.tsx'
          : lang === 'js'
            ? 'file.js'
            : 'file.jsx'
    const ast = parse(filename, src)

    return format(src, ast, callback)
  },
} satisfies Specifier

export { specifier }
export type { Specifier }
