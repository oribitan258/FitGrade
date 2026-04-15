/**
 * Persistent top-of-screen banner shown when the device loses network
 * connectivity. Overlays all screen content via absolute positioning.
 *
 * Per mobile.md: "a persistent banner at the top of the screen when
 * NetInfo.isConnected === false."
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '../hooks/use-network-status';

export function OfflineBanner(): React.JSX.Element | null {
  const isConnected = useNetworkStatus();
  if (isConnected) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>אין חיבור לאינטרנט</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    // Ensure the banner renders above navigation headers and modals.
    zIndex: 9999,
    elevation: 9999,
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
