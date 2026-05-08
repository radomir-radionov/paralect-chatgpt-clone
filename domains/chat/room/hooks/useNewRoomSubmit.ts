"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import type { AiModelSlug } from "@shared/lib/ai/model-registry";

import { useCurrentUser } from "@domains/auth/queries/useCurrentUser";
import { uploadChatAttachment } from "@domains/chat/room/api/uploadChatAttachment";
import type {
  ComposerPendingDocument,
  ComposerPendingImage,
  ComposerSubmitPayload,
} from "@domains/chat/room/components/ChatComposerInput";
import { useSendMessage } from "@domains/chat/room/mutations/useSendMessage";
import {
  clientCreateRoom,
  clientDeleteRoom,
} from "@domains/chat/room/queries/clientChatFetchers";
import { chatKeys } from "@domains/chat/room/queries/keys";
import type {
  RoomDetails,
  RoomListItem,
} from "@domains/chat/room/queries/room-fetchers";

const MAX_NAME_LEN = 60;
const PREVIEW_REVOKE_DELAY_MS = 60_000;

type CurrentUser = NonNullable<ReturnType<typeof useCurrentUser>["user"]>;

type UploadedAttachment =
  | {
      readonly id: string;
      readonly kind: "image";
      readonly mime_type: string;
      readonly size_bytes: number;
      readonly width: number | null;
      readonly height: number | null;
      readonly storagePath: string;
      readonly preview_url?: string;
      readonly original_name?: string;
    }
  | {
      readonly id: string;
      readonly kind: "document";
      readonly mime_type: string;
      readonly size_bytes: number;
      readonly width: null;
      readonly height: null;
      readonly storagePath: string;
      readonly original_name: string;
    };

function deriveRoomNameFromText(text: string): string {
  const normalized = text.replaceAll(/\s+/g, " ").trim();
  if (normalized.length === 0) return "AI Chat";
  if (normalized.length <= MAX_NAME_LEN) return normalized;
  return `${normalized.slice(0, MAX_NAME_LEN).trimEnd()}…`;
}

function buildAuthorFromUser(user: CurrentUser) {
  const name =
    typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "You";
  const imageUrl =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : null;

  return { id: user.id, name, image_url: imageUrl };
}

async function uploadComposerAttachments(input: {
  readonly roomId: string;
  readonly messageId: string;
  readonly pendingImages: ComposerPendingImage[];
  readonly pendingDocuments: ComposerPendingDocument[];
}): Promise<UploadedAttachment[]> {
  const uploaded: UploadedAttachment[] = [];

  for (const img of input.pendingImages) {
    const attachmentId = crypto.randomUUID();
    const path = await uploadChatAttachment({
      file: img.file,
      kind: "image",
      attachmentId,
      messageId: input.messageId,
      roomId: input.roomId,
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
  }

  for (const doc of input.pendingDocuments) {
    const attachmentId = crypto.randomUUID();
    const path = await uploadChatAttachment({
      file: doc.file,
      kind: "document",
      attachmentId,
      messageId: input.messageId,
      roomId: input.roomId,
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
  }

  return uploaded;
}

type UseNewRoomSubmitOptions = Readonly<{
  modelSlug: AiModelSlug;
}>;

export function useNewRoomSubmit({ modelSlug }: UseNewRoomSubmitOptions) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const sendMessage = useSendMessage();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = useCallback(
    async ({
      text,
      pendingImages,
      pendingDocuments,
      createdAt,
    }: ComposerSubmitPayload) => {
      const trimmedText = text.trim();
      const hasImages = pendingImages.length > 0;
      const hasDocuments = pendingDocuments.length > 0;

      if (!user?.id) {
        toast.error("You must be signed in to start a chat");
        return;
      }

      if (!trimmedText && !hasImages && !hasDocuments) return;

      const derivedName = deriveRoomNameFromText(
        trimmedText || (hasDocuments ? "Document" : "Image"),
      );

      setIsSubmitting(true);

      const createResult = await clientCreateRoom({
        name: derivedName,
        modelSlug,
      });
      if (createResult.error) {
        toast.error(createResult.message);
        setIsSubmitting(false);
        return;
      }

      const roomId = createResult.roomId;
      const messageId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();

      const roomStub: RoomDetails = {
        id: roomId,
        name: derivedName,
        modelSlug,
        lastMessageAt: null,
      };
      queryClient.setQueryData(chatKeys.room(roomId), roomStub);

      queryClient.setQueryData<RoomListItem[] | undefined>(
        chatKeys.joinedRooms(user.id),
        (current) => {
          const next: RoomListItem = {
            id: roomId,
            name: derivedName,
            modelSlug,
            lastMessageAt: createdAt,
          };
          if (!current) return [next];
          return [next, ...current.filter((r) => r.id !== roomId)];
        },
      );

      let attachments: UploadedAttachment[] | undefined;
      if (hasImages || hasDocuments) {
        try {
          attachments = await uploadComposerAttachments({
            roomId,
            messageId,
            pendingImages,
            pendingDocuments,
          });
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Failed to upload attachment",
          );
          pendingImages.forEach((i) => URL.revokeObjectURL(i.previewUrl));
          await clientDeleteRoom(roomId);
          setIsSubmitting(false);
          return;
        }
      }

      const previewUrls = pendingImages.map((i) => i.previewUrl);

      sendMessage.mutate(
        {
          id: messageId,
          assistantId,
          text: trimmedText,
          attachments,
          roomId,
          createdAt,
          author: buildAuthorFromUser(user),
        },
        {
          onSuccess: (result) => {
            if (result.error) toast.error(result.message);
          },
          onSettled: () => {
            if (previewUrls.length === 0) return;
            window.setTimeout(() => {
              previewUrls.forEach((u) => URL.revokeObjectURL(u));
            }, PREVIEW_REVOKE_DELAY_MS);
          },
        },
      );

      setIsSubmitting(false);
      router.push(`/rooms/${roomId}`);
    },
    [modelSlug, queryClient, router, sendMessage, user],
  );

  return { isSubmitting, onSubmit };
}
