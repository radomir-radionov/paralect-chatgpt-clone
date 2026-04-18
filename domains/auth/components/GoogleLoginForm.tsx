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

export default function GoogleLoginForm() {
  const signInWithGoogle = useSignInWithGoogle();

  function handleGoogleLogin() {
    signInWithGoogle.mutate({
      redirectTo: `${window.location.origin}/`,
    });
  }

  return (
    <AuthPageShell title="Google">
      <Card>
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            OAuth
          </p>
          <CardTitle>Continue with Google</CardTitle>
          <CardDescription>
            You will be redirected to Google to complete sign-in, then return to
            the app home.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            className="w-full bg-[#1a73e8] text-white hover:bg-[#1662c4] dark:bg-[#1a73e8] dark:hover:bg-[#1662c4]"
            onClick={handleGoogleLogin}
            disabled={signInWithGoogle.isPending}
          >
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
