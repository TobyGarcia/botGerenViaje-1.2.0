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

  const cardStyle = {
    width: '100%',
    maxWidth: '360px',
    margin: '0 auto 14px auto',
    padding: '14px 16px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    color: '#ffffff',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.35)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  };

  if (deferredPrompt) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>📲</span>
            <div>
              <strong style={{ fontSize: '0.92rem', color: '#60a5fa', display: 'block', lineHeight: '1.2' }}>
                Instalar App de Viajes
              </strong>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Disponible para usar 100% sin internet
              </span>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
              transition: 'transform 0.15s ease'
            }}
          >
            Instalar
          </button>
        </div>
      </div>
    );
  }

  if (isIos) {
    return (
      <div style={{ ...cardStyle, border: '1px solid rgba(2, 132, 199, 0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>📱</span>
          <strong style={{ color: '#38bdf8', fontSize: '0.88rem' }}>Instalar en iPhone / iPad (iOS)</strong>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.4' }}>
          Toca el botón <strong>Compartir</strong> ⎋ en Safari y elige <strong>"Agregar a inicio"</strong> para operar sin internet.
        </div>
      </div>
    );
  }

  // Fallback for Android/Chrome browser when automatic install prompt hasn't triggered yet
  if (isMobile) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>📲</span>
          <strong style={{ color: '#60a5fa', fontSize: '0.88rem' }}>¿Cómo usar sin internet?</strong>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.4' }}>
          Abre el menú de Chrome <strong>(⋮ 3 puntos arriba a la derecha)</strong> y selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a inicio"</strong>.
        </div>
      </div>
    );
  }

  return null;
}
