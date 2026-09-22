import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { addNetworkStateListener } from 'expo-network';
import { getPendingCount, processQueue } from '../services/syncQueue';
import { isOnline } from '../utils/network';
import { syncPullData, syncPushData } from '../services/syncService';
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
        const online = await isOnline();
        if (!online) {
          setSyncStatus('error');
          return;
        }
        setSyncStatus('syncing');
        const pending = await getPendingCount();
        if (pending > 0) {
          await processQueue();
          notify(`Sincronizados ${pending} cambios pendientes`, 'success');
        }
        const business = await getBusiness();
        if (business?.id) {
          await syncPullData(business.id);
        }
        setSyncStatus('idle');
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
