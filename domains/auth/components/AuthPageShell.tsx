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
  headerVariant?: "full" | "minimal";
  minimalTitle?: string;
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
  headerVariant = "full",
  minimalTitle = "AI Chat",
  centerContent = false,
}: AuthPageShellProps) {
  const headerContainerClassName =
    headerVariant === "minimal"
      ? "mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between gap-4 px-3 sm:px-4"
      : "mx-auto flex min-h-14 w-full max-w-[1440px] items-center justify-between gap-4 px-3 py-3 sm:px-4";

  const mainClassName = `mx-auto w-full max-w-[600px] px-3 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-4 ${
    centerContent
      ? showHeader
        ? "min-h-[calc(100dvh-3.5rem)] flex items-center"
        : "min-h-dvh flex items-center"
      : ""
  }`;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {showHeader ? (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className={headerContainerClassName}>
            {headerVariant === "full" ? (
              <div className="min-w-0">
                {eyebrow ? (
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {eyebrow}
                  </p>
                ) : null}
                <h1 className="truncate text-lg font-semibold leading-none tracking-tight text-foreground">
                  {title}
                </h1>
                {description ? (
                  <p className="text-sm text-muted-foreground">{description}</p>
                ) : null}
              </div>
            ) : (
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold leading-none tracking-tight text-foreground">
                  <Link href="/">{minimalTitle}</Link>
                </h1>
              </div>
            )}
            <Button
              variant={headerVariant === "minimal" ? "outline" : "ghost"}
              size={headerVariant === "minimal" ? "lg" : "sm"}
              className="shrink-0"
              asChild
            >
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          </div>
        </header>
      ) : null}
      <main className={mainClassName}>{children}</main>
    </div>
  );
}
