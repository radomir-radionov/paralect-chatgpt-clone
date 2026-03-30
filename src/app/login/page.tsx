"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/api-client";
import type { ChatSummary } from "@/lib/chat-api";

type Feedback =
  | { type: "error"; text: string }
  | { type: "info"; text: string };

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setFeedback(null);
    setLoading(true);
    try {
      const path = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const res = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        error?: string;
        needsEmailConfirmation?: boolean;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Auth failed");
      }
      if (mode === "signup" && data.needsEmailConfirmation) {
        setMode("signin");
        setPassword("");
        setFeedback({
          type: "info",
          text: "Check your email to confirm your account, then sign in here.",
        });
        return;
      }
      await queryClient.prefetchQuery({
        queryKey: ["chats"],
        queryFn: () => apiJson<{ chats: ChatSummary[] }>("/api/chats"),
      });
      router.push("/chat");
      router.refresh();
    } catch (e) {
      setFeedback({
        type: "error",
        text: e instanceof Error ? e.message : "Auth failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background flex min-h-[100dvh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Use Supabase email / password auth.
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {feedback && (
            <p
              className={
                feedback.type === "error"
                  ? "text-destructive text-sm"
                  : "text-muted-foreground text-sm"
              }
              role={feedback.type === "error" ? "alert" : "status"}
            >
              {feedback.text}
            </p>
          )}
          <Button
            className="w-full"
            disabled={loading || !email || !password}
            onClick={() => void submit()}
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </Button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground w-full text-center text-sm underline-offset-4 hover:underline"
            onClick={() => {
              setFeedback(null);
              setMode((m) => (m === "signin" ? "signup" : "signin"));
            }}
          >
            {mode === "signin"
              ? "Need an account? Sign up"
              : "Have an account? Sign in"}
          </button>
        </div>
        <p className="text-center text-sm">
          <Link href="/chat" className="text-primary underline-offset-4 hover:underline">
            Continue as guest
          </Link>
        </p>
      </div>
    </div>
  );
}
