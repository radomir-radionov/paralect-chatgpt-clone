import type { ModelMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@shared/lib/supabase/types/database";
import { getAiModelBySlug } from "@shared/lib/ai/model-registry";
import { buildDocumentContextBlock } from "@domains/chat/lib/unstructuredDocuments";

import type { PersistedAttachmentRow, PersistedHistoryRow } from "@domains/chat/lib/streamTypes";

export async function historyRowsToModelMessages(options: {
  readonly modelSlug: string;
  readonly messages: PersistedHistoryRow[];
  readonly attachments: PersistedAttachmentRow[];
  readonly supabase: SupabaseClient<Database>;
}): Promise<ModelMessage[]> {
  const model = getAiModelBySlug(options.modelSlug);
  const supportsVision = model?.provider === "openai" || model?.provider === "google";

  const byMessageId = new Map<string, PersistedAttachmentRow[]>();
  for (const a of options.attachments) {
    const existing = byMessageId.get(a.message_id);
    if (existing) existing.push(a);
    else byMessageId.set(a.message_id, [a]);
  }

  return Promise.all(
    options.messages.map(async (m) => {
      if (m.role !== "user") {
        return { role: m.role, content: m.text } satisfies ModelMessage;
      }

      const attachments = byMessageId.get(m.id) ?? [];
      const documentContext = buildDocumentContextBlock(
        attachments
          .filter((a) => a.kind === "document")
          .map((a) => ({
            originalName: a.original_name,
            extractedText: a.extracted_text,
          })),
      );
      const imageAttachments = attachments.filter((a) => a.kind === "image");
      const fallbackAttachmentText =
        documentContext.length > 0
          ? "User attached document context."
          : imageAttachments.length > 0
            ? "User sent an image."
            : m.text;
      const messageText = m.text.trim() ? m.text : fallbackAttachmentText;
      const textWithDocuments = documentContext
        ? `${messageText}\n\n${documentContext}`
        : messageText;

      if (!supportsVision) {
        const count = imageAttachments.length;
        const suffix =
          count > 0
            ? `\n\n[${count} image(s) attached, but this model does not support vision.]`
            : "";
        return {
          role: "user",
          content: `${textWithDocuments}${suffix}`,
        } satisfies ModelMessage;
      }

      const imageParts = await Promise.all(
        imageAttachments.map(async (a) => {
          const { data } = await options.supabase.storage
            .from(a.storage_bucket)
            .createSignedUrl(a.storage_path, 60 * 5);
          const url = data?.signedUrl;
          if (!url) return null;
          return {
            type: "image" as const,
            image: new URL(url),
            mediaType: a.mime_type,
          };
        }),
      );

      const parts = [
        { type: "text" as const, text: textWithDocuments },
        ...imageParts.filter((p): p is NonNullable<typeof p> => p != null),
      ];

      return { role: "user", content: parts } satisfies ModelMessage;
    }),
  );
}
