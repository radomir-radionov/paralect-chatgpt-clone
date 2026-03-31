"use client";

import { useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { useChatLayout } from "@/components/chat/chat-layout-context";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCreateChatMutation } from "@/hooks/use-create-chat-mutation";
import { useDeleteChatMutation } from "@/hooks/use-delete-chat-mutation";
import { useSignOutMutation } from "@/hooks/use-sign-out-mutation";
import { apiJson } from "@/lib/api-client";
import type { ChatSummary } from "@/lib/chat-api";
import type { RouteSyncIntent } from "@/types/chat-route-sync";

type ChatRow = ChatSummary;

type ChatShellContextValue = {
  isCreatingChat: boolean;
};

const ChatShellContext = createContext<ChatShellContextValue | null>(null);

export function useChatShell(): ChatShellContextValue {
  const ctx = useContext(ChatShellContext);
  if (!ctx) {
    throw new Error("useChatShell must be used within ChatShell");
  }
  return ctx;
}

export function getChatShellLayoutClasses() {
  return {
    root: "bg-background flex min-h-[100dvh] flex-col md:h-[100dvh] md:flex-row md:overflow-hidden",
    aside:
      "border-sidebar-border bg-sidebar text-sidebar-foreground hidden w-72 shrink-0 flex-col border-r md:flex md:h-[100dvh]",
    main: "flex min-h-0 min-w-0 flex-1 flex-col md:overflow-y-auto",
  };
}

export function ChatShell({ children }: { children: ReactNode }) {
  const params = useParams<{ chatId?: string }>();
  const chatId = typeof params.chatId === "string" ? params.chatId : undefined;
  const { session, routingChatId, setRoutingChatId } = useChatLayout();
  const router = useRouter();
  const signOutMutation = useSignOutMutation();
  const [pendingRouteSync, setPendingRouteSync] = useState<RouteSyncIntent | null>(
    null,
  );
  const lastAutoSelectedChatIdRef = useRef<string | null>(null);

  const selectedChatId = chatId ?? routingChatId;
  const user = session.role === "user" ? session.user : null;
  const authLoading = session.status === "loading";
  const isGuestSession = session.status === "guest";

  const quotaQuery = useQuery({
    queryKey: ["guest-quota"],
    queryFn: () =>
      apiJson<{ used: number; remaining: number; limit: number }>(
        "/api/guest/quota",
      ),
    enabled: isGuestSession,
  });

  const chatsQuery = useQuery({
    queryKey: ["chats"],
    queryFn: () => apiJson<{ chats: ChatRow[] }>("/api/chats"),
    enabled: !!user,
  });

  const totalChats = chatsQuery.data?.chats.length ?? 0;

  const createChatMutation = useCreateChatMutation(setPendingRouteSync);
  const deleteChatMutation = useDeleteChatMutation({
    chatId,
    routingChatId,
    setPendingRouteSync,
  });

  const signOut = useCallback(() => {
    signOutMutation.mutate();
  }, [signOutMutation]);

  const handleNewChat = useCallback(() => {
    createChatMutation.mutate();
  }, [createChatMutation]);

  const chatsLoading =
    !!user &&
    chatsQuery.data === undefined &&
    !chatsQuery.isError;

  useEffect(() => {
    if (!pendingRouteSync) return;

    if (pendingRouteSync.kind === "select") {
      setRoutingChatId(pendingRouteSync.chatId);
      const href = `/chat/${pendingRouteSync.chatId}`;
      if (pendingRouteSync.navigation === "replace") {
        router.replace(href);
      } else {
        router.push(href);
      }
    } else {
      setRoutingChatId(undefined);
      if (pendingRouteSync.navigation.method === "replace") {
        router.replace(pendingRouteSync.navigation.href);
      } else {
        router.push(pendingRouteSync.navigation.href);
      }
    }

    setPendingRouteSync(null);
  }, [pendingRouteSync, router, setRoutingChatId]);

  // When a signed-in user has chats but no chat is selected yet (e.g. first login),
  // automatically select the most recent chat so the main pane is bound to a real chat id
  // before the first message is sent.
  useEffect(() => {
    if (!user || authLoading) return;
    if (selectedChatId) return;
    const chats = chatsQuery.data?.chats;
    if (!chats?.length) return;

    const firstChatId = chats[0]!.id;
    if (
      routingChatId === firstChatId ||
      lastAutoSelectedChatIdRef.current === firstChatId
    ) {
      return;
    }

    lastAutoSelectedChatIdRef.current = firstChatId;
    setPendingRouteSync({
      kind: "select",
      chatId: firstChatId,
      navigation: "replace",
    });
  }, [
    user,
    authLoading,
    selectedChatId,
    chatsQuery.data?.chats,
    routingChatId,
    router,
    setRoutingChatId,
  ]);

  const sidebarProps = useMemo(
    () => ({
      session,
      chats: chatsQuery.data?.chats,
      chatsLoading,
      chatsError: !!user && chatsQuery.isError,
      selectedChatId,
      guestQuotaLimit: quotaQuery.data?.limit,
      createPending: createChatMutation.isPending,
      onNewChat: handleNewChat,
      canDeleteChat: () => totalChats > 1,
      onDeleteChat: (id: string) => {
        if (totalChats <= 1) return;
        deleteChatMutation.mutate(id);
      },
      onSignOut: signOut,
    }),
    // Prefer stable primitives over mutation object identity for memoization.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate/isPending tracked via primitives below
    [
      user,
      authLoading,
      chatsQuery.data?.chats,
      chatsLoading,
      chatsQuery.isError,
      selectedChatId,
      quotaQuery.data?.limit,
      createChatMutation.isPending,
      totalChats,
      handleNewChat,
      deleteChatMutation.mutate,
      signOut,
    ],
  );

  const shellContextValue = useMemo(
    () => ({ isCreatingChat: createChatMutation.isPending }),
    [createChatMutation.isPending],
  );
  const layoutClasses = getChatShellLayoutClasses();

  return (
    <ChatShellContext.Provider value={shellContextValue}>
      <div className={layoutClasses.root}>
        <aside className={layoutClasses.aside}>
          <ChatSidebar {...sidebarProps} />
        </aside>

        <div className="border-sidebar-border flex items-center gap-2 border-b p-2 md:hidden">
          <Sheet>
            <SheetTrigger
              className={buttonVariants({
                variant: "outline",
                size: "icon",
                className: "shrink-0",
              })}
              aria-label="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <ChatSidebar {...sidebarProps} />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-medium">Chat</span>
        </div>

        <main className={layoutClasses.main}>{children}</main>
      </div>
    </ChatShellContext.Provider>
  );
}
