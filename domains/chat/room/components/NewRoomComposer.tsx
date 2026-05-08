"use client";

import { useState } from "react";

import { Skeleton } from "@shared/components/ui/skeleton";
import {
  DEFAULT_AI_MODEL_SLUG,
  type AiModelSlug,
} from "@shared/lib/ai/model-registry";

import { useCurrentUser } from "@domains/auth/queries/useCurrentUser";
import { AiModelSelect } from "@domains/chat/room/components/AiModelSelect";
import { ChatComposerInput } from "@domains/chat/room/components/ChatComposerInput";
import { ChatHeader } from "@domains/chat/room/components/ChatHeader";
import { useNewRoomSubmit } from "@domains/chat/room/hooks/useNewRoomSubmit";

export function NewRoomComposer() {
  const { user, isLoading: sessionLoading } = useCurrentUser();
  const [modelSlug, setModelSlug] = useState<AiModelSlug>(DEFAULT_AI_MODEL_SLUG);
  const { isSubmitting, onSubmit } = useNewRoomSubmit({ modelSlug });

  if (sessionLoading && user == null) {
    return (
      <div className="flex h-full flex-col" aria-busy="true" role="status">
        <span className="sr-only">Loading…</span>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-[min(220px,60vw)]" />
        </div>
        <div className="flex flex-1 flex-col justify-end gap-4 px-4 py-8 sm:justify-center">
          <Skeleton className="h-8 w-[min(100%,20rem)]" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ChatHeader
        right={
          <AiModelSelect
            value={modelSlug}
            onChange={setModelSlug}
            className="w-full max-w-[min(220px,55vw)] sm:w-[220px] sm:max-w-none"
          />
        }
      />

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex min-h-0 flex-1 flex-col justify-end pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:justify-center sm:pb-6">
          <div className="mx-auto w-full min-w-0 max-w-[800px] px-0 sm:px-0">
            <ChatComposerInput
              innerClassName="mx-auto max-w-[800px]"
              disabled={isSubmitting}
              isSending={isSubmitting}
              onSubmit={onSubmit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
