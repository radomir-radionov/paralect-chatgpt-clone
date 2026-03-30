"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser-client";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/chat";
  return raw;
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const nextRaw = searchParams.get("next");

  useEffect(() => {
    const next = safeNextPath(nextRaw);
    let cancelled = false;

    void (async () => {
      try {
        const supabase = getBrowserSupabase();
        const { error: sessionError } = await supabase.auth.getSession();
        if (cancelled) return;
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        router.replace(next);
        router.refresh();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Session recovery failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, nextRaw]);

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-muted-foreground text-sm">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
