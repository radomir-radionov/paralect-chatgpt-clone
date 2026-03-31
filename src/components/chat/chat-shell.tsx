"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { useChatLayout } from "@/components/chat/chat-layout-context";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { apiJson } from "@/lib/api-client";
import {
  primeNewChatDetailCache,
  removeChatFromListCache,
  upsertChatInListCache,
} from "@/lib/chats-cache";
import { invalidateChatsListDebounced } from "@/lib/invalidate-chats-list";
import type { ChatSummary } from "@/lib/chat-api";

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

type DeleteMutationContext = {
  previousChats: { chats: ChatRow[] } | undefined;
  navigatedAway: boolean;
};

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
  const { user, authLoading, refetchAuth, routingChatId, setRoutingChatId } =
    useChatLayout();
  const router = useRouter();
  const queryClient = useQueryClient();

  const selectedChatId = chatId ?? routingChatId;
  const isGuestResolved = !authLoading && !user;

  const quotaQuery = useQuery({
    queryKey: ["guest-quota"],
    queryFn: () =>
      apiJson<{ used: number; remaining: number; limit: number }>(
        "/api/guest/quota",
      ),
    enabled: isGuestResolved,
  });

  const chatsQuery = useQuery({
    queryKey: ["chats"],
    queryFn: () => apiJson<{ chats: ChatRow[] }>("/api/chats"),
    enabled: !!user,
  });

  const createChatMutation = useMutation({
    mutationFn: async () => {
      const res = await apiJson<{ chat: ChatRow }>("/api/chats", {
        method: "POST",
        body: JSON.stringify({}),
      });
      return res.chat;
    },
    onSuccess: (chat) => {
      upsertChatInListCache(queryClient, chat);
      primeNewChatDetailCache(queryClient, chat);
      setRoutingChatId(chat.id);
      router.replace(`/chat/${chat.id}`);
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/chats/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(
          res.status === 404 ? "Chat not found" : `Delete failed (${res.status})`,
        );
      }
    },
    onMutate: async (id): Promise<DeleteMutationContext> => {
      await queryClient.cancelQueries({ queryKey: ["chats"] });
      const previousChats = queryClient.getQueryData<{ chats: ChatRow[] }>([
        "chats",
      ]);
      removeChatFromListCache(queryClient, id);
      const current = chatId ?? routingChatId;
      const navigatedAway = current === id;
      if (navigatedAway) {
        void queryClient.cancelQueries({ queryKey: ["chat", id] });
        queryClient.removeQueries({ queryKey: ["chat", id] });
        setRoutingChatId(undefined);
        router.push("/chat");
      }
      return { previousChats, navigatedAway };
    },
    onError: (_err, id, context) => {
      if (context?.previousChats !== undefined) {
        queryClient.setQueryData(["chats"], context.previousChats);
      } else {
        invalidateChatsListDebounced(queryClient);
      }
      if (context?.navigatedAway) {
        router.replace(`/chat/${id}`);
      }
    },
  });

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    queryClient.removeQueries({ queryKey: ["chats"] });
    await refetchAuth();
    router.refresh();
  }, [queryClient, refetchAuth, router]);

  const handleNewChat = useCallback(() => {
    router.push("/chat");
    createChatMutation.mutate();
  }, [router, createChatMutation]);

  const deletingChatId =
    deleteChatMutation.isPending && deleteChatMutation.variables !== undefined
      ? deleteChatMutation.variables
      : undefined;

  const chatsLoading =
    !!user &&
    chatsQuery.data === undefined &&
    !chatsQuery.isError;

  const sidebarProps = useMemo(
    () => ({
      user,
      authLoading,
      chats: chatsQuery.data?.chats,
      chatsLoading,
      chatsError: !!user && chatsQuery.isError,
      selectedChatId,
      guestQuotaLimit: quotaQuery.data?.limit,
      createPending: createChatMutation.isPending,
      deletingChatId,
      onNewChat: handleNewChat,
      onDeleteChat: (id: string) => deleteChatMutation.mutate(id),
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
      deletingChatId,
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
