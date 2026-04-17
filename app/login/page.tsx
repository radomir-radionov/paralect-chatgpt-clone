import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#02050b] via-[#050c1d] to-[#071426] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-16">
        <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/90">
          Sign in
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Welcome</h1>
        <p className="mt-2 text-sm text-slate-400">
          Choose how you want to sign in to continue.
        </p>
        <div className="mt-10 flex flex-col gap-4">
          <Link
            href="/email-password"
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400"
          >
            Email & password
          </Link>
          <Link
            href="/google-login"
            className="inline-flex items-center justify-center rounded-full border border-[#5a8dee]/40 bg-gradient-to-br from-[#050a16] via-[#08142b] to-[#0f2446] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition hover:border-[#7fb0ff]/60"
          >
            Continue with Google
          </Link>
        </div>
      </div>
    </div>
  );
}
