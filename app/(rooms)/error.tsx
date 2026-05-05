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

export default function RoomsError({
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
    <div className="flex h-svh min-h-0 w-full overflow-hidden supports-[height:100dvh]:h-dvh">
      <main className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-xl">Could not load rooms</CardTitle>
            <CardDescription>
              Something failed while rendering this screen. You can retry or go
              back home.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Error ID: {error.digest ?? "unknown"}
            </p>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button type="button" onClick={reset}>
              Retry
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/">Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}

