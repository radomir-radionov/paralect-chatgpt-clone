import { z } from "zod";
import {
  base64DecodedByteLength,
  isAllowedImageMimeType,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
} from "@/lib/image-attachment";
const MAX_DOCUMENT_IDS_PER_MESSAGE = 8;

const imagePartSchema = z
  .object({
    mimeType: z.string(),
    base64: z.string().min(1),
  })
  .refine((data) => isAllowedImageMimeType(data.mimeType), {
    message: "Unsupported image type",
  })
  .refine(
    (data) => {
      const n = base64DecodedByteLength(data.base64);
      return n > 0 && n <= MAX_IMAGE_BYTES;
    },
    { message: "Image too large or invalid" },
  );

/** Text and/or one image per message; image-only requests use `USER_IMAGE_PROMPT` as `content`. */
export const streamUserMessageSchema = z
  .object({
    userMessageId: z.string().uuid(),
    assistantMessageId: z.string().uuid(),
    content: z.string().max(32_000),
    modelId: z.string().min(1),
    images: z.array(imagePartSchema).length(MAX_IMAGES_PER_MESSAGE).optional(),
    documentIds: z
      .array(z.string().uuid())
      .max(MAX_DOCUMENT_IDS_PER_MESSAGE)
      .optional(),
  })
  .refine(
    (d) =>
      d.content.trim().length > 0 || (d.images?.length ?? 0) === MAX_IMAGES_PER_MESSAGE,
    { message: "Message must include text or an image" },
  );

const guestUserMessageSchema = z.object({
  role: z.literal("user"),
  content: z.string().min(1).max(32_000),
  images: z.array(imagePartSchema).length(MAX_IMAGES_PER_MESSAGE).optional(),
});

const guestAssistantMessageSchema = z
  .object({
    role: z.literal("assistant"),
    content: z.string(),
  })
  .strict();

export const guestStreamMessageSchema = z.discriminatedUnion("role", [
  guestUserMessageSchema,
  guestAssistantMessageSchema,
]);

export const guestStreamSchema = z.object({
  messages: z.array(guestStreamMessageSchema).min(1),
  modelId: z.string().min(1),
  documentIds: z
    .array(z.string().uuid())
    .max(MAX_DOCUMENT_IDS_PER_MESSAGE)
    .optional(),
});
