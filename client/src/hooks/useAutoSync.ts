import { useEffect, useRef } from 'react';

/**
 * Global event name for notifying all active pages and tabs to sync fresh data
 */
export const MILK_DATA_CHANGED_EVENT = 'milk_data_changed';

/**
 * Triggers a global silent data refresh across all active components and tabs.
 * Call this immediately whenever milk is added, edited, deleted, or paid!
 */
export function notifyDataChanged(): void {
  window.dispatchEvent(new CustomEvent(MILK_DATA_CHANGED_EVENT));
}

interface AutoSyncOptions {
  intervalMs?: number; // Default 8000ms (8 seconds)
  enabled?: boolean;
  immediate?: boolean; // Default true: trigger immediately on mount
}

/**
 * Hook that keeps data silently synced in the background like Instagram:
 * 1. Immediate fetch on mount so pages never get stuck loading
 * 2. Periodic background polling (every 8-10s) without showing full-page spinners
 * 3. Instant silent refresh when user unlocks phone or switches back to app (visibilitychange)
 * 4. Instant silent refresh on window focus
 * 5. Instant silent refresh when device reconnects online
 * 6. Instant silent refresh across tabs/screens when ANY action is performed
 */
export function useAutoSync(
  syncFn: (silent: boolean) => Promise<void> | void,
  options: AutoSyncOptions = {}
): void {
  const { intervalMs = 8000, enabled = true, immediate = true } = options;
  const syncFnRef = useRef(syncFn);
  syncFnRef.current = syncFn;

  useEffect(() => {
    if (!enabled) return;

    // Trigger immediately on mount if immediate is true
    if (immediate) {
      syncFnRef.current(false);
    }

    // 1. Action listener: Any purchase, payment, or edit triggers instant silent sync
    const handleDataChanged = () => {
      syncFnRef.current(true);
    };

    // 2. Visibility change: When user switches back from another app or unlocks phone
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncFnRef.current(true);
      }
    };

    // 3. Window focus
    const handleFocus = () => {
      syncFnRef.current(true);
    };

    // 4. Online reconnection
    const handleOnline = () => {
      syncFnRef.current(true);
    };

    window.addEventListener(MILK_DATA_CHANGED_EVENT, handleDataChanged);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    // 5. Silent background heartbeat interval
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncFnRef.current(true);
      }
    }, intervalMs);

    return () => {
      window.removeEventListener(MILK_DATA_CHANGED_EVENT, handleDataChanged);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      clearInterval(timer);
    };
  }, [intervalMs, enabled, immediate]);
}
