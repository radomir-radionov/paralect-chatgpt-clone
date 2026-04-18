"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

import { Button } from "@shared/components/ui/button";

import { useSignOut } from "@domains/auth/mutations/useSignOut";

type SignOutButtonProps = Omit<ComponentProps<typeof Button>, "onClick" | "type">;

export function SignOutButton({
  children = "Sign out",
  ...props
}: SignOutButtonProps) {
  const router = useRouter();
  const signOut = useSignOut();

  return (
    <Button
      type="button"
      {...props}
      disabled={props.disabled ?? signOut.isPending}
      onClick={async () => {
        await signOut.mutateAsync();
        router.push("/login");
        router.refresh();
      }}
    >
      {children}
    </Button>
  );
}
