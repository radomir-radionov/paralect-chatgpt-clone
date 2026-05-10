"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import type { RoomListItem } from "@domains/chat/room/queries/useRooms";

type Options = Readonly<{
  activeRoomId: string | undefined;
  rooms: RoomListItem[];
}>;

export function useRoomNavPrefetch({ activeRoomId, rooms }: Options) {
  const router = useRouter();
  const navRef = useRef<HTMLElement | null>(null);
  const prefetchedRoomIdsRef = useRef(new Set<string>());

  const scheduleRoomPrefetch = useCallback(
    (roomId: string) => {
      if (roomId === activeRoomId) return;
      if (prefetchedRoomIdsRef.current.has(roomId)) return;
      prefetchedRoomIdsRef.current.add(roomId);
      router.prefetch(`/rooms/${roomId}`);
    },
    [activeRoomId, router],
  );

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || rooms.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.prefetchRoom;
          if (id != null) scheduleRoomPrefetch(id);
        }
      },
      { root: nav, rootMargin: "48px 0px", threshold: 0 },
    );

    nav.querySelectorAll<HTMLElement>("[data-prefetch-room]").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [rooms, scheduleRoomPrefetch]);

  return { navRef, scheduleRoomPrefetch };
}
