import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SupervisorApp from './SupervisorApp.jsx'
import EvaluacionApp from './pages/EvaluacionApp.jsx'

const pathname = window.location.pathname;

let RootApp = App;
if (import.meta.env.VITE_APP_MODE === "supervisor" || pathname.startsWith("/supervisor")) {
  RootApp = SupervisorApp;
} else if (import.meta.env.VITE_APP_MODE === "evaluacion" || pathname.startsWith("/evaluacion")) {
  RootApp = EvaluacionApp;
}


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
