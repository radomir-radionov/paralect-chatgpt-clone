"use client";

import Link from "next/link";
import { LogOutIcon } from "lucide-react";

import { SignOutButton } from "./SignOutButton";

export function AppAuthBar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between px-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-foreground"
        >
          Chat
        </Link>
        <nav className="flex items-center gap-2" aria-label="Account">
          <SignOutButton variant="outline" size="sm">
            <LogOutIcon className="size-4" />
            Sign out
          </SignOutButton>
        </nav>
      </div>
    </header>
  );
}
