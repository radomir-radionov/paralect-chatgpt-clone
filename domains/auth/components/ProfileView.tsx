"use client";

import Link from "next/link";

import { Button } from "@shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/components/ui/card";
import { Skeleton } from "@shared/components/ui/skeleton";

import { useCurrentUser } from "@domains/auth/queries/useCurrentUser";

import { SignOutButton } from "./SignOutButton";

export function ProfileView() {
  const { user, isLoading } = useCurrentUser();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between px-3 sm:px-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Account
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Profile
            </h1>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </header>
      <main className="container mx-auto max-w-5xl px-3 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-8">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Your account</CardTitle>
            <CardDescription>
              Details from your Supabase session.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {isLoading ? (
              <div
                className="flex flex-col gap-4"
                aria-busy="true"
                role="status"
              >
                <span className="sr-only">Loading account…</span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">User ID</span>
                  <Skeleton className="h-4 w-full max-w-xs sm:max-w-sm" />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <Skeleton className="h-4 w-full max-w-xs" />
                </div>
              </div>
            ) : (
              <dl className="flex flex-col gap-4 text-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <dt className="text-muted-foreground">User ID</dt>
                  <dd className="font-mono text-xs break-all text-end sm:text-start">
                    {user?.id ?? "—"}
                  </dd>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="min-w-0 break-all">{user?.email ?? "—"}</dd>
                </div>
              </dl>
            )}
            <SignOutButton variant="outline" size="sm" disabled={isLoading}>
              Sign out
            </SignOutButton>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
