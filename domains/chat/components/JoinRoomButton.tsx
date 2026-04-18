"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

import { ActionButton } from "@shared/components/ui/action-button";
import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";
import { useCurrentUser } from "@shared/lib/supabase/hooks/useCurrentUser";

export function JoinRoomButton({
  children,
  roomId,
  ...props
}: Omit<ComponentProps<typeof ActionButton>, "action"> & { roomId: string }) {
  const { user } = useCurrentUser();
  const router = useRouter();

  async function joinRoom() {
    if (user == null) {
      return { error: true, message: "User not logged in" };
    }

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("chat_room_member").insert({
      chat_room_id: roomId,
      member_id: user.id,
    });

    if (error) {
      return { error: true, message: "Failed to join room" };
    }

    router.refresh();
    router.push(`/rooms/${roomId}`);

    return { error: false };
  }

  return (
    <ActionButton {...props} action={joinRoom}>
      {children}
    </ActionButton>
  );
}
