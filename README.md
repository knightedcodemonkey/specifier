# [`@knighted/specifier`](https://www.npmjs.com/package/@knighted/specifier)

![CI](https://github.com/knightedcodemonkey/specifier/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/knightedcodemonkey/specifier/branch/main/graph/badge.svg?token=5KS9ZB3XDK)](https://codecov.io/gh/knightedcodemonkey/specifier)
[![NPM version](https://img.shields.io/npm/v/@knighted/specifier.svg)](https://www.npmjs.com/package/@knighted/specifier)

Node.js tool for updating your ESM and CJS [specifiers](https://nodejs.org/api/esm.html#import-specifiers).

Supports:

* Latest ECMAScript
* TypeScript
* JSX

## Example

The following script will update all specifiers in `dist/index.js` with an [AST node.type](https://github.com/babel/babel/blob/main/packages/babel-parser/ast/spec.md#node-objects) of `StringLiteral`, and that also end with a `.js` extension, to end with an `.mjs` extension instead. Finally, it writes the updated source to `dist/index.mjs`.

**script.js**

```js
import { writeFile } from 'node:fs/promises'
import { specifier } from '@knighted/specifier'

const code = await specifier.update('dist/index.js', ({ type, value }) => {
  if (type === 'StringLiteral') {
    return value.replace(/([^.]+)\.js$/, '$1.mjs')
  }
})

if (!code.error) {
  await writeFile('dist/index.mjs', code)
}
```

You can also provide an object where the keys are regular expressions and the values are the [`replace`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace)ments to make when the regular expression matches.

The following does the same as before.

```js
const code = await specifier.mapper('dist/index.js', {
  '([^.]+)\\.js$': '$1.mjs'
})
```

The order of the keys in the map object matters, the first match found will be used, so the most specific rule should be defined first. Additionally, you can substitute captured regex groups using numbered backreferences.

You can also check out the [reference implementation](https://github.com/knightedcodemonkey/duel).

## `async specifier.update(filename, callback)`

Updates specifiers in `filename` using the values returned from `callback`, and returns the updated file content. The callback is called for each specifier found, and the returned value is used to update the related specifier value. If the callback returns anything other than a string, the return value will be ignored and the specifier not updated.

### Signature

```ts
type Update = (filename: string, callback: (spec: Specifier) => any) => Promise<string | UpdateError>;
```

Where the other types are defined as such.

```ts
interface Position {
  line: number;
  column: number;
}
interface SourceLocation {
  start: Position;
  end: Position;
}
interface UpdateError {
    error: boolean;
    msg: string;
    filename: string | undefined;
    syntaxError: undefined | {
      code: string;
      reasonCode: string;
      pos: number;
      loc: Position;
    }
}
interface Specifier {
    type: 'StringLiteral' | 'TemplateLiteral' | 'BinaryExpression' | 'NewExpression';
    start: number;
    end: number;
    value: string;
    loc: SourceLocation;
}
```

The `Specifier.value` will not include any surrounding quotes or backticks when the `type` is `StringLiteral` or `TemplateLiteral`, and the return value from `callback` is not expected to include them either.


## `async specifier.mapper(filename, regexMap)`

Updates specifiers in `filename` using the provided `regexMap` object and returns the updated file content. The value of the first key to match in `regexMap` is used, so more specific rules should be defined first. Numbered backreferences of captured groups can be used.

### Signature

```ts
type Mapper = (filename: string, regexMap: {[regex: string]: string}) => Promise<string | MapperError>;
```

Where `MapperError` is an alias for `UpdateError` defined above. For the other definitions see [`specifier.update`](https://github.com/knightedcodemonkey/specifier#async-specifierupdatefilename-callback).

## `async specifier.updateCode(code, callback, dts = false)`

Updates specifiers in source `code` using the values returned from `callback`, and returns the updated source code string. If the provided source `code` is from a TypeScript declaration file you should pass `true` for the last argument to support parsing of [ambient contexts](https://stackoverflow.com/a/61082185/258174) in `.d.ts`, `.d.mts`, and `.d.cts` files.

### Signature

```ts
type UpdateCode = (code: string, callback: (spec: Specifier) => any) => Promise<string | UpdateCodeError>;
```

Where `UpdateCodeError` is an alias for `UpdateError`. For the other definitions see [`specifier.update`](https://github.com/knightedcodemonkey/specifier#async-specifierupdatefilename-callback).
