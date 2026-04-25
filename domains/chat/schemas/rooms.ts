import z from "zod";

import { AI_MODEL_SLUGS } from "@shared/lib/ai/model-registry";

export const createRoomSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  modelSlug: z.enum(AI_MODEL_SLUGS),
});

export const startRoomWithFirstMessageSchema = z.object({
  messageId: z.string().uuid(),
  text: z.string().max(2000).trim(),
  modelSlug: z.enum(AI_MODEL_SLUGS),
  attachments: z
    .array(
      z.object({
        id: z.string().uuid(),
        kind: z.enum(["image", "document"]).default("image"),
        storagePath: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().int().nonnegative(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        originalName: z.string().min(1).max(255).optional(),
      }),
    )
    .max(6)
    .optional(),
}).refine(
  (v) => v.text.trim().length > 0 || (v.attachments?.length ?? 0) > 0,
  { message: "Message cannot be empty" },
);

export const deleteRoomSchema = z.object({
  roomId: z.string().uuid(),
});

export const updateRoomModelSchema = z.object({
  roomId: z.string().uuid(),
  modelSlug: z.enum(AI_MODEL_SLUGS),
});
