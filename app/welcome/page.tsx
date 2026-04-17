import Link from "next/link";

export default function WelcomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#02050b] via-[#050c1d] to-[#071426] text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/40 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
              Supabase Auth
            </p>
            <h1 className="text-2xl font-semibold text-white">Welcome</h1>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
          >
            Sign in →
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-12">
        <section className="relative overflow-hidden rounded-[32px] border border-emerald-500/30 bg-gradient-to-br from-[#05130d] via-[#04100c] to-[#0c2a21] p-10 shadow-[0_35px_90px_rgba(2,6,23,0.65)]">
          <div
            className="pointer-events-none absolute -left-4 -top-4 -z-10 h-20 w-28 rounded-full bg-[radial-gradient(circle,_rgba(16,185,129,0.25),_transparent)] blur-lg"
            aria-hidden="true"
          />
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">
            Email confirmed
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Hello</h2>
          <p className="mt-4 max-w-xl text-lg text-slate-300">
            Your email link brought you here. You can sign in from the login
            page.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400"
          >
            Go to login
          </Link>
        </section>
      </main>
    </div>
  );
}
