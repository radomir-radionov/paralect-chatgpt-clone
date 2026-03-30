import type { Message } from "@/server/db/schema";
import type { LlmMessage } from "@/server/llm/types";

type Attachment = { mimeType: string; base64: string };

function parseAttachments(raw: unknown): Attachment[] | undefined {
  if (!raw || !Array.isArray(raw)) return undefined;
  const out: Attachment[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      "mimeType" in item &&
      "base64" in item &&
      typeof (item as Attachment).mimeType === "string" &&
      typeof (item as Attachment).base64 === "string"
    ) {
      out.push(item as Attachment);
    }
  }
  return out.length ? out : undefined;
}

export function dbMessagesToLlm(rows: Message[]): LlmMessage[] {
  return rows.map((m) => {
    const role = m.role === "assistant" ? "assistant" : "user";
    const images = parseAttachments(m.attachments);
    return {
      role,
      content: m.content,
      images,
    };
  });
}
