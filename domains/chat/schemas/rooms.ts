import z from "zod";

export const createRoomSchema = z.object({
  name: z.string().min(1).trim(),
  isPublic: z.boolean(),
});
