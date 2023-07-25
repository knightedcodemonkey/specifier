import thing from 'foo'
import m from './not-matched.mjs'
import('./dynamic.js')
import(`./template/${string}.js`)
import(new String('./ctor.cjs'))
import('./b' + './e.js')

export { bar } from './module.js'
export * as ns from './abc/123.js'
