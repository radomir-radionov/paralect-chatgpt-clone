import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { ModelMessage } from "ai";

import { getAiModelBySlug, isAiModelSlug } from "@shared/lib/ai/model-registry";
import { streamAssistantText } from "@shared/lib/ai/providers";
import {
  consumeGuestQuestion,
  GUEST_QUOTA_COOKIE_NAME,
} from "@domains/chat/lib/guestQuota";
import { getGuestQuotaSecret, setGuestQuotaCookie } from "@domains/chat/lib/guestQuotaServer";
import {
  buildDocumentContextBlock,
  parseChatDocument,
} from "@domains/chat/lib/unstructuredDocuments";
import {
  CHAT_DOCUMENTS_MAX_ATTACHMENTS,
  CHAT_DOCUMENTS_MAX_BYTES,
  fileExtensionForDocument,
} from "@domains/chat/lib/chatDocuments";
import {
  CHAT_IMAGES_MAX_ATTACHMENTS,
  CHAT_IMAGES_MAX_BYTES,
} from "@domains/chat/lib/chatImages";
import { STREAMING_TEXT_HEADERS } from "@shared/lib/http/streamingTextHeaders";
import { parseGuestMessagesForStream } from "@domains/chat/lib/guestStreamPayload";

export const runtime = "nodejs";

type IncomingGuestAttachment =
  | {
      kind: "image";
      mimeType: string;
      sizeBytes: number;
      dataBase64: string;
    }
  | {
      kind: "document";
      mimeType: string;
      sizeBytes: number;
      originalName: string;
      dataBase64: string;
    };

function decodeBase64ToArrayBuffer(dataBase64: string) {
  const bytes = Buffer.from(dataBase64, "base64");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: true, message }, { status });
}

