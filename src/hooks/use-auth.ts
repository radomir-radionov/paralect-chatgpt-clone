"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  /** True only until the first auth resolution completes (initial shell / layout). */
  const [isLoading, setIsLoading] = useState(true);
  /** True during any in-flight /api/auth/me request (refetches do not flash the main skeleton). */
  const [isFetching, setIsFetching] = useState(false);

  const refetch = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = (await res.json()) as { user: User | null };
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { user, isLoading, isFetching, refetch };
}
