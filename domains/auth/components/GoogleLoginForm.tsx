"use client";

import { Button } from "@shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/components/ui/card";

import { useSignInWithGoogle } from "@domains/auth/mutations/useSignInWithGoogle";

import { AuthPageShell } from "./AuthPageShell";

export default function GoogleLoginForm({
  showHeader = true,
  embedded = false,
}: {
  showHeader?: boolean;
  /** When true, render only the card (for use inside a parent shell). */
  embedded?: boolean;
}) {
  const signInWithGoogle = useSignInWithGoogle();

  function handleGoogleLogin() {
    signInWithGoogle.mutate({
      redirectTo: `${window.location.origin}/`,
    });
  }

  const googleButton = (
    <Button
      type="button"
      aria-label="Continue with Google"
      title="Continue with Google"
      className="w-full bg-[#1a73e8] text-white hover:bg-[#1662c4] dark:bg-[#1a73e8] dark:hover:bg-[#1662c4]"
      onClick={handleGoogleLogin}
      disabled={signInWithGoogle.isPending}
    >
      Continue with Google
    </Button>
  );

  const card = embedded ? (
    <Card>
      <CardContent className="pt-6">{googleButton}</CardContent>
    </Card>
  ) : (
    <Card>
      <CardHeader>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          OAuth
        </p>
        <CardTitle>Google</CardTitle>
        <CardDescription>
          Sign in or sign up using your Google account. You&apos;ll be
          redirected to Google and then returned to the app home.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{googleButton}</CardContent>
    </Card>
  );

  if (embedded) {
    return card;
  }

  return (
    <AuthPageShell title="Google" showHeader={showHeader}>
      {card}
    </AuthPageShell>
  );
}
