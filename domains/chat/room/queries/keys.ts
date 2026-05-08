export const chatKeys = {
  all: ["chat"] as const,
  joinedRooms: (userId: string) => ["chat", "rooms", "joined", userId] as const,
  room: (roomId: string) => ["chat", "room", roomId] as const,
  messages: (roomId: string) => ["chat", "messages", roomId] as const,
};
