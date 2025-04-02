# [`@knighted/specifier`](https://www.npmjs.com/package/@knighted/specifier)

![CI](https://github.com/knightedcodemonkey/specifier/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/knightedcodemonkey/specifier/branch/main/graph/badge.svg?token=5KS9ZB3XDK)](https://codecov.io/gh/knightedcodemonkey/specifier)
[![NPM version](https://img.shields.io/npm/v/@knighted/specifier.svg)](https://www.npmjs.com/package/@knighted/specifier)

Node.js tool for parsing imports to change ESM and CJS [specifiers](https://nodejs.org/api/esm.html#import-specifiers).

- Rewrite specifier values.
- Updates files or strings.
- Read metadata about a specifier's [AST](https://www.npmjs.com/package/oxc-parser) node.
- Parses `import`, `import()`, `import.meta.resolve()`, `export`, `require`, and `require.resolve()`.

## Example

Given a file with some imports and exports:

```ts
// file.ts

import { someLib } from 'some-package'
import { foo } from './path/to/foo.js'

export { bar } from './path/to/bar.js'
```

You can use `specifier` to change the values:

```ts
import { specifier } from '@knighted/specifier'

const update = await specifier.update('file.ts', ({ value }) => {
  if (value === 'some-package') {
    return 'some-package/esm'
  }

  return value.replace('.js', '.mjs')
})

console.log(update)

/*
import { someLib } from 'some-package/esm'
import { foo } from './path/to/foo.mjs'

export { bar } from './path/to/bar.mjs'
*/
```

Or collect the AST nodes:

```ts
import { type Spec, specifier } from '@knighted/specifier'

const nodes: { node: Spec['node']; parent: Spec['parent'] }[] = []

await specifier.update('file.ts', ({ parent, node }) => {
  nodes.push({ node, parent })
})

nodes.forEach(({ node, parent }) => {
  // Do something with the metadata
})
```