function normalizeGuestAttachments(value: unknown): IncomingGuestAttachment[] {
  if (!Array.isArray(value)) return [];

  const attachments: IncomingGuestAttachment[] = [];

  for (const item of value) {
    if (typeof item !== "object" || item == null) {
      throw new Error("Invalid attachment metadata");
    }

    const raw = item as Record<string, unknown>;
    const kind = raw.kind;
    const mimeType = raw.mimeType;
    const sizeBytes = raw.sizeBytes;
    const dataBase64 = raw.dataBase64;

    if ((kind !== "image" && kind !== "document") || typeof mimeType !== "string") {
      throw new Error("Invalid attachment metadata");
    }
    if (typeof sizeBytes !== "number" || !Number.isInteger(sizeBytes) || sizeBytes < 0) {
      throw new Error("Invalid attachment metadata");
    }
    if (typeof dataBase64 !== "string" || !dataBase64.trim()) {
      throw new Error("Invalid attachment metadata");
    }

    if (kind === "image") {
      if (sizeBytes > CHAT_IMAGES_MAX_BYTES) {
        throw new Error("One of the images is too large (max 10MB).");
      }
      attachments.push({ kind, mimeType, sizeBytes, dataBase64 });
      continue;
    }

    if (sizeBytes > CHAT_DOCUMENTS_MAX_BYTES) {
      throw new Error("One of the documents is too large (max 15MB).");
    }

    const originalNameRaw = raw.originalName;
    const originalName =
      typeof originalNameRaw === "string" && originalNameRaw.trim()
        ? originalNameRaw.trim()
        : "document";

    if (!fileExtensionForDocument({ name: originalName, type: mimeType })) {
      throw new Error(`Unsupported document type: ${originalName}`);
    }

    attachments.push({
      kind,
      mimeType,
      sizeBytes,
      originalName,
      dataBase64,
    });
  }

  const imageCount = attachments.filter((a) => a.kind === "image").length;
  const documentCount = attachments.filter((a) => a.kind === "document").length;

  if (imageCount > CHAT_IMAGES_MAX_ATTACHMENTS) {
    throw new Error(`You can attach up to ${CHAT_IMAGES_MAX_ATTACHMENTS} images.`);
  }
  if (documentCount > CHAT_DOCUMENTS_MAX_ATTACHMENTS) {
    throw new Error(`You can attach up to ${CHAT_DOCUMENTS_MAX_ATTACHMENTS} documents.`);
  }

  return attachments;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const raw = body as Record<string, unknown>;
  const modelSlug = raw.modelSlug;
  const messages = parseGuestMessagesForStream(raw);
  let attachments: IncomingGuestAttachment[] = [];

  if (typeof modelSlug !== "string" || !isAiModelSlug(modelSlug)) {
    return jsonError("Unsupported AI model", 400);
  }

  if (messages == null) {
    return jsonError("Guest message history is invalid", 400);
  }

  try {
    attachments = normalizeGuestAttachments(raw.attachments);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid attachment metadata";
    return jsonError(message, 400);
  }

  let quotaSecret: string;
  try {
    quotaSecret = getGuestQuotaSecret();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Guest quota is not configured";
    return jsonError(message, 500);
  }

  const cookieStore = await cookies();
  const quota = await consumeGuestQuestion({
    cookieValue: cookieStore.get(GUEST_QUOTA_COOKIE_NAME)?.value,
    secret: quotaSecret,
  });

  if (!quota.allowed) {
    const response = NextResponse.json(
      {
        error: true,
        message: "You have used your 3 free questions. Sign in to keep chatting.",
        remaining: 0,
      },
      { status: 429 },
    );
    setGuestQuotaCookie(response, quota);
    return response;
  }

  const model = getAiModelBySlug(modelSlug);
  const supportsVision = model?.provider === "openai" || model?.provider === "google";

  let documentContext = "";
  if (attachments.some((a) => a.kind === "document")) {
    try {
      const parsedDocs: Array<{ originalName: string; extractedText: string }> = [];

      for (const attachment of attachments) {
        if (attachment.kind !== "document") continue;
        const arrayBuffer = decodeBase64ToArrayBuffer(attachment.dataBase64);

        const result = await parseChatDocument({
          fileName: attachment.originalName,
          mimeType: attachment.mimeType,
          content: arrayBuffer,
        });

        parsedDocs.push({
          originalName: attachment.originalName,
          extractedText: result.text,
        });
      }

      documentContext = buildDocumentContextBlock(
        parsedDocs.map((d) => ({
          originalName: d.originalName,
          extractedText: d.extractedText,
        })),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to parse document";
      return jsonError(message, 400);
    }
  }

  const imageAttachments = attachments.filter((a) => a.kind === "image");
  const imageNote =
    imageAttachments.length > 0 && !supportsVision
      ? `\n\n[${imageAttachments.length} image(s) attached, but this model does not support vision.]`
      : "";

  const modelMessages = messages.map((message, index) => {
    if (message.role !== "user") {
      return { role: message.role, content: message.text } satisfies ModelMessage;
    }

    const isLast = index === messages.length - 1;
    const baseText = message.text;
    const textWithDocuments =
      isLast && documentContext
        ? `${baseText}\n\n${documentContext}`
        : baseText;

    if (!supportsVision || !isLast || imageAttachments.length === 0) {
      return {
        role: "user",
        content: `${textWithDocuments}${isLast ? imageNote : ""}`,
      } satisfies ModelMessage;
    }

    const parts = [
      { type: "text" as const, text: textWithDocuments },
      ...imageAttachments.map((a) => ({
        type: "image" as const,
        image: new URL(`data:${a.mimeType};base64,${a.dataBase64}`),
        mediaType: a.mimeType,
      })),
    ];

    return { role: "user", content: parts } satisfies ModelMessage;
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let fullText = "";

      (async () => {
        try {
          const { textStream } = streamAssistantText({
            modelSlug,
            system:
              "You are a helpful AI assistant inside Paralect Chat. Keep answers clear, concise, and practical unless the user asks for more depth.",
            messages: modelMessages,
          });

          for await (const delta of textStream) {
            fullText += delta;
            controller.enqueue(encoder.encode(delta));
          }

          if (!fullText.trim()) {
            throw new Error(
              `Empty response from ${modelSlug}. This can happen if the provider returns no tokens or blocks the output.`,
            );
          }

          controller.close();
        } catch (error) {
          const model = getAiModelBySlug(modelSlug);
          const providerName =
            model?.provider === "google"
              ? "Gemini"
              : model?.provider === "groq"
                ? "Groq"
                : "OpenAI";
          const message = error instanceof Error ? error.message : "Unknown error";
          const errorText = `[${providerName} request failed: ${message}]`;

          controller.enqueue(encoder.encode(`\n\n${errorText}\n`));
          controller.close();
        }
      })();
    },
  });

  const response = new NextResponse(stream, {
    headers: {
      ...STREAMING_TEXT_HEADERS,
      "X-Guest-Questions-Remaining": String(quota.remaining),
    },
  });

  setGuestQuotaCookie(response, quota);
  return response;
}
