"use client";

import Link from "next/link";
import { SignOutButton } from "../../profile/sign-out-button";
import type { AuthenticatedUser, Conversation } from "./types";

type ChatSidebarProps = {
  readonly conversations: readonly Conversation[];
  readonly activeConversationId: string;
  readonly user: AuthenticatedUser;
  readonly onNewChat: () => void;
  readonly onSelectConversation: (id: string) => void;
};

function getInitials(email: string): string {
  const [localPart] = email.split("@");
  if (!localPart) {
    return "U";
  }
  return localPart.slice(0, 2).toUpperCase();
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  user,
  onNewChat,
  onSelectConversation,
}: ChatSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-[#0a0d16] md:flex">
      <div className="p-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07]"
        >
          <span>New chat</span>
          <span aria-hidden="true" className="text-lg leading-none text-slate-400">
            +
          </span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <p className="px-2 pb-2 pt-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">
          Conversations
        </p>
        <ul className="flex flex-col gap-1">
          {conversations.map((conversation) => {
            const isActive = conversation.id === activeConversationId;
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => onSelectConversation(conversation.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {conversation.title}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.05]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/30">
            {getInitials(user.email)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">
              {user.email}
            </span>
            <span className="block text-xs text-slate-400">View profile</span>
          </span>
        </Link>
        <div className="mt-2 flex justify-end">
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}
