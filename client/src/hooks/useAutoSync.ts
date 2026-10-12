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
  intervalMs?: number; // Default 6000ms (6 seconds)
  enabled?: boolean;
  immediate?: boolean; // Default true: trigger immediately on mount
}

/**
 * Instagram-Grade Seamless Background Auto-Sync Hook:
 * Keeps data updated in the background silently without spinners or visual interruption:
 * 1. Immediate fetch on mount (with cached data displayed instantly)
 * 2. Instant silent background refresh whenever user touches, taps, clicks or scrolls
 * 3. Instant silent refresh when user unlocks phone or switches back to app (visibilitychange)
 * 4. Instant silent refresh on browser back/forward navigation (pageshow / bfcache)
 * 5. Instant silent refresh on window focus
 * 6. Instant silent refresh when device reconnects online
 * 7. Periodic background heartbeat interval (every 6s while visible)
 */
export function useAutoSync(
  syncFn: (silent: boolean) => Promise<void> | void,
  options: AutoSyncOptions = {}
): void {
  const { intervalMs = 6000, enabled = true, immediate = true } = options;
  const syncFnRef = useRef(syncFn);
  syncFnRef.current = syncFn;

  const lastSyncTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    // Helper to safely execute silent background sync
    const executeSilentSync = () => {
      const now = Date.now();
      lastSyncTimeRef.current = now;
      try {
        Promise.resolve(syncFnRef.current(true)).catch(() => {});
      } catch {
        // Silent failure in background - never disturb user
      }
    };

    // Trigger immediately on mount if immediate is true
    if (immediate) {
      syncFnRef.current(false);
      lastSyncTimeRef.current = Date.now();
    }

    // 1. Action listener: Any purchase, payment, or edit triggers instant silent sync
    const handleDataChanged = () => {
      executeSilentSync();
    };

    // 2. User Interaction: Whenever user touches, taps, or clicks (throttled to once per 4s)
    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastSyncTimeRef.current >= 4000) {
        executeSilentSync();
      }
    };

    // 3. Visibility change: When user switches back from WhatsApp/browser or unlocks phone
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        executeSilentSync();
      }
    };

    // 4. Page show (back/forward cache navigation)
    const handlePageShow = () => {
      executeSilentSync();
    };

    // 5. Window focus
    const handleFocus = () => {
      executeSilentSync();
    };

    // 6. Online reconnection
    const handleOnline = () => {
      executeSilentSync();
    };

    window.addEventListener(MILK_DATA_CHANGED_EVENT, handleDataChanged);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    // Passive interaction listeners for touch & click
    window.addEventListener('pointerdown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('click', handleUserInteraction, { passive: true });

    // 7. Silent background heartbeat interval (every 6 seconds while visible)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        executeSilentSync();
      }
    }, intervalMs);

    return () => {
      window.removeEventListener(MILK_DATA_CHANGED_EVENT, handleDataChanged);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pointerdown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('click', handleUserInteraction);
      clearInterval(timer);
    };
  }, [intervalMs, enabled, immediate]);
}
