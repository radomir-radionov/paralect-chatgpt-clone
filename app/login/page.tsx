"use client";

import EmailPasswordForm from "@domains/auth/components/EmailPasswordForm";
import GoogleLoginForm from "@domains/auth/components/GoogleLoginForm";
import { AuthPageShell } from "@domains/auth/components/AuthPageShell";

export default function LoginPage() {
  return (
    <AuthPageShell
      title="Sign in"
      eyebrow="Paralect Chat"
      description="Use email and password or your Google account."
      showHeader
      headerVariant="minimal"
      minimalTitle="AI Chat"
      backHref="/"
      backLabel="Back"
      centerContent
    >
      <div className="w-full space-y-6">
        <EmailPasswordForm embedded />

        <div className="relative py-2">
          <div
            className="absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-xs text-muted-foreground">
              Or continue with Google
            </span>
          </div>
        </div>

        <GoogleLoginForm embedded />
      </div>
    </AuthPageShell>
  );
}
