"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser-client";

/**
 * Supabase email confirmation may redirect to `/chat#access_token=…` (implicit flow).
 * The fragment is not sent to the server; `getSession()` in the browser persists cookies.
 */
export function useRecoverAuthHash(refetchAuth: () => Promise<void>) {
  const router = useRouter();
  const ranRef = useRef(false);

  useLayoutEffect(() => {
    if (ranRef.current) return;
    if (typeof window === "undefined") return;
    if (!window.location.hash.includes("access_token=")) return;
    ranRef.current = true;

    void (async () => {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.getSession();
      if (error) return;
      const cleanUrl = `${window.location.pathname}${window.location.search}`;
      router.replace(cleanUrl);
      router.refresh();
      await refetchAuth();
    })();
  }, [refetchAuth, router]);
}
