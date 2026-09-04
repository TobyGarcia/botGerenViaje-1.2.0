import { useState, useEffect } from 'react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect if already running in standalone mode (installed PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const ua = navigator.userAgent;
    const mobileDetected = /Android|iPhone|iPad|iPod/i.test(ua);
    const iosDetected = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

    setIsMobile(mobileDetected);
    setIsIos(iosDetected);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) return null;

  if (deferredPrompt) {
    return (
      <div
        style={{
          padding: '12px 14px',
          margin: '10px 16px',
          borderRadius: '12px',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #3b82f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
      >
        <div>
          <strong style={{ fontSize: '0.9rem', color: '#60a5fa', display: 'block' }}>
            📲 Instalar App de Viajes
          </strong>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
            Instálala en tu celular para marcar puntos y lecturas 100% sin internet.
          </div>
        </div>
        <button
          onClick={handleInstallClick}
          style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          Instalar
        </button>
      </div>
    );
  }

  if (isIos) {
    return (
      <div
        style={{
          padding: '12px 14px',
          margin: '10px 16px',
          borderRadius: '12px',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #0284c7',
          fontSize: '0.8rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
      >
        <strong style={{ color: '#38bdf8', fontSize: '0.88rem' }}>📱 Instalar en iPhone / iPad (iOS):</strong>
        <div style={{ color: '#cbd5e1', marginTop: '4px', lineHeight: '1.4' }}>
          Para usar la aplicación sin conexión de internet, toca el botón <strong>Compartir</strong> ⎋ en Safari y selecciona <strong>"Agregar a inicio"</strong>.
        </div>
      </div>
    );
  }

  // Fallback for Android/Chrome browser when automatic install prompt hasn't triggered yet
  if (isMobile) {
    return (
      <div
        style={{
          padding: '12px 14px',
          margin: '10px 16px',
          borderRadius: '12px',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #334155',
          fontSize: '0.8rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}
      >
        <strong style={{ color: '#60a5fa', fontSize: '0.88rem' }}>📲 ¿Cómo instalar la App de Viajes?</strong>
        <div style={{ color: '#cbd5e1', marginTop: '4px', lineHeight: '1.4' }}>
          Para operar sin internet: abre el menú del navegador <strong>(⋮ los 3 puntos arriba a la derecha)</strong> y selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a la pantalla de inicio"</strong>.
        </div>
      </div>
    );
  }

  return null;
}
