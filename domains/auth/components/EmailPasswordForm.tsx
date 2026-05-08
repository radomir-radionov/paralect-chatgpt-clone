"use client";

import { useId } from "react";

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
import { LoadingSwap } from "@shared/components/ui/loading-swap";

import { useEmailPasswordForm } from "@domains/auth/hooks/useEmailPasswordForm";

import { AuthPageShell } from "./AuthPageShell";

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
  const {
    mode,
    setMode,
    credentials,
    setCredentials,
    status,
    statusTone,
    signIn,
    signUp,
    handleSubmit,
  } = useEmailPasswordForm();

  const card = (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
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
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={emailId}>Email</FieldLabel>
              <FieldContent>
                <Input
                  id={emailId}
                  type="email"
                  value={credentials.email}
                  onChange={(event) =>
                    setCredentials((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
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
                  value={credentials.password}
                  onChange={(event) =>
                    setCredentials((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
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
            <LoadingSwap isLoading={signIn.isPending || signUp.isPending}>
              {mode === "signup" ? "Create account" : "Sign in"}
            </LoadingSwap>
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
