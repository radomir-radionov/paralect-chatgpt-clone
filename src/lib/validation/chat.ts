import { z } from "zod";

export const streamUserMessageSchema = z.object({
  userMessageId: z.string().uuid(),
  assistantMessageId: z.string().uuid(),
  content: z.string().min(1),
  modelId: z.string().min(1),
  images: z
    .array(
      z.object({
        mimeType: z.string().min(1),
        base64: z.string().min(1),
      }),
    )
    .optional(),
  documentIds: z.array(z.string().uuid()).optional(),
});

export const guestStreamSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      images: z
        .array(
          z.object({
            mimeType: z.string(),
            base64: z.string(),
          }),
        )
        .optional(),
    }),
  ),
  modelId: z.string().min(1),
  documentIds: z.array(z.string().uuid()).optional(),
});
