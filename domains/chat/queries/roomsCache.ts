import type { QueryClient } from "@tanstack/react-query";

import { chatKeys } from "@domains/chat/queries/keys";
import type { RoomListItem } from "@domains/chat/queries/room-fetchers";

export function bumpJoinedRoomLastMessageAt(
  queryClient: QueryClient,
  options: {
    readonly userId: string;
    readonly roomId: string;
    readonly lastMessageAt: string;
  },
) {
  queryClient.setQueryData<RoomListItem[] | undefined>(
    chatKeys.joinedRooms(options.userId),
    (current) => {
      if (!current) return current;

      const room = current.find((item) => item.id === options.roomId);
      if (!room) return current;

      const bumpedRoom: RoomListItem = {
        ...room,
        lastMessageAt: options.lastMessageAt,
      };

      return [
        bumpedRoom,
        ...current.filter((item) => item.id !== options.roomId),
      ];
    },
  );
}
