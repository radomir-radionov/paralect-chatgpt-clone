import Link from "next/link";
import type { Metadata } from "next";

import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export const metadata: Metadata = {
  title: "Page not found",
};

export default async function NotFound() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const href = user ? "/" : "/login";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-linear-to-br from-[#02050b] via-[#050c1d] to-[#071426] px-4 py-12 text-center text-slate-100">
      <div>
        <h1 className="text-2xl font-semibold text-white">Page not found</h1>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <Link
        href={href}
        className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400"
      >
        Go back
      </Link>
    </div>
  );
}
