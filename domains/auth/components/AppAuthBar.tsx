"use client";

import Link from "next/link";
import { LogOutIcon, UserRoundIcon } from "lucide-react";

import { Button } from "@shared/components/ui/button";

import { SignOutButton } from "./SignOutButton";

export function AppAuthBar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-foreground"
        >
          Chat
        </Link>
        <nav className="flex items-center gap-2" aria-label="Account">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/profile">
              <UserRoundIcon className="size-4" />
              Profile
            </Link>
          </Button>
          <SignOutButton variant="outline" size="sm">
            <LogOutIcon className="size-4" />
            Sign out
          </SignOutButton>
        </nav>
      </div>
    </header>
  );
}
