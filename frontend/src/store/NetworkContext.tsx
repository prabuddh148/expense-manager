import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type NetworkContextValue = {
  isOnline: boolean;
  /** Null while the first check is still running. */
  isInternetReachable: boolean | null;
};

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  isInternetReachable: null,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NetworkContextValue>({
    isOnline: true,
    isInternetReachable: null,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((info) => {
      setState({
        // isInternetReachable is null until probed; treat that as connected so the UI
        // does not flash an offline banner on launch.
        isOnline: Boolean(info.isConnected) && info.isInternetReachable !== false,
        isInternetReachable: info.isInternetReachable,
      });
    });
    return unsubscribe;
  }, []);

  const value = useMemo(() => state, [state]);
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export const useNetwork = () => useContext(NetworkContext);
