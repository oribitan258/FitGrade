/**
 * Returns whether the device currently has network connectivity.
 *
 * Subscribes to @react-native-community/netinfo and emits a new value
 * whenever the connection state changes. Defaults to `true` until the
 * first NetInfo event arrives to avoid a false-offline flash on mount.
 *
 * Used by: OfflineBanner (UI), useOfflineQueueFlush (_layout).
 */

import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import type { NetInfoState } from '@react-native-community/netinfo';

export function useNetworkStatus(): boolean {
  // Default true to avoid a false "offline" flash before first NetInfo event.
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
    });
    return unsubscribe;
  }, []);

  return isConnected;
}
