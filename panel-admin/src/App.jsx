import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import "./App.css";

import LoginPage
  from "./pages/LoginPage.jsx";

import DashboardPage
  from "./pages/DashboardPage.jsx";

import EvaluacionApp
  from "./pages/EvaluacionApp.jsx";

import {
  getAdminSession,
  logoutAdmin
} from "./services/api.js";


const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

function App() {
  const [sessionLoading, setSessionLoading] =
    useState(true);

  const [adminUser, setAdminUser] =
    useState(null);

  const inactivityTimeoutRef = useRef(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const response =
          await getAdminSession();

        setAdminUser(
          response.data.user
        );
      } catch {
        setAdminUser(null);
      } finally {
        setSessionLoading(false);
      }
    }

    loadSession();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logoutAdmin();
    } finally {
      setAdminUser(null);
    }
  }, []);

  useEffect(() => {
    if (!adminUser) {
      return undefined;
    }

    const resetInactivityTimer = () => {
      if (inactivityTimeoutRef.current) {
        window.clearTimeout(inactivityTimeoutRef.current);
      }

      inactivityTimeoutRef.current = window.setTimeout(() => {
        handleLogout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart"
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, {
        passive: true
      });
    });

    resetInactivityTimer();

    return () => {
      if (inactivityTimeoutRef.current) {
        window.clearTimeout(inactivityTimeoutRef.current);
      }

      activityEvents.forEach((eventName) => {
        window.removeEventListener(
          eventName,
          resetInactivityTimer
        );
      });
    };
  }, [adminUser, handleLogout]);

  if (sessionLoading) {
    return (
      <main className="session-loading">
        Validando sesión...
      </main>
    );
  }

  if (!adminUser) {
    return (
      <LoginPage
        onAuthenticated={
          setAdminUser
        }
      />
    );
  }

  if (window.location.pathname.startsWith("/evaluacion")) {
    return (
      <EvaluacionApp
        user={adminUser}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <DashboardPage
      user={adminUser}
      onLogout={handleLogout}
    />
  );
}


export default App;
