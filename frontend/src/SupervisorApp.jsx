import { useEffect, useState } from "react";
import SupervisorPortal from "./pages/SupervisorPortal.jsx";
import { getSupervisorAccess } from "./services/api.js";

export default function SupervisorApp() {
  const [access, setAccess] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAccess() {
      try {
        const webApp = window.Telegram?.WebApp;
        if (!webApp) throw new Error("Abre la supervisión desde el bot de Telegram.");
        webApp.ready();
        webApp.expand();
        if (!webApp.initData) throw new Error("No se recibió la información de Telegram. Cierra esta ventana y ábrela desde el bot de supervisión.");
        const response = await getSupervisorAccess();
        if (!response.data?.invited) throw new Error("Tu cuenta no fue habilitada desde el grupo de supervisores.");
        setAccess(response.data);
      } catch (loadError) {
        setError(loadError.message || "No fue posible validar tu acceso de supervisor.");
      }
    }
    loadAccess();
  }, []);

  if (error) return <main className="telegram-auth-error"><h1>No fue posible validar tu acceso</h1><p>{error}</p></main>;
  if (!access) return <p className="loading-message">Validando acceso de supervisor...</p>;
  return <SupervisorPortal access={access} />;
}
