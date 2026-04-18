import Link from "next/link";

import { Button } from "@shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/components/ui/card";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-8">
        <Card>
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sign in
            </p>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Choose how you want to sign in to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild>
              <Link href="/email-password">Email & password</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/google-login">Continue with Google</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
