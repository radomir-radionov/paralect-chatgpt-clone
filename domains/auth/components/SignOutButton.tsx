"use client";

import type { ComponentProps } from "react";

import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";
import { Button } from "@shared/components/ui/button";
import { useRouter } from "next/navigation";

type SignOutButtonProps = Omit<ComponentProps<typeof Button>, "onClick" | "type">;

export function SignOutButton({
  children = "Sign out",
  ...props
}: SignOutButtonProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  return (
    <Button
      type="button"
      {...props}
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      {children}
    </Button>
  );
}
