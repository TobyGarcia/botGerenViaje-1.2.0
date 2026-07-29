import {
  useEffect,
  useState
} from "react";

import "./App.css";

import LoginPage
  from "./pages/LoginPage.jsx";

import DashboardPage
  from "./pages/DashboardPage.jsx";

import {
  getAdminSession,
  logoutAdmin
} from "./services/api.js";

function App() {
  const [sessionLoading, setSessionLoading] =
    useState(true);

  const [adminUser, setAdminUser] =
    useState(null);

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

  async function handleLogout() {
    try {
      await logoutAdmin();
    } finally {
      setAdminUser(null);
    }
  }

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

  return (
    <DashboardPage
      user={adminUser}
      onLogout={handleLogout}
    />
  );
}

export default App;