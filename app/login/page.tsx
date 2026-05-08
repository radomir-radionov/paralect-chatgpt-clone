import EmailPasswordForm from "@domains/auth/components/EmailPasswordForm";
import GoogleLoginForm from "@domains/auth/components/GoogleLoginForm";
import { AuthPageShell } from "@domains/auth/components/AuthPageShell";
import { Separator } from "@shared/components/ui/separator";

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
      <div className="flex w-full flex-col gap-6">
        <EmailPasswordForm embedded />

        <div className="flex items-center gap-3 py-2">
          <Separator className="flex-1" />
          <span className="shrink-0 bg-background px-1 text-xs text-muted-foreground">
            Or continue with Google
          </span>
          <Separator className="flex-1" />
        </div>

        <GoogleLoginForm embedded />
      </div>
    </AuthPageShell>
  );
}
