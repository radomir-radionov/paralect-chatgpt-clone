"use client";

import { useRouter } from "next/navigation";
import { useCallback, useOptimistic } from "react";
import { toast } from "sonner";

import { useDeleteRoom } from "@domains/chat/room/mutations/useDeleteRoom";
import type { RoomListItem } from "@domains/chat/room/queries/useRooms";
import { useJoinedRooms } from "@domains/chat/room/queries/useRooms";

type Options = Readonly<{
  userId: string;
  initialRooms: RoomListItem[];
  activeRoomId: string | undefined;
}>;

export function useChatSidebarRooms({
  userId,
  initialRooms,
  activeRoomId,
}: Options) {
  const router = useRouter();
  const roomsQuery = useJoinedRooms(userId);
  const baseRooms = roomsQuery.data ?? initialRooms;
  const [optimisticRooms, applyOptimisticDelete] = useOptimistic(
    baseRooms,
    (current: RoomListItem[], roomId: string) =>
      current.filter((r) => r.id !== roomId),
  );
  const showRoomsPlaceholder =
    roomsQuery.isPending && roomsQuery.data === undefined;

  const deleteRoomMutation = useDeleteRoom(userId);

  const deleteRoom = useCallback(
    async (roomId: string) => {
      if (
        deleteRoomMutation.isPending &&
        deleteRoomMutation.variables?.roomId !== roomId
      ) {
        return {
          error: true as const,
          message: "Another chat is being deleted.",
        };
      }

      applyOptimisticDelete(roomId);

      if (activeRoomId === roomId) {
        router.replace("/");
      }

      try {
        const result = await deleteRoomMutation.mutateAsync({ roomId });
        if (result.error) return result;

        toast.success("Chat deleted");
        return { error: false as const };
      } catch {
        return {
          error: true as const,
          message: "Could not delete chat.",
        };
      }
    },
    [
      activeRoomId,
      applyOptimisticDelete,
      deleteRoomMutation,
      router,
    ],
  );

  return {
    optimisticRooms,
    showRoomsPlaceholder,
    deleteRoomMutation,
    deleteRoom,
  };
}
