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

export const metadata: Metadata = {
  title: "Page not found",
};

export default async function NotFound() {
  return (
    <div className="min-h-dvh bg-background px-4 py-12 text-foreground">
      <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-lg items-center justify-center">
        <Card className="w-full">
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
              Choose one of the options below to get back on track.
            </p>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/">Go home</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
