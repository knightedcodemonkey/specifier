# [`@knighted/specifier`](https://www.npmjs.com/package/@knighted/specifier)

![CI](https://github.com/knightedcodemonkey/specifier/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/knightedcodemonkey/specifier/branch/main/graph/badge.svg?token=5KS9ZB3XDK)](https://codecov.io/gh/knightedcodemonkey/specifier)
[![NPM version](https://img.shields.io/npm/v/@knighted/specifier.svg)](https://www.npmjs.com/package/@knighted/specifier)

Node.js tool for updating your ESM `import` and `export` specifiers, before or after your build.

## Example

The following script will update all specifiers in `dist/index.cjs` with an [ESTree node.type](https://github.com/estree/estree/blob/master/es5.md#node-objects) of `Literal`, and that also end with a `.js` extension, to end with a `.cjs` extension instead.

**script.js**

```js
import { specifier } from '@knighted/specifier'

const code = specifier.update('dist/index.cjs', ({ type, value }) => {
  if (type === 'Literal') {
    return value.replace(/([^.]+)\.js$/, '$1.cjs')
  }
})
```

Now `code` can be used to write the updated source to a file.

You can also provide an object where the keys are regular expressions and the values are the [`replace`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace)ments to make when the regular expression matches.

The following does the same as before.

```js
const code = specifier.mapper('dist/index.cjs', {
  '([^.]+)\\.js$': '$1.cjs'
})
```

The order of the keys in the map object matters, the first match found will be used, so the most specific rule should be defined first.


## `specifier.update(filename, callback)`

Updates specifiers in `filename` using the values returned from `callback`, and returns the updated file contents. The callback is called for each specifier found, and the returned value is used to update the related specifier value. If the callback returns anything other than a string, the return value will be ignored and the specifier not updated.

### Signature

```ts
type Update = (filename: string, callback: (spec: Specifier) => any) => string | UpdateError;
```

Where the other types are defined as such.

```ts
interface SourceLocation {
  start: {
    line: number;
    column: number;
  },
  end: {
    line: number;
    column: number;
  }
}
interface UpdateError {
    error: boolean;
    msg: string;
    filename: string;
    syntaxError: boolean;
    errorContext: undefined | {
      pos: number;
      raisedAt: number;
      loc: SourceLocation
    }
}
interface Specifier {
    type: string;
    start: number;
    end: number;
    value: string;
    loc: SourceLocation;
}
```

The `Specifier.value` will not include any quotes or backticks when the `type` is `Literal` or `TemplateLiteral`, and the return value from `callback` is not expected to inclued them either.


## `specifier.mapper(filename, regexMap)`

Updates specifiers in `filename` using the provided `regexMap` object and returns the updated file contents. The value of the first key to match in `regexMap` is used, so more specific rules should be defined first.

### Signature

```ts
type Mapper = (filename: string, regexMap: {[k: string]: string}) => string | MapperError;
```

Where `MapperError` is an alias for `UpdateError` defined above.
