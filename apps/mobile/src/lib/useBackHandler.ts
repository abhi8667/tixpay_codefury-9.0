import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * Run `handler` when the Android hardware/gesture back is triggered.
 *
 * Return true to say "I consumed this"; return false (or pass `enabled: false`)
 * to let the next listener — and ultimately Android itself — have it. RN walks
 * its listeners newest-first, so a modal that mounts after the screen beneath
 * it gets the event first, which is exactly the order a back stack wants.
 *
 * The handler is held in a ref so a fresh closure every render does not churn
 * the subscription; only `enabled` re-subscribes.
 */
export function useBackHandler(handler: () => boolean, enabled: boolean = true): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => handlerRef.current());
    return () => sub.remove();
  }, [enabled]);
}
