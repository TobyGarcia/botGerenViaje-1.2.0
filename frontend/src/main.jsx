import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SupervisorApp from './SupervisorApp.jsx'
import EvaluacionApp from './pages/EvaluacionApp.jsx'

const pathname = window.location.pathname;
const urlParams = new URLSearchParams(window.location.search);
const stateParam = urlParams.get("state");

let RootApp = App;
if (
  import.meta.env.VITE_APP_MODE === "supervisor" ||
  pathname.startsWith("/supervisor") ||
  stateParam === "supervisor"
) {
  RootApp = SupervisorApp;
} else if (import.meta.env.VITE_APP_MODE === "evaluacion" || pathname.startsWith("/evaluacion")) {
  RootApp = EvaluacionApp;
}


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
