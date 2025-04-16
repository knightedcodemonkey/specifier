type RouteMap = Record<string, object>

export const routes: RouteMap = {
  all: {
    paths: ['*'],
    components: {
      interface: () =>
        import(
          /* webpackChunkName: "user" */
          './user.js'
        ),
    },
  },
};

function foo () {
  import('./code.js')
}

const bar = () => {
  import('./code.js')
}

(() => import('./code.js'))()

const importOther = () => {
  import(`./code.js`).then((mod) => {});
}

const importOtherOther = () => {
  import(`./code.js`)
}
