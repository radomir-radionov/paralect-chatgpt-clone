"use client";

import { LoaderCircleIcon, SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@shared/components/ui/input-group";
import {
  AI_MODELS,
  DEFAULT_AI_MODEL_SLUG,
  type AiModelSlug,
} from "@shared/lib/ai/model-registry";
import { cn } from "@shared/lib/utils";

import { useCurrentUser } from "@domains/auth/queries/useCurrentUser";
import { ChatHeader } from "@domains/chat/components/ChatHeader";
import { ChatMessage } from "@domains/chat/components/ChatMessage";
import { useStartRoomWithFirstMessage } from "@domains/chat/mutations/useStartRoomWithFirstMessage";

const MAX_LENGTH = 2000;

type OptimisticBubble = {
  id: string;
  text: string;
  createdAt: string;
};

export function NewRoomComposer() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const mutation = useStartRoomWithFirstMessage(user?.id ?? null);

  const [message, setMessage] = useState("");
  const [modelSlug, setModelSlug] = useState<AiModelSlug>(
    DEFAULT_AI_MODEL_SLUG,
  );
  const [optimistic, setOptimistic] = useState<OptimisticBubble | null>(null);

  const remaining = MAX_LENGTH - message.length;
  const isOverLimit = remaining < 0;
  const showCounter = remaining <= 200;

  async function handleSubmit(e?: { preventDefault(): void }) {
    e?.preventDefault();
    const text = message.trim();
    if (!text || mutation.isPending || isOverLimit) return;

    setMessage("");
    const messageId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    setOptimistic({ id: messageId, text, createdAt });

    const result = await mutation.mutateAsync({
      messageId,
      text,
      modelSlug,
    });

    if (result.error) {
      toast.error(result.message);
      if (result.roomId) {
        router.push(`/rooms/${result.roomId}`);
      }
      return;
    }

    router.push(`/rooms/${result.roomId}`);
  }

  return (
    <div className="h-full flex flex-col">
      <ChatHeader
        right={
          <>
            <label className="text-xs text-muted-foreground hidden sm:block">
              Model
            </label>
            <select
              value={modelSlug}
              onChange={(e) => setModelSlug(e.target.value as AiModelSlug)}
              disabled={mutation.isPending}
              className={cn(
                "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow]",
                "focus-visible:ring-[3px]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "w-[220px] max-w-[60vw]",
              )}
              aria-label="AI model"
            >
              {AI_MODELS.map((model) => (
                <option key={model.slug} value={model.slug}>
                  {model.label}
                </option>
              ))}
            </select>
          </>
        }
      />

      <div className="flex-1 min-h-0 flex flex-col">
        {optimistic ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="py-2">
                <ChatMessage
                  id={optimistic.id}
                  text={optimistic.text}
                  created_at={optimistic.createdAt}
                  author_id={user?.id ?? "pending-user"}
                  role="user"
                  author={{ name: "You", image_url: null }}
                  isOwn
                  status="pending"
                />
                <ChatMessage
                  id="optimistic-assistant"
                  text="Thinking…"
                  created_at={optimistic.createdAt}
                  author_id={null}
                  role="assistant"
                  author={{ name: "Assistant", image_url: null }}
                  isOwn={false}
                  status="pending"
                />
              </div>
            </div>

            <div className="px-0 py-3 border-t shrink-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                Creating chat…
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
            <div className="w-full max-w-2xl -translate-y-20">
              <p className="text-2xl font-semibold tracking-tight">
                Ready when you are.
              </p>

              <form onSubmit={handleSubmit} className="mt-5">
                <InputGroup data-disabled={mutation.isPending || undefined}>
                  <InputGroupTextarea
                    placeholder="Ask anything…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="field-sizing-content min-h-auto max-h-40"
                    disabled={mutation.isPending}
                    aria-invalid={isOverLimit || undefined}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                  />
                  <InputGroupAddon
                    align="inline-end"
                    className="self-end pb-1.5"
                  >
                    {showCounter && (
                      <span
                        className={
                          isOverLimit
                            ? "text-xs text-destructive font-medium"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {remaining}
                      </span>
                    )}
                    <InputGroupButton
                      type="submit"
                      aria-label="Send"
                      title="Send (Enter)"
                      size="icon-sm"
                      disabled={
                        mutation.isPending || !message.trim() || isOverLimit
                      }
                    >
                      {mutation.isPending ? (
                        <LoaderCircleIcon className="animate-spin" />
                      ) : (
                        <SendIcon />
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <p className="mt-1.5 text-xs text-muted-foreground/60 hidden sm:block">
                  Enter to send · Shift+Enter for new line
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
