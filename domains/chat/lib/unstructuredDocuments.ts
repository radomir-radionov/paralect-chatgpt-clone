import "server-only";

import { UnstructuredClient } from "unstructured-client";
import { Strategy } from "unstructured-client/sdk/models/shared";

import {
  CHAT_DOCUMENT_CONTEXT_MAX_CHARS_PER_DOCUMENT,
  CHAT_DOCUMENT_CONTEXT_MAX_CHARS_PER_MESSAGE,
} from "@domains/chat/lib/chatDocuments";

type PartitionElement = {
  text?: unknown;
};

type ParseDocumentInput = {
  fileName: string;
  mimeType: string;
  content: ArrayBuffer;
};

export type ParsedChatDocument = {
  text: string;
  textChars: number;
};

function getUnstructuredClient() {
  const apiKey = process.env.UNSTRUCTURED_API_KEY;
  if (!apiKey) {
    throw new Error("UNSTRUCTURED_API_KEY is not configured");
  }

  const rawUrl = process.env.UNSTRUCTURED_API_URL;
  let serverURL: string | undefined;
  if (rawUrl && rawUrl.trim()) {
    try {
      const parsed = new URL(rawUrl);
      // Users commonly paste the platform URL (or include `/api/v1`); the SDK expects the API base origin.
      if (parsed.hostname === "platform.unstructuredapp.io") {
        serverURL = "https://api.unstructuredapp.io";
      } else {
        serverURL = parsed.origin;
      }
    } catch {
      throw new Error("UNSTRUCTURED_API_URL must be a valid URL");
    }
  }

  return new UnstructuredClient({
    security: { apiKeyAuth: apiKey },
    serverURL,
  });
}

function normalizeElementText(response: Awaited<ReturnType<UnstructuredClient["general"]["partition"]>>) {
  if (typeof response === "string") return response.trim();

  return response
    .map((element: PartitionElement) =>
      typeof element.text === "string" ? element.text.trim() : "",
    )
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export async function parseChatDocument({
  fileName,
  mimeType,
  content,
}: ParseDocumentInput): Promise<ParsedChatDocument> {
  const client = getUnstructuredClient();

  const response = await client.general.partition({
    partitionParameters: {
      files: {
        content,
        fileName,
      },
      contentType: mimeType || undefined,
      strategy: Strategy.Auto,
    },
  });

  const text = normalizeElementText(response).slice(
    0,
    CHAT_DOCUMENT_CONTEXT_MAX_CHARS_PER_DOCUMENT,
  );

  if (!text.trim()) {
    throw new Error(`No readable text found in ${fileName}`);
  }

  return {
    text,
    textChars: text.length,
  };
}

export function buildDocumentContextBlock(
  documents: ReadonlyArray<{
    originalName: string | null;
    extractedText: string | null;
  }>,
) {
  let remaining = CHAT_DOCUMENT_CONTEXT_MAX_CHARS_PER_MESSAGE;
  const blocks: string[] = [];

  for (const doc of documents) {
    if (remaining <= 0) break;

    const text = doc.extractedText?.trim();
    if (!text) continue;

    const name = doc.originalName?.trim() || "document";
    const cappedText = text.slice(0, remaining);
    blocks.push(`[Attached document: ${name}]\n${cappedText}`);
    remaining -= cappedText.length;
  }

  return blocks.join("\n\n");
}
