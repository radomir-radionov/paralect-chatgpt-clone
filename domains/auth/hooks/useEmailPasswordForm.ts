"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useSignInWithPassword } from "@domains/auth/mutations/useSignInWithPassword";
import { useSignUp } from "@domains/auth/mutations/useSignUp";

type Mode = "signup" | "signin";

const NEUTRAL_STATUS_MESSAGES: string[] = [
  "Check your inbox to confirm the new account.",
  "An account with this email already exists. Try signing in.",
];

export function useEmailPasswordForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [status, setStatus] = useState("");

  const signUp = useSignUp();
  const signIn = useSignInWithPassword();

  const statusTone =
    status && !NEUTRAL_STATUS_MESSAGES.includes(status)
      ? "text-destructive"
      : "text-muted-foreground";

  function goHome() {
    router.replace("/");
    router.refresh();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { email, password } = credentials;

    if (mode === "signup") {
      signUp.mutate(
        { email, password },
        {
          onSuccess: ({ isNewRegistration, hasSession }) => {
            if (hasSession) {
              goHome();
              return;
            }
            setStatus(
              isNewRegistration
                ? "Check your inbox to confirm the new account."
                : "An account with this email already exists. Try signing in.",
            );
          },
          onError: (error) => {
            setStatus(
              error instanceof Error ? error.message : "Sign-up failed.",
            );
          },
        },
      );
      return;
    }

    signIn.mutate(
      { email, password },
      {
        onSuccess: () => {
          goHome();
        },
        onError: (error) => {
          setStatus(
            error instanceof Error ? error.message : "Sign-in failed.",
          );
        },
      },
    );
  }

  return {
    mode,
    setMode,
    credentials,
    setCredentials,
    status,
    statusTone,
    signIn,
    signUp,
    handleSubmit,
  };
}
