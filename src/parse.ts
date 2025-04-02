import { parseSync } from 'oxc-parser'

const parse = (filename: string, source: string) => {
  return parseSync(filename, source)
}

export { parse }
