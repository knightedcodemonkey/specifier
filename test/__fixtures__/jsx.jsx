import './path/to/side-effect.js'

const Component = () => {
  return (
    <p>I am a component.</p>
  )
}
const App = () => {
  return (
    <>
      <p>I am an app using component.</p>
      <Component />
    </>
  )
}

export { App }
export { something } from './somewhere.js'
