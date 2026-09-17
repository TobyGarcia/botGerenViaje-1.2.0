import { useState, useEffect } from 'react';
import { countPendingLocations } from '../services/tracking-storage';
import { syncPendingLocations } from '../services/tracking-service';
import { countPendingSiniestros } from '../services/siniestro-storage';
import { syncPendingSiniestros, onSiniestroSyncEvent } from '../services/siniestro-sync';
import { IconRefresh, IconAlert } from './Icons.jsx';

export default function OfflineBanner({ idViaje }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingSiniestroCount, setPendingSiniestroCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const checkPending = async () => {
    try {
      if (idViaje) {
        const count = await countPendingLocations(idViaje);
        setPendingCount(count);
      } else {
        setPendingCount(0);
      }
      const sCount = await countPendingSiniestros();
      setPendingSiniestroCount(sCount);
    } catch {
      setPendingCount(0);
      setPendingSiniestroCount(0);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      Promise.all([
        idViaje ? syncPendingLocations(idViaje) : Promise.resolve(),
        syncPendingSiniestros()
      ]).finally(() => {
        setIsSyncing(false);
        checkPending();
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = onSiniestroSyncEvent(() => {
      checkPending();
    });

    const interval = setInterval(checkPending, 5000);
    checkPending();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      clearInterval(interval);
    };
  }, [idViaje]);

  const handleManualSync = async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      await Promise.all([
        idViaje ? syncPendingLocations(idViaje) : Promise.resolve(),
        syncPendingSiniestros()
      ]);
    } finally {
      setIsSyncing(false);
      checkPending();
    }
  };

  const totalPending = pendingCount + pendingSiniestroCount;

  if (isOnline && totalPending === 0) {
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
        <span style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}>{!isOnline ? <IconAlert size={18} color="#ffffff" /> : <IconRefresh size={18} color="#ffffff" className="spin" />}</span>
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
          {totalPending > 0 && (
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginTop: '2px' }}>
              {pendingCount > 0 && <span>{pendingCount} {pendingCount === 1 ? 'punto GPS' : 'puntos GPS'}</span>}
              {pendingCount > 0 && pendingSiniestroCount > 0 && <span> y </span>}
              {pendingSiniestroCount > 0 && <span><IconAlert size={14} color="#ffffff" /> {pendingSiniestroCount} {pendingSiniestroCount === 1 ? 'reporte de siniestro' : 'reportes de siniestros'}</span>}
              <span> por enviar</span>
            </div>
          )}
        </div>
      </div>

      {isOnline && totalPending > 0 && (
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
