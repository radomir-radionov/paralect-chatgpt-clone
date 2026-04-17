"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AuthPageShellProps = {
  title: string;
  children: ReactNode;
};

export function AuthPageShell({ title, children }: AuthPageShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#02050b] via-[#050c1d] to-[#071426] text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/40 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-6 py-5">
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          <Link
            href="/login"
            className="text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
          >
            Back to login
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg px-6 py-12">{children}</main>
    </div>
  );
}
