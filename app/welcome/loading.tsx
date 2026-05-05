import { Skeleton } from "@shared/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
} from "@shared/components/ui/card";

import { AuthPageShell } from "@domains/auth/components/AuthPageShell";

export default function WelcomeLoading() {
  return (
    <AuthPageShell
      eyebrow="Supabase Auth"
      title="Welcome"
      backHref="/login"
      backLabel="Sign in →"
    >
      <Card aria-busy="true" role="status">
        <span className="sr-only">Loading…</span>
        <CardHeader className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-28" />
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}

