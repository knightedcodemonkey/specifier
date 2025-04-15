export const routes = {
  all: {
    paths: ['*'],
    components: {
      interface: () =>
        require(
          './user.js'
        ),
    },
  },
};

function foo () {
  require('./code.js')
}

const bar = () => {
  require('./code.js')
}

(() => require('./code.js'))()
