"use client";

import dynamic from "next/dynamic";

const ChatSidebar = dynamic(
  () =>
    import("@domains/chat/components/ChatSidebar").then((m) => m.ChatSidebar),
  { ssr: false },
);

export function ChatSidebarNoSSR({ userId }: { userId: string }) {
  return <ChatSidebar userId={userId} />;
}

