"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

import { ActionButton } from "@shared/components/ui/action-button";
import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";

export function LeaveRoomButton({
  children,
  roomId,
  redirectTo,
  ...props
}: Omit<ComponentProps<typeof ActionButton>, "action"> & {
  roomId: string;
  redirectTo?: string;
}) {
  const router = useRouter();

  async function leaveRoom() {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("chat_room_member")
      .delete()
      .eq("chat_room_id", roomId);

    if (error) {
      return { error: true, message: "Failed to leave room" };
    }

    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }

    return { error: false };
  }

  return (
    <ActionButton {...props} action={leaveRoom}>
      {children}
    </ActionButton>
  );
}
