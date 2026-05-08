"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { Button, buttonVariants } from "@shared/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@shared/components/ui/empty";
import { cn } from "@shared/lib/utils";

import { AiModelSelect } from "@domains/chat/room/components/AiModelSelect";
import { ChatComposerInput } from "@domains/chat/room/components/ChatComposerInput";
import { ChatMessage } from "@domains/chat/room/components/ChatMessage";
import { useClientHydrated } from "@domains/chat/guest/hooks/useClientHydrated";
import { useGuestChatStorage } from "@domains/chat/guest/hooks/useGuestChatStorage";
import { useGuestChatSubmit } from "@domains/chat/guest/hooks/useGuestChatSubmit";
import { useGuestQuota } from "@domains/chat/guest/hooks/useGuestQuota";
import { GUEST_FREE_QUESTION_LIMIT } from "@domains/chat/guest/lib/guestQuotaConstants";

export function GuestChat() {
  const isHydrated = useClientHydrated();
  const { messages, modelSlug, setModelSlug } = useGuestChatStorage();
  const { hasReachedLimit, setQuotaRemaining } = useGuestQuota();
  const { isSending, onSubmit } = useGuestChatSubmit({
    messages,
    modelSlug,
    setQuotaRemaining,
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastMessage = messages.at(-1);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages.length, lastMessage?.text, lastMessage?.status]);

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex w-full min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 sm:h-14 sm:flex-nowrap sm:gap-4 sm:px-4 sm:py-0">
          <div className="min-w-0 flex-1 basis-32 sm:flex-none">
            <h1 className="truncate text-lg font-semibold leading-none tracking-tight text-foreground">
              <Link href="/">AI Chat</Link>
            </h1>
          </div>
          <div className="flex shrink-0 items-center">
            <Button
              variant="outline"
              size="lg"
              className="shrink-0 sm:hidden"
              asChild
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto">
            <AiModelSelect
              value={modelSlug}
              onChange={setModelSlug}
              disabled={isSending}
              className={cn(
                "min-w-0",
                "min-w-[160px] w-full flex-1 max-w-none sm:w-[220px] sm:max-w-none sm:flex-none",
              )}
            />
            <Button
              variant="outline"
              size="lg"
              className="hidden shrink-0 sm:inline-flex"
              asChild
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <div
        className="relative flex-1 min-h-0 overflow-y-auto"
        aria-busy={!isHydrated}
      >
        {!isHydrated ? (
          <div className="h-full min-h-[40vh]" />
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col justify-end px-3 pb-2 pt-2 sm:justify-center sm:px-0 sm:pb-3">
            <div className="flex w-full justify-center">
              <div className="w-full max-w-[800px] sm:px-4">
                <Empty className="border-0 bg-transparent py-10">
                  <EmptyHeader>
                    <EmptyTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
                      Ask your first question.
                    </EmptyTitle>
                    <EmptyDescription className="mt-1">
                      Try Paralect Chat with {GUEST_FREE_QUESTION_LIMIT} free
                      questions. Sign in anytime to save your history.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map((item) => (
              <ChatMessage
                key={item.id}
                id={item.id}
                text={item.text}
                created_at={item.created_at}
                author_id={item.role === "user" ? "guest" : null}
                role={item.role}
                author={{
                  name: item.role === "user" ? "You" : "Assistant",
                  image_url: null,
                }}
                attachments={item.attachments}
                isOwn={item.role === "user"}
                status={item.status}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {isHydrated && hasReachedLimit && (
        <div className="border-t px-3 pt-3 sm:px-4">
          <div className="mx-auto mb-3 max-w-[800px] rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <p className="font-medium">
              You have used your {GUEST_FREE_QUESTION_LIMIT} free questions.
            </p>
            <p className="mt-1 text-muted-foreground">
              Sign in to keep chatting and save your conversation history.
            </p>
            <Link
              href="/login"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "mt-3",
              })}
            >
              Sign in or create account
            </Link>
          </div>
        </div>
      )}

      <ChatComposerInput
        disabled={isSending || hasReachedLimit}
        isSending={isSending}
        innerClassName="mx-auto max-w-[800px]"
        placeholder={
          hasReachedLimit ? "Sign in to ask more" : "Ask anything…"
        }
        onSubmit={onSubmit}
      />
    </div>
  );
}
