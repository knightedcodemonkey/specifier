# [`@knighted/specifier`](https://www.npmjs.com/package/@knighted/specifier)

![CI](https://github.com/knightedcodemonkey/specifier/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/knightedcodemonkey/specifier/branch/main/graph/badge.svg?token=5KS9ZB3XDK)](https://codecov.io/gh/knightedcodemonkey/specifier)
[![NPM version](https://img.shields.io/npm/v/@knighted/specifier.svg)](https://www.npmjs.com/package/@knighted/specifier)

Node.js tool for updating your `import` and `export` specifiers, before or after your build.

## Example

The following script will update all specifiers in `dist/index.js` that end with a `.js` extension, to end with a `.cjs` extension instead.

**script.js**

```js
import { specifier } from '@knighted/specifier'

const code = specifier.update('dist/index.cjs', ({ type, value }) => {
  if (type === 'Literal') {
    return value.replace(/(.+)\.js$/, '$1.cjs')
  }
})
```

Now `code` can be used to write the updated source to a file.

## `specifier.update()`

## `specifier.mapper()`
