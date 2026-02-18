import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: { fontFamily: 'DM Sans, system-ui', fontSize: '14px', borderRadius: '12px' },
      }} />
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
