"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { uploadChatAttachment } from "@domains/chat/api/uploadChatAttachment";
import { useSendMessage } from "@domains/chat/mutations/useSendMessage";
import { ChatComposerInput } from "@domains/chat/components/ChatComposerInput";
import {
  appendOptimisticMessage,
  applyMessageStatus,
} from "@domains/chat/queries/messagesCache";

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
  const queryClient = useQueryClient();

  return (
    <ChatComposerInput
      disabled={sendMessage.isPending}
      isSending={sendMessage.isPending}
      onSubmit={async ({ text, pendingImages, pendingDocuments, createdAt }) => {
        const id = crypto.randomUUID();
        const assistantId = crypto.randomUUID();

        const imageAttachmentIds = pendingImages.map(() => crypto.randomUUID());
        const documentAttachmentIds = pendingDocuments.map(() => crypto.randomUUID());

        const localPreviewAttachments: Array<
          | {
              id: string;
              kind: "image";
              mime_type: string;
              size_bytes: number;
              width: number | null;
              height: number | null;
              preview_url: string;
            }
          | {
              id: string;
              kind: "document";
              mime_type: string;
              size_bytes: number;
              width: null;
              height: null;
              original_name: string;
            }
        > = [
          ...pendingImages.map((img, index) => ({
            id: imageAttachmentIds[index] ?? crypto.randomUUID(),
            kind: "image" as const,
            mime_type: img.file.type || "application/octet-stream",
            size_bytes: img.file.size,
            width: null,
            height: null,
            preview_url: img.previewUrl,
          })),
          ...pendingDocuments.map((doc, index) => ({
            id: documentAttachmentIds[index] ?? crypto.randomUUID(),
            kind: "document" as const,
            mime_type: doc.file.type || "application/octet-stream",
            size_bytes: doc.file.size,
            width: null,
            height: null,
            original_name: doc.file.name,
          })),
        ];

        if (localPreviewAttachments.length > 0) {
          appendOptimisticMessage(queryClient, roomId, {
            id,
            text,
            created_at: createdAt,
            author_id: author.id,
            role: "user",
            author: { name: author.name, image_url: author.image_url },
            attachments: localPreviewAttachments,
            status: "pending",
          });
        }

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
          const uploaded: NonNullable<typeof attachments> = [];

          for (const [index, img] of pendingImages.entries()) {
            const attachmentId = imageAttachmentIds[index] ?? crypto.randomUUID();
            try {
              const path = await uploadChatAttachment({
                file: img.file,
                kind: "image",
                attachmentId,
                messageId: id,
                roomId,
              });

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
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to upload image");
              pendingImages.forEach((i) => URL.revokeObjectURL(i.previewUrl));
              applyMessageStatus(queryClient, roomId, id, "error");
              return;
            }
          }

          for (const [index, doc] of pendingDocuments.entries()) {
            const attachmentId = documentAttachmentIds[index] ?? crypto.randomUUID();
            try {
              const path = await uploadChatAttachment({
                file: doc.file,
                kind: "document",
                attachmentId,
                messageId: id,
                roomId,
                originalName: doc.file.name,
              });

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
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to upload document");
              pendingImages.forEach((i) => URL.revokeObjectURL(i.previewUrl));
              applyMessageStatus(queryClient, roomId, id, "error");
              return;
            }
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
