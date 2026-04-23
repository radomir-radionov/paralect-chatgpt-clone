import Link from "next/link";

import { Button } from "@shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/components/ui/card";

import { AuthPageShell } from "@domains/auth/components/AuthPageShell";

export default function WelcomePage() {
  return (
    <AuthPageShell
      eyebrow="Supabase Auth"
      title="Welcome"
      backHref="/login"
      backLabel="Sign in →"
    >
      <Card>
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Email confirmed
          </p>
          <CardTitle>Hello</CardTitle>
          <CardDescription>
            Your email link brought you here. You can sign in from the login
            page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/login">Go to login</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
