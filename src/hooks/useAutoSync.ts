import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { addNetworkStateListener } from 'expo-network';
import { isOnline } from '../utils/network';
import { syncPullData, syncPushData, getLastCursor } from '../services/syncService';
import { ensureSyncState } from '../services/syncStateService';
import { apiRegisterDevice } from '../services/syncApi';
import { getBusiness } from '../services/setupService';
import { useNotifications } from '../contexts/NotificationContext';

export type SyncStatus = 'idle' | 'syncing' | 'error';

export function useAutoSync(): SyncStatus {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const { notify } = useNotifications();

  useEffect(() => {
    let mounted = true;

    const maybeSync = async () => {
      if (!mounted) return;
      try {
        const business = await getBusiness();
        if (!business?.id) return setSyncStatus('idle');

        const online = await isOnline();
        if (!online) {
          setSyncStatus('error');
          return;
        }

        setSyncStatus('syncing');
        await ensureSyncState(business.id);

        try {
          await apiRegisterDevice(business.id, 'admin');
        } catch {
          // Registro idempotente: si el device ya existe, se ignora.
        }

        const push = await syncPushData(business.id);
        const cursor = await getLastCursor(business.id);
        const pull = await syncPullData(business.id, cursor);

        const errors = [...push.errors, ...pull.errors];
        if (errors.length > 0) {
          setSyncStatus('error');
          notify(`Error de sincronización: ${errors[0]}`, 'error');
          return;
        }

        setSyncStatus('idle');
        const total = push.pushed + pull.pulled;
        if (total > 0) notify(`Sincronizados ${total} cambios`, 'success');
      } catch {
        setSyncStatus('error');
        notify('Error de sincronización. Reintentando al reconectarse.', 'error');
      }
    };

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') maybeSync();
    };
    const onNetwork = () => maybeSync();
    const subApp = AppState.addEventListener('change', onAppState);
    const subNet = addNetworkStateListener(onNetwork);

    maybeSync();

    return () => {
      mounted = false;
      subApp.remove();
      subNet.remove();
    };
  }, [notify]);

  return syncStatus;
}