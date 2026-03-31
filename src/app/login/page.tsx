"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type AuthMode,
  type Credentials,
  useAuthCredentials,
} from "@/hooks/use-auth-credentials";

export default function LoginPage() {
  const [credentials, setCredentials] = useState<Credentials>({
    email: "",
    password: "",
  });
  const [mode, setMode] = useState<AuthMode>("signin");

  const authMutation = useAuthCredentials();

  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Use Supabase email / password auth.
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void authMutation.mutate({ mode, ...credentials });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={credentials.email}
              onChange={(e) =>
                setCredentials((c) => ({ ...c, email: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              value={credentials.password}
              onChange={(e) =>
                setCredentials((c) => ({ ...c, password: e.target.value }))
              }
            />
          </div>
          {authMutation.isError && (
            <p className="text-destructive text-sm" role="alert">
              {authMutation.error instanceof Error
                ? authMutation.error.message
                : "Auth failed"}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={
              authMutation.isPending ||
              !credentials.email ||
              !credentials.password
            }
          >
            {authMutation.isPending
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : "Sign up"}
          </Button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground w-full text-center text-sm underline-offset-4 hover:underline"
            onClick={() => {
              authMutation.reset();
              setMode((m) => (m === "signin" ? "signup" : "signin"));
            }}
          >
            {mode === "signin"
              ? "Need an account? Sign up"
              : "Have an account? Sign in"}
          </button>
        </form>
        <p className="text-center text-sm">
          <Link
            href="/chat"
            className="text-primary underline-offset-4 hover:underline"
          >
            Continue as guest
          </Link>
        </p>
      </div>
    </div>
  );
}
