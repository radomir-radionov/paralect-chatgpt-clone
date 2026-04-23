"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@shared/components/ui/button";

type AuthPageShellProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  showHeader?: boolean;
  centerContent?: boolean;
};

export function AuthPageShell({
  title,
  eyebrow,
  description,
  children,
  backHref = "/login",
  backLabel = "Back to login",
  showHeader = true,
  centerContent = false,
}: AuthPageShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {showHeader ? (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="container mx-auto flex min-h-14 max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              {eyebrow ? (
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          </div>
        </header>
      ) : null}
      <main
        className={`container mx-auto w-full max-w-lg px-4 ${
          centerContent ? "min-h-screen py-8 flex items-center" : "py-8"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
