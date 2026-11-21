import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

function subscribe(onStoreChange: () => void) {
  const subscription = Appearance.addChangeListener(onStoreChange);
  return () => subscription.remove();
}

function getServerSnapshot() {
  return 'light' as const;
}

/**
 * Keep static HTML and hydration consistent before reading the browser's theme.
 */
export function useColorScheme() {
  return useSyncExternalStore(subscribe, Appearance.getColorScheme, getServerSnapshot);
}
