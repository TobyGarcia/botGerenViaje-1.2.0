import { useState, useEffect } from 'react';
import { countPendingLocations } from '../services/tracking-storage';
import { syncPendingLocations } from '../services/tracking-service';

export default function OfflineBanner({ idViaje }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const checkPending = async () => {
    if (!idViaje) {
      setPendingCount(0);
      return;
    }
    try {
      const count = await countPendingLocations(idViaje);
      setPendingCount(count);
    } catch {
      setPendingCount(0);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (idViaje) {
        setIsSyncing(true);
        syncPendingLocations(idViaje).finally(() => {
          setIsSyncing(false);
          checkPending();
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(checkPending, 5000);
    checkPending();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [idViaje]);

  const handleManualSync = async () => {
    if (!idViaje || isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      await syncPendingLocations(idViaje);
    } finally {
      setIsSyncing(false);
      checkPending();
    }
  };

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div
      style={{
        padding: '8px 14px',
        margin: '8px 0',
        borderRadius: '8px',
        fontSize: '0.85rem',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: !isOnline ? '#7f1d1d' : '#854d0e',
        color: '#ffffff',
        border: `1px solid ${!isOnline ? '#ef4444' : '#eab308'}`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.1rem' }}>{!isOnline ? '📡' : '🔄'}</span>
        <div>
          {!isOnline ? (
            <div>
              <strong>Sin conexión a internet</strong>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                Las lecturas se guardan localmente con fecha y hora actual.
              </div>
            </div>
          ) : (
            <div>
              <strong>Sincronizando datos...</strong>
            </div>
          )}
          {pendingCount > 0 && (
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginTop: '2px' }}>
              {pendingCount} {pendingCount === 1 ? 'lectura/punto pendiente' : 'lecturas/puntos pendientes'} por enviar
            </div>
          )}
        </div>
      </div>

      {isOnline && pendingCount > 0 && (
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          style={{
            background: '#ffffff',
            color: '#854d0e',
            border: 'none',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {isSyncing ? 'Enviando...' : 'Sincronizar ahora'}
        </button>
      )}
    </div>
  );
}
