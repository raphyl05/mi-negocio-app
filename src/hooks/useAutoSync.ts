import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { addNetworkStateListener } from 'expo-network';
import { getPendingCount, processQueue } from '../services/syncQueue';
import { isOnline } from '../utils/network';
import { syncPullData, syncPushData } from '../services/syncService';
import { getBusiness } from '../services/setupService';

export function useAutoSync(): void {
  useEffect(() => {
    let mounted = true;
    const maybeSync = async () => {
      if (!mounted) return;
      try {
        const online = await isOnline();
        if (!online) return;
        const pending = await getPendingCount();
        if (pending > 0) {
          await processQueue();
        }
        const business = await getBusiness();
        if (business?.id) {
          await syncPullData(business.id);
        }
      } catch { /* ignorar en segundo plano */ }
    };
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') maybeSync();
    };
    const onNetwork = () => maybeSync();
    const subApp = AppState.addEventListener('change', onAppState);
    const subNet = addNetworkStateListener(onNetwork);
    return () => {
      mounted = false;
      subApp.remove();
      subNet.remove();
    };
  }, []);
}
