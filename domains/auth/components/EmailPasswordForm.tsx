"use client";

import { useState } from "react";

import { useSignInWithPassword } from "@domains/auth/mutations/useSignInWithPassword";
import { useSignUp } from "@domains/auth/mutations/useSignUp";

import { AuthPageShell } from "./AuthPageShell";

type Mode = "signup" | "signin";

export default function EmailPasswordForm() {
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

  return (
    <AuthPageShell title="Email & password">
      <form
        className="relative overflow-hidden rounded-[32px] border border-emerald-500/30 bg-gradient-to-br from-[#05130d] via-[#04100c] to-[#0c2a21] p-8 text-slate-100 shadow-[0_35px_90px_rgba(2,6,23,0.65)]"
        onSubmit={handleSubmit}
      >
        <div
          className="pointer-events-none absolute -left-4 -top-4 -z-10 h-20 w-28 rounded-full bg-[radial-gradient(circle,_rgba(16,185,129,0.25),_transparent)] blur-lg"
          aria-hidden="true"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">
              Credentials
            </p>
            <h2 className="text-xl font-semibold text-white">
              {mode === "signup" ? "Create an account" : "Welcome back"}
            </h2>
          </div>
          <div className="flex rounded-full border border-white/10 bg-white/[0.07] p-1 text-xs font-semibold text-slate-300">
            {(["signup", "signin"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                onClick={() => setMode(option)}
                className={`rounded-full px-4 py-1 transition ${
                  mode === option
                    ? "bg-emerald-500/30 text-white shadow shadow-emerald-500/20"
                    : "text-slate-400"
                }`}
              >
                {option === "signup" ? "Sign up" : "Sign in"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-200">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0b1b18] px-3 py-2.5 text-base text-white placeholder-slate-500 shadow-inner shadow-black/30 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              placeholder="you@email.com"
            />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0b1b18] px-3 py-2.5 text-base text-white placeholder-slate-500 shadow-inner shadow-black/30 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              placeholder="At least 6 characters"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={signIn.isPending || signUp.isPending}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-600/40"
        >
          {mode === "signup" ? "Create account" : "Sign in"}
        </button>
        {status ? (
          <p
            className="mt-4 text-sm text-slate-300"
            role="status"
            aria-live="polite"
          >
            {status}
          </p>
        ) : null}
      </form>
    </AuthPageShell>
  );
}
