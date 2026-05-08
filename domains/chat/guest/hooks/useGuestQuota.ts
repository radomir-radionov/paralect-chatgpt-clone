"use client";

import { useEffect, useState } from "react";

import {
  type GuestQuotaResponse,
  clampGuestRemainingQuestions,
} from "@domains/chat/guest/lib/guestChatClientQuota";
import { GUEST_FREE_QUESTION_LIMIT } from "@domains/chat/guest/lib/guestQuotaConstants";

export function useGuestQuota() {
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);

  const remainingQuestions = clampGuestRemainingQuestions(
    quotaRemaining ?? GUEST_FREE_QUESTION_LIMIT,
  );
  const hasReachedLimit = remainingQuestions <= 0;

  useEffect(() => {
    let cancelled = false;

    async function loadQuotaFromServer() {
      try {
        const response = await fetch("/api/guest/quota", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as GuestQuotaResponse;
        if (!cancelled && !data.error) {
          setQuotaRemaining(clampGuestRemainingQuestions(data.remaining));
        }
      } catch {
        // Keep the local quota state if the status request fails.
      }
    }

    void loadQuotaFromServer();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    remainingQuestions,
    hasReachedLimit,
    setQuotaRemaining,
  };
}
