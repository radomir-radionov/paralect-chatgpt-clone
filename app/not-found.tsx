import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@shared/components/ui/card";
import { getRequestOrigin } from "@shared/lib/http/getRequestOrigin";

export const metadata: Metadata = {
  title: "Page not found",
};

export default async function NotFound() {
  const origin = await getRequestOrigin();
  const res = await fetch(new URL("/api/profile/me", origin), {
    method: "GET",
    cache: "no-store",
  });
  const href = res.status === 401 ? "/login" : "/";

  return (
    <div className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-lg items-center justify-center">
        <Card className="w-full text-center">
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              404
            </p>
            <CardTitle className="text-2xl">Page not found</CardTitle>
            <CardDescription>
              The page you are looking for does not exist or may have been moved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Use the button below to return to a valid entry point.
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button asChild>
              <Link href={href}>Go back</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
