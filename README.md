# [`@knighted/specifier`](https://www.npmjs.com/package/@knighted/specifier)

![CI](https://github.com/knightedcodemonkey/specifier/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/knightedcodemonkey/specifier/branch/main/graph/badge.svg?token=5KS9ZB3XDK)](https://codecov.io/gh/knightedcodemonkey/specifier)
[![NPM version](https://img.shields.io/npm/v/@knighted/specifier.svg)](https://www.npmjs.com/package/@knighted/specifier)

Node.js tool for updating your ESM and CJS [specifiers](https://nodejs.org/api/esm.html#import-specifiers).

- Change, add or remove specifier extensions.
- Completely rewrite specifier values.
- Read metadata about a specifiers [AST](https://www.npmjs.com/package/oxc-parser) node.
- Update files or strings.

## Example

Consider a file with some relative imports and exports:

```ts
// file.ts

import { someLib } from 'some-package'
import { foo } from './path/to/foo.js'
import { bar } from './path/to/bar.js'

export { baz } from './path/to/baz.js'
```

You can use `specifier` to change the import extensions to `.mjs`:

```ts
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { specifier } from '@knighted/specifier'

// The callback is called for every specifier found
const update = await specifier.update(resolve('file.ts'), ({ value }) => {
  return value.replace(/^\.(.+)\.js$/, '.$1.mjs')
})

await writeFile('file.mts', update)
```

You can collect all the parent AST nodes in an array:

```ts
import type { Spec } from '@knighted/specifier'

const parents: Spec['parent'][] = []

await specifier.update(resolve('file.ts'), ({ parent }) => {
  parents.push(parent)
})

parents.forEach(parent => {
  // Do something with the metadata
})
```
