"use client";

import type { ReactNode } from "react";

import { cn } from "@shared/lib/utils";

import { RoomsNavProvider, useRoomsNav } from "@domains/chat/context/RoomsNavContext";

type ShellInnerProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

function ChatLayoutShellInner({ sidebar, children }: ShellInnerProps) {
  const { mobileSidebarOpen, closeMobileSidebar } = useRoomsNav();

  return (
    <div className="flex h-svh min-h-0 w-full overflow-hidden supports-[height:100dvh]:h-[100dvh]">
      {mobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 h-screen w-screen bg-black/15 md:hidden"
          onClick={closeMobileSidebar}
        />
      ) : null}

      <aside
        data-open={mobileSidebarOpen ? "true" : "false"}
        className={cn(
          "flex h-full min-h-0 w-[min(18rem,92vw)] shrink-0 flex-col border-r bg-background dark:bg-muted/30 md:static md:w-64 md:max-w-none",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-lg",
          "max-md:transition-transform max-md:duration-200 max-md:ease-out",
          "max-md:-translate-x-full max-md:data-[open=true]:translate-x-0",
          "md:translate-x-0",
        )}
      >
        {sidebar}
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}

type ChatLayoutShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export function ChatLayoutShell({ sidebar, children }: ChatLayoutShellProps) {
  return (
    <RoomsNavProvider>
      <ChatLayoutShellInner sidebar={sidebar}>{children}</ChatLayoutShellInner>
    </RoomsNavProvider>
  );
}
