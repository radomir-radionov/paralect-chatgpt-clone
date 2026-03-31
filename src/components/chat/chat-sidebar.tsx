"use client";

import {
  Loader2,
  LogIn,
  LogOut,
  MessageSquarePlus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatSummary } from "@/lib/chat-api";
import type { ChatSessionState } from "@/lib/chat-session";
import { cn } from "@/lib/utils";

export type ChatSidebarProps = {
  session: ChatSessionState;
  chats: ChatSummary[] | undefined;
  chatsLoading: boolean;
  chatsError: boolean;
  selectedChatId: string | undefined;
  guestQuotaLimit: number | undefined;
  createPending: boolean;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onSignOut: () => void;
  canDeleteChat?: (id: string) => boolean;
};

function ChatSidebarInner({
  session,
  chats,
  chatsLoading,
  chatsError,
  selectedChatId,
  guestQuotaLimit,
  createPending,
  onNewChat,
  onDeleteChat,
  onSignOut,
  canDeleteChat,
}: ChatSidebarProps) {
  const user = session.role === "user" ? session.user : null;
  const authLoading = session.status === "loading";
  const isGuest = session.status === "guest";

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tracking-tight">Chats</span>
        {user && !authLoading && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onNewChat}
            disabled={createPending}
            aria-label="New chat"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Separator />
      {isGuest && (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Try up to {guestQuotaLimit ?? 3} free prompts. Sign in to save chats.
        </p>
      )}
      <ScrollArea className="min-h-0 flex-1 pr-2">
        <div className="flex flex-col gap-1">
          {authLoading && (
            <>
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-9 w-full shrink-0" />
              ))}
            </>
          )}
          {user && chatsLoading && (
            <>
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-9 w-full shrink-0" />
              ))}
            </>
          )}
          {user && !chatsLoading && chatsError && (
            <p className="text-destructive text-sm" role="alert">
              Couldn&apos;t load chats.
            </p>
          )}
          {user &&
            !chatsLoading &&
            !chatsError &&
            chats !== undefined &&
            chats.length === 0 && (
              <p className="text-muted-foreground text-sm">No chats yet.</p>
            )}
          {user &&
            !chatsLoading &&
            !chatsError &&
            chats?.map((c) => {
              const isDeletable =
                !canDeleteChat || canDeleteChat(c.id);
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-md",
                    selectedChatId === c.id && "bg-sidebar-accent",
                  )}
                >
                  <Link
                    href={`/chat/${c.id}`}
                    className="hover:bg-sidebar-accent/80 flex min-w-0 flex-1 items-center rounded-md px-2 py-2 text-left text-sm"
                  >
                    <span className="truncate">{c.title}</span>
                  </Link>
                  {isDeletable && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => onDeleteChat(c.id)}
                      aria-label="Delete chat"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
        </div>
      </ScrollArea>
      <Separator />
      <div className="space-y-2">
        {authLoading ? (
          <div
            className="text-muted-foreground flex h-9 items-center justify-center gap-2 text-sm"
            aria-busy
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading session…</span>
          </div>
        ) : user ? (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => void onSignOut()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        ) : (
          <Link
            href="/login"
            className={buttonVariants({
              variant: "default",
              className: "inline-flex w-full justify-start gap-2",
            })}
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}

export const ChatSidebar = memo(ChatSidebarInner);
