"use client";

import Link from "next/link";
import { MessagesSquareIcon } from "lucide-react";

import { Button } from "@shared/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@shared/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shared/components/ui/empty";

import { JoinRoomButton } from "@domains/chat/components/JoinRoomButton";
import { LeaveRoomButton } from "@domains/chat/components/LeaveRoomButton";
import {
  useJoinedRooms,
  usePublicRooms,
  type RoomListItem,
} from "@domains/chat/queries/useRooms";

export function RoomsList({ userId }: { userId: string }) {
  const publicRoomsQuery = usePublicRooms();
  const joinedRoomsQuery = useJoinedRooms(userId);

  const publicRooms = publicRoomsQuery.data ?? [];
  const joinedRooms = joinedRoomsQuery.data ?? [];

  if (publicRooms.length === 0 && joinedRooms.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessagesSquareIcon />
          </EmptyMedia>
          <EmptyTitle>No Chat Rooms</EmptyTitle>
          <EmptyDescription>
            Create a new chat room to get started
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/rooms/new">Create Room</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const visiblePublicRooms = publicRooms.filter(
    (room) => !joinedRooms.some((r) => r.id === room.id),
  );

  return (
    <div className="space-y-8">
      <RoomGroup title="Your Rooms" rooms={joinedRooms} isJoined />
      <RoomGroup title="Public Rooms" rooms={visiblePublicRooms} />
    </div>
  );
}

function RoomGroup({
  title,
  rooms,
  isJoined = false,
}: {
  title: string;
  rooms: RoomListItem[];
  isJoined?: boolean;
}) {
  if (rooms.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl">{title}</h2>
        <Button asChild>
          <Link href="/rooms/new">Create Room</Link>
        </Button>
      </div>
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
        {rooms.map((room) => (
          <RoomCard {...room} key={room.id} isJoined={isJoined} />
        ))}
      </div>
    </div>
  );
}

function RoomCard({
  id,
  name,
  memberCount,
  isJoined,
}: RoomListItem & { isJoined: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </CardDescription>
      </CardHeader>
      <CardFooter className="gap-2">
        {isJoined ? (
          <>
            <Button asChild className="grow" size="sm">
              <Link href={`/rooms/${id}`}>Enter</Link>
            </Button>
            <LeaveRoomButton roomId={id} size="sm" variant="destructive">
              Leave
            </LeaveRoomButton>
          </>
        ) : (
          <JoinRoomButton
            roomId={id}
            variant="outline"
            className="grow"
            size="sm"
          >
            Join
          </JoinRoomButton>
        )}
      </CardFooter>
    </Card>
  );
}
