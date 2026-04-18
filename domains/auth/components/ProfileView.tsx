"use client";

import Link from "next/link";

import { useCurrentUser } from "@domains/auth/queries/useCurrentUser";

import { SignOutButton } from "./SignOutButton";

export function ProfileView() {
  const { user } = useCurrentUser();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#02050b] via-[#050c1d] to-[#071426] text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/40 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
              Account
            </p>
            <h1 className="text-2xl font-semibold text-white">Profile</h1>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
          >
            Home
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        <section className="max-w-xl rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_25px_70px_rgba(2,6,23,0.65)] backdrop-blur">
          <dl className="space-y-4 text-sm text-slate-200">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <dt className="text-slate-400">User ID</dt>
              <dd className="font-mono text-xs">{user?.id ?? "—"}</dd>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <dt className="text-slate-400">Email</dt>
              <dd>{user?.email ?? "—"}</dd>
            </div>
          </dl>
          <div className="mt-8">
            <SignOutButton
              variant="outline"
              size="sm"
              className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white"
            >
              Sign out
            </SignOutButton>
          </div>
        </section>
      </main>
    </div>
  );
}
