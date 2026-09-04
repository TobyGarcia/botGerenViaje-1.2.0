import { useState, useEffect } from 'react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Detect if already running in standalone mode (installed PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS Safari
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIos) {
      setShowIosGuide(true);
    }

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
          padding: '10px 14px',
          marginBottom: '12px',
          borderRadius: '10px',
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          border: '1px solid #3b82f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)'
        }}
      >
        <div>
          <strong style={{ fontSize: '0.9rem', color: '#60a5fa' }}>📲 Instalar App de Viajes</strong>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Instálala en tu celular para operar 100% sin internet.
          </div>
        </div>
        <button
          onClick={handleInstallClick}
          style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Instalar
        </button>
      </div>
    );
  }

  if (showIosGuide) {
    return (
      <div
        style={{
          padding: '10px 14px',
          marginBottom: '12px',
          borderRadius: '10px',
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          border: '1px solid #0284c7',
          fontSize: '0.8rem'
        }}
      >
        <strong style={{ color: '#38bdf8' }}>📱 Instalar en iPhone / iPad (iOS):</strong>
        <div style={{ color: '#cbd5e1', marginTop: '4px' }}>
          Para usar sin internet, toca el botón <strong>Compartir</strong> ⎋ en Safari y selecciona <strong>"Agregar a inicio"</strong>.
        </div>
      </div>
    );
  }

  return null;
}
