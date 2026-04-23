"use client";

import { useId, useState } from "react";

import { Button } from "@shared/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/components/ui/card";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@shared/components/ui/field";
import { Input } from "@shared/components/ui/input";

import { useSignInWithPassword } from "@domains/auth/mutations/useSignInWithPassword";
import { useSignUp } from "@domains/auth/mutations/useSignUp";

import { AuthPageShell } from "./AuthPageShell";

type Mode = "signup" | "signin";

export default function EmailPasswordForm({
  showHeader = true,
  embedded = false,
}: {
  showHeader?: boolean;
  /** When true, render only the card (for use inside a parent shell). */
  embedded?: boolean;
}) {
  const emailId = useId();
  const passwordId = useId();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  const signUp = useSignUp();
  const signIn = useSignInWithPassword();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "signup") {
      try {
        const { isNewRegistration } = await signUp.mutateAsync({
          email,
          password,
          emailRedirectTo: `${window.location.origin}/welcome`,
        });
        setStatus(
          isNewRegistration
            ? "Check your inbox to confirm the new account."
            : "An account with this email already exists. Try signing in.",
        );
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Sign-up failed.",
        );
      }
      return;
    }

    try {
      await signIn.mutateAsync({ email, password });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign-in failed.");
      return;
    }

    window.location.assign("/");
  }

  const neutralStatusMessages = [
    "Check your inbox to confirm the new account.",
    "An account with this email already exists. Try signing in.",
  ];
  const statusTone =
    status && !neutralStatusMessages.includes(status)
      ? "text-destructive"
      : "text-muted-foreground";

  const card = (
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Credentials
              </p>
              <CardTitle>
                {mode === "signup" ? "Create an account" : "Welcome back"}
              </CardTitle>
              <CardDescription>
                {mode === "signup"
                  ? "Create a new account with your email and password."
                  : "Sign in with the email and password you used to register."}
              </CardDescription>
            </div>
            <CardAction>
              <div
                className="flex rounded-md border border-border bg-muted/50 p-1"
                role="group"
                aria-label="Choose sign up or sign in"
              >
                {(["signup", "signin"] as const).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={mode === option ? "default" : "ghost"}
                    size="sm"
                    className="rounded-sm px-3 shadow-none"
                    aria-pressed={mode === option}
                    onClick={() => setMode(option)}
                  >
                    {option === "signup" ? "Sign up" : "Sign in"}
                  </Button>
                ))}
              </div>
            </CardAction>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={emailId}>Email</FieldLabel>
                <FieldContent>
                  <Input
                    id={emailId}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@email.com"
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor={passwordId}>Password</FieldLabel>
                <FieldContent>
                  <Input
                    id={passwordId}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    placeholder="At least 6 characters"
                  />
                </FieldContent>
              </Field>
            </FieldGroup>
            <Button
              type="submit"
              className="w-full"
              disabled={signIn.isPending || signUp.isPending}
            >
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
            {status ? (
              <p
                className={`text-sm ${statusTone}`}
                role="status"
                aria-live="polite"
              >
                {status}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
  );

  if (embedded) {
    return card;
  }

  return (
    <AuthPageShell title="Email & password" showHeader={showHeader}>
      {card}
    </AuthPageShell>
  );
}
