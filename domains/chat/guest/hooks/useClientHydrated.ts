"use client";

import { useSyncExternalStore } from "react";

/**
 * `false` during SSR + first client render, `true` after hydration.
 */
export function useClientHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
