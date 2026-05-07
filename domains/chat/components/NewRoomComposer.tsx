"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Skeleton } from "@shared/components/ui/skeleton";
import {
  DEFAULT_AI_MODEL_SLUG,
  type AiModelSlug,
} from "@shared/lib/ai/model-registry";

import { useCurrentUser } from "@domains/auth/queries/useCurrentUser";
import { uploadChatAttachment } from "@domains/chat/api/uploadChatAttachment";
import { AiModelSelect } from "@domains/chat/components/AiModelSelect";
import { ChatHeader } from "@domains/chat/components/ChatHeader";
import {
  ChatComposerInput,
  type ComposerPendingDocument,
  type ComposerPendingImage,
} from "@domains/chat/components/ChatComposerInput";
import { useSendMessage } from "@domains/chat/mutations/useSendMessage";
import {
  clientCreateRoom,
  clientDeleteRoom,
} from "@domains/chat/queries/clientChatFetchers";
import { chatKeys } from "@domains/chat/queries/keys";
import type { RoomDetails, RoomListItem } from "@domains/chat/queries/room-fetchers";

const MAX_NAME_LEN = 60;

function deriveRoomNameFromText(text: string): string {
  const normalized = text.replaceAll(/\s+/g, " ").trim();
  if (normalized.length === 0) return "AI Chat";
  if (normalized.length <= MAX_NAME_LEN) return normalized;
  return `${normalized.slice(0, MAX_NAME_LEN).trimEnd()}…`;
}

export function NewRoomComposer() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: sessionLoading } = useCurrentUser();
  const sendMessage = useSendMessage();

  const [modelSlug, setModelSlug] = useState<AiModelSlug>(DEFAULT_AI_MODEL_SLUG);
  const [isStartingChat, setIsStartingChat] = useState(false);

  async function handleSubmit(payload: {
    readonly text: string;
    readonly pendingImages: ComposerPendingImage[];
    readonly pendingDocuments: ComposerPendingDocument[];
    readonly createdAt: string;
  }) {
    const text = payload.text.trim();
    const hasImages = payload.pendingImages.length > 0;
    const hasDocuments = payload.pendingDocuments.length > 0;

    if (!user?.id) {
      toast.error("You must be signed in to start a chat");
      return;
    }

    if (!text && !hasImages && !hasDocuments) return;

    const derivedName = deriveRoomNameFromText(
      text || (hasDocuments ? "Document" : "Image"),
    );

    setIsStartingChat(true);

    const createResult = await clientCreateRoom({
      name: derivedName,
      modelSlug,
    });

    if (createResult.error) {
      toast.error(createResult.message);
      setIsStartingChat(false);
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
          lastMessageAt: payload.createdAt,
        };
        if (!current) return [next];
        return [next, ...current.filter((r) => r.id !== roomId)];
      },
    );

    const author = {
      id: user.id,
      name:
        typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : "You",
      image_url:
        typeof user.user_metadata?.avatar_url === "string"
          ? user.user_metadata.avatar_url
          : null,
    };

    const imageAttachmentIds = payload.pendingImages.map(() => crypto.randomUUID());
    const documentAttachmentIds = payload.pendingDocuments.map(() => crypto.randomUUID());

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

    if (hasImages || hasDocuments) {
      const uploaded: NonNullable<typeof attachments> = [];

      for (const [index, img] of payload.pendingImages.entries()) {
        const attachmentId = imageAttachmentIds[index] ?? crypto.randomUUID();
        try {
          const path = await uploadChatAttachment({
            file: img.file,
            kind: "image",
            attachmentId,
            messageId,
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
          payload.pendingImages.forEach((i) => URL.revokeObjectURL(i.previewUrl));
          await clientDeleteRoom(roomId);
          setIsStartingChat(false);
          return;
        }
      }

      for (const [index, doc] of payload.pendingDocuments.entries()) {
        const attachmentId = documentAttachmentIds[index] ?? crypto.randomUUID();
        try {
          const path = await uploadChatAttachment({
            file: doc.file,
            kind: "document",
            attachmentId,
            messageId,
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
          payload.pendingImages.forEach((i) => URL.revokeObjectURL(i.previewUrl));
          await clientDeleteRoom(roomId);
          setIsStartingChat(false);
          return;
        }
      }

      attachments = uploaded;
    }

    const previewUrls = payload.pendingImages.map((i) => i.previewUrl);

    sendMessage.mutate(
      {
        id: messageId,
        assistantId,
        text,
        attachments,
        roomId,
        createdAt: payload.createdAt,
        author,
      },
      {
        onSuccess: (result) => {
          if (result.error) {
            toast.error(result.message);
          }
        },
        onSettled: () => {
          if (previewUrls.length > 0) {
            window.setTimeout(() => {
              previewUrls.forEach((u) => URL.revokeObjectURL(u));
            }, 60_000);
          }
        },
      },
    );

    setIsStartingChat(false);
    router.push(`/rooms/${roomId}`);
  }

  if (sessionLoading && user == null) {
    return (
      <div
        className="flex h-full flex-col"
        aria-busy="true"
        role="status"
      >
        <span className="sr-only">Loading…</span>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-[min(220px,60vw)]" />
        </div>
        <div className="flex flex-1 flex-col justify-end gap-4 px-4 py-8 sm:justify-center">
          <Skeleton className="h-8 w-[min(100%,20rem)]" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ChatHeader
        right={
          <AiModelSelect
            value={modelSlug}
            onChange={setModelSlug}
            className="w-full max-w-[min(220px,55vw)] sm:w-[220px] sm:max-w-none"
          />
        }
      />

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex min-h-0 flex-1 flex-col justify-end pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:justify-center sm:pb-6">
          <div className="mx-auto w-full min-w-0 max-w-[800px] px-0 sm:px-0">
            <ChatComposerInput
              innerClassName="mx-auto max-w-[800px]"
              disabled={isStartingChat || sendMessage.isPending}
              isSending={isStartingChat || sendMessage.isPending}
              onSubmit={(p) => void handleSubmit(p)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
