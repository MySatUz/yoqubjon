import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  getLiveRun,
  getServerLiveRun,
  parseStoredRun,
  readStoredRunRaw,
  subscribeWarmup,
} from '@/lib/landing/warmup';

// Hooks shared by the landing's client islands. Imported only from 'use client'
// components; the server page never calls them.

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Follows the OS setting live, and renders as "motion allowed" on the server. */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => false,
  );
}

/** Whether any of the element is on screen, for pausing loops that are not. */
export function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, onScreen] as const;
}

/**
 * The warm-up as the echoes see it: the run in progress on this page, and the
 * last finished run from sessionStorage. Both read as empty on the server, so
 * the first paint is the same everywhere and the echo arrives after hydration.
 */
export function useWarmupEcho() {
  const live = useSyncExternalStore(subscribeWarmup, getLiveRun, getServerLiveRun);
  const raw = useSyncExternalStore(subscribeWarmup, readStoredRunRaw, () => null);
  const stored = useMemo(() => parseStoredRun(raw), [raw]);
  return { live, stored };
}

const noSubscription = () => () => {};

/** `location.search + location.hash`, read after hydration; empty on the server. */
export function useLocationQuery() {
  const search = useSyncExternalStore(noSubscription, () => window.location.search, () => '');
  const hash = useSyncExternalStore(noSubscription, () => window.location.hash, () => '');
  return { search, hash };
}
