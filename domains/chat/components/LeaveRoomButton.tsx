"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

import { ActionButton } from "@shared/components/ui/action-button";

import { useCurrentUser } from "@domains/auth/queries/useCurrentUser";
import { useLeaveRoom } from "@domains/chat/mutations/useLeaveRoom";

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
  const { user } = useCurrentUser();
  const leaveRoom = useLeaveRoom();

  async function handleLeave() {
    try {
      await leaveRoom.mutateAsync({ roomId, userId: user?.id });
    } catch (err) {
      return {
        error: true,
        message: err instanceof Error ? err.message : "Failed to leave room",
      };
    }

    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }

    return { error: false };
  }

  return (
    <ActionButton {...props} action={handleLeave}>
      {children}
    </ActionButton>
  );
}
