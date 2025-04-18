import './path/to/side-effect.js'

const Component = () => {
  return (
    <button onClick={() => import('./dynamic.js')}>I am a component.</button>
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
