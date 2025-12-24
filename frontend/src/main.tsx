import React from 'react'
import ReactDOM from 'react-dom/client'
import config from 'devextreme/core/config'

import App from './App'
import 'devextreme/dist/css/dx.material.teal.light.css'
import './styles/app.css'

const licenseKey = import.meta.env.VITE_DEVEXTREME_LICENSE
if (licenseKey) {
  config({ licenseKey })
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
