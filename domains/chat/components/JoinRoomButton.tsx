"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

import { ActionButton } from "@shared/components/ui/action-button";

import { useCurrentUser } from "@domains/auth/queries/useCurrentUser";
import { useJoinRoom } from "@domains/chat/mutations/useJoinRoom";

export function JoinRoomButton({
  children,
  roomId,
  ...props
}: Omit<ComponentProps<typeof ActionButton>, "action"> & { roomId: string }) {
  const { user } = useCurrentUser();
  const router = useRouter();
  const joinRoom = useJoinRoom();

  async function handleJoin() {
    if (user == null) {
      return { error: true, message: "User not logged in" };
    }

    try {
      await joinRoom.mutateAsync({ roomId, userId: user.id });
    } catch (err) {
      return {
        error: true,
        message: err instanceof Error ? err.message : "Failed to join room",
      };
    }

    router.refresh();
    router.push(`/rooms/${roomId}`);
    return { error: false };
  }

  return (
    <ActionButton {...props} action={handleJoin}>
      {children}
    </ActionButton>
  );
}
