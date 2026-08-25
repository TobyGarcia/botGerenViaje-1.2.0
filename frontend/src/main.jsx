import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SupervisorApp from './SupervisorApp.jsx'

const isSupervisorPath =
  import.meta.env.VITE_APP_MODE === "supervisor" ||
  window.location.pathname.startsWith("/supervisor");

const RootApp = isSupervisorPath ? SupervisorApp : App;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
