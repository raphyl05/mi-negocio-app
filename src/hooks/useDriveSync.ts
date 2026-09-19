import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { addNetworkStateListener } from 'expo-network';
import { getDriveStatus } from '../services/driveService';
import { getPendingCount, processQueue } from '../services/syncQueue';

export function useDriveSync(): void {
  useEffect(() => {
    let mounted = true;
    const maybeSync = async () => {
      if (!mounted) return;
      try {
        const status = await getDriveStatus();
        if (!status.connected) return;
        const pending = await getPendingCount();
        if (pending === 0) return;
        await processQueue();
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
