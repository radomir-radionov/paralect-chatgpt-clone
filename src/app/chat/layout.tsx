import type { ReactNode } from "react";
import { ChatLayoutProvider } from "@/components/chat/chat-layout-context";
import { ChatShell } from "@/components/chat/chat-shell";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <ChatLayoutProvider>
      <ChatShell>{children}</ChatShell>
    </ChatLayoutProvider>
  );
}
