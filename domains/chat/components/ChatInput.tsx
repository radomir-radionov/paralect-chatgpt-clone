"use client";

import { toast } from "sonner";

import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";

import { useSendMessage } from "@domains/chat/mutations/useSendMessage";
import { ChatComposerInput } from "@domains/chat/components/ChatComposerInput";
import {
  CHAT_DOCUMENTS_BUCKET,
  fileExtensionForDocument,
} from "@domains/chat/lib/chatDocuments";
import {
  CHAT_IMAGES_BUCKET,
  fileExtensionForMime,
} from "@domains/chat/lib/chatImages";

type Props = {
  roomId: string;
  author: {
    id: string;
    name: string;
    image_url: string | null;
  };
};

export function ChatInput({ roomId, author }: Props) {
  const sendMessage = useSendMessage();

  return (
    <ChatComposerInput
      disabled={sendMessage.isPending}
      isSending={sendMessage.isPending}
      onSubmit={async ({ text, pendingImages, pendingDocuments, createdAt }) => {
        const id = crypto.randomUUID();
        const assistantId = crypto.randomUUID();

        let attachments:
          | Array<
              | {
                  id: string;
                  kind: "image";
                  mime_type: string;
                  size_bytes: number;
                  width: number | null;
                  height: number | null;
                  storagePath: string;
                  preview_url?: string;
                  original_name?: string;
                }
              | {
                  id: string;
                  kind: "document";
                  mime_type: string;
                  size_bytes: number;
                  width: null;
                  height: null;
                  storagePath: string;
                  original_name: string;
                }
            >
          | undefined;

        const hasImages = pendingImages.length > 0;
        const hasDocuments = pendingDocuments.length > 0;

        if (hasImages || hasDocuments) {
          const supabase = getSupabaseBrowserClient();
          const uploaded: NonNullable<typeof attachments> = [];

          for (const img of pendingImages) {
            const ext = fileExtensionForMime(img.file.type) ?? "bin";
            const attachmentId = crypto.randomUUID();
            const path = `${author.id}/${roomId}/${id}/${attachmentId}.${ext}`;

            const { error } = await supabase.storage
              .from(CHAT_IMAGES_BUCKET)
              .upload(path, img.file, { contentType: img.file.type, upsert: false });

            if (error) {
              toast.error(error.message || "Failed to upload image");
              pendingImages.forEach((i) => URL.revokeObjectURL(i.previewUrl));
              return;
            }

            uploaded.push({
              id: attachmentId,
              kind: "image",
              mime_type: img.file.type || "application/octet-stream",
              size_bytes: img.file.size,
              width: null,
              height: null,
              storagePath: path,
              preview_url: img.previewUrl,
            });
          }

          for (const doc of pendingDocuments) {
            const ext = fileExtensionForDocument(doc.file) ?? "bin";
            const attachmentId = crypto.randomUUID();
            const path = `${author.id}/${roomId}/${id}/${attachmentId}.${ext}`;

            const { error } = await supabase.storage
              .from(CHAT_DOCUMENTS_BUCKET)
              .upload(path, doc.file, { contentType: doc.file.type, upsert: false });

            if (error) {
              toast.error(error.message || "Failed to upload document");
              pendingImages.forEach((i) => URL.revokeObjectURL(i.previewUrl));
              return;
            }

            uploaded.push({
              id: attachmentId,
              kind: "document",
              mime_type: doc.file.type || "application/octet-stream",
              size_bytes: doc.file.size,
              width: null,
              height: null,
              storagePath: path,
              original_name: doc.file.name,
            });
          }

          attachments = uploaded;
        }

        const result = await sendMessage.mutateAsync({
          id,
          assistantId,
          text,
          attachments,
          roomId,
          createdAt,
          author,
        });

        // Revoke local previews after the message has had time to refetch persisted attachments.
        // (We can't revoke immediately or the optimistic thumbnails will break.)
        if (pendingImages.length > 0) {
          const urls = pendingImages.map((i) => i.previewUrl);
          window.setTimeout(() => {
            urls.forEach((u) => URL.revokeObjectURL(u));
          }, 60_000);
        }

        if (result.error) {
          toast.error(result.message);
        }
      }}
    />
  );
}
