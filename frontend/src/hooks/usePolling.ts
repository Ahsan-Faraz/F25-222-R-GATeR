// Generic polling hook

import { useEffect, useRef, useCallback } from 'react';

export function usePolling(
  callback: () => void | Promise<void>,
  interval: number,
  enabled: boolean = true
) {
  const savedCallback = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Update callback ref when it changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const tick = useCallback(async () => {
    try {
      await savedCallback.current();
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
      }
      return;
    }

    // Run immediately
    tick();

    // Then set up interval
    timeoutRef.current = setInterval(tick, interval);

    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
      }
    };
  }, [interval, enabled, tick]);
}
