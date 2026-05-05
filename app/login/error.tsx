"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@shared/components/ui/card";

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-dvh bg-background px-4 py-12 text-foreground">
      <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-lg items-center justify-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">Sign in is unavailable</CardTitle>
            <CardDescription>
              Something went wrong on this page. You can retry or return home.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Error ID: {error.digest ?? "unknown"}
            </p>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button type="button" onClick={reset}>
              Try again
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/">Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

