import z from "zod";

import { AI_MODEL_SLUGS } from "@shared/lib/ai/model-registry";

export const createRoomSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  modelSlug: z.enum(AI_MODEL_SLUGS),
});

export const startRoomWithFirstMessageSchema = z.object({
  messageId: z.string().uuid(),
  text: z.string().min(1).max(2000).trim(),
  modelSlug: z.enum(AI_MODEL_SLUGS),
});

export const deleteRoomSchema = z.object({
  roomId: z.string().uuid(),
});

export const updateRoomModelSchema = z.object({
  roomId: z.string().uuid(),
  modelSlug: z.enum(AI_MODEL_SLUGS),
});
