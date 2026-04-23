"use client";

import { useCallback, useRef } from "react";

type Options = {
  rootMargin?: string;
  enabled?: boolean;
};

/**
 * Returns a ref callback that fires `onIntersect` once when the attached
 * element first scrolls into view. Re-arms whenever the callback identity
 * changes (e.g. after the previous trigger element is no longer the topmost).
 */
export function useIntersectionTrigger(
  onIntersect: () => void,
  { rootMargin = "50px", enabled = true }: Options = {},
) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  return useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!enabled || node == null) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              observer.disconnect();
              observerRef.current = null;
              onIntersect();
            }
          });
        },
        { rootMargin },
      );

      observer.observe(node);
      observerRef.current = observer;
    },
    [enabled, onIntersect, rootMargin],
  );
}
