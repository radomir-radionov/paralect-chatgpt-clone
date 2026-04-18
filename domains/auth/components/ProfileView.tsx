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

import { useCurrentUser } from "@domains/auth/queries/useCurrentUser";

import { SignOutButton } from "./SignOutButton";

export function ProfileView() {
  const { user } = useCurrentUser();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
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
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Your account</CardTitle>
            <CardDescription>
              Details from your Supabase session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="space-y-4 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-muted-foreground">User ID</dt>
                <dd className="font-mono text-xs">{user?.id ?? "—"}</dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd>{user?.email ?? "—"}</dd>
              </div>
            </dl>
            <SignOutButton variant="outline" size="sm">
              Sign out
            </SignOutButton>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
