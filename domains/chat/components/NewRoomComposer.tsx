"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Skeleton } from "@shared/components/ui/skeleton";
import {
  DEFAULT_AI_MODEL_SLUG,
  type AiModelSlug,
} from "@shared/lib/ai/model-registry";
import { uploadChatAttachment } from "@domains/chat/api/uploadChatAttachment";

import { useCurrentUser } from "@domains/auth/queries/useCurrentUser";
import { AiModelSelect } from "@domains/chat/components/AiModelSelect";
import { ChatHeader } from "@domains/chat/components/ChatHeader";
import { ChatComposerInput } from "@domains/chat/components/ChatComposerInput";
import { ChatMessage } from "@domains/chat/components/ChatMessage";
import { useStartRoomWithFirstMessage } from "@domains/chat/mutations/useStartRoomWithFirstMessage";

type OptimisticBubble = {
  id: string;
  text: string;
  createdAt: string;
};

export function NewRoomComposer() {
  const router = useRouter();
  const { user, isLoading: sessionLoading } = useCurrentUser();
  const mutation = useStartRoomWithFirstMessage(user?.id ?? null);

  const [modelSlug, setModelSlug] = useState<AiModelSlug>(
    DEFAULT_AI_MODEL_SLUG,
  );
  const [optimistic, setOptimistic] = useState<OptimisticBubble | null>(null);

  async function handleSubmit(payload: {
    readonly text: string;
    readonly pendingImages: Array<{ id: string; file: File; previewUrl: string }>;
    readonly pendingDocuments: Array<{ id: string; file: File }>;
    readonly createdAt: string;
  }) {
    const text = payload.text.trim();
    const hasImages = payload.pendingImages.length > 0;
    const hasDocuments = payload.pendingDocuments.length > 0;

    if ((hasImages || hasDocuments) && !user?.id) {
      toast.error("You must be signed in to upload files");
      return;
    }

    const messageId = crypto.randomUUID();
    setOptimistic({ id: messageId, text, createdAt: payload.createdAt });

    const previewUrlsToRevoke = payload.pendingImages.map((img) => img.previewUrl);

    try {
      let attachments:
        | Array<{
            id: string;
            kind: "image" | "document";
            storagePath: string;
            mimeType: string;
            sizeBytes: number;
            width?: number;
            height?: number;
            originalName?: string;
          }>
        | undefined;

      if (hasImages || hasDocuments) {
        const uploaded: NonNullable<typeof attachments> = [];

        for (const img of payload.pendingImages) {
          const attachmentId = crypto.randomUUID();
          try {
            const path = await uploadChatAttachment({
              file: img.file,
              kind: "image",
              attachmentId,
              messageId,
            });

            uploaded.push({
              id: attachmentId,
              kind: "image",
              storagePath: path,
              mimeType: img.file.type || "application/octet-stream",
              sizeBytes: img.file.size,
            });
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to upload image");
            return;
          }
        }

        for (const doc of payload.pendingDocuments) {
          const attachmentId = crypto.randomUUID();
          try {
            const path = await uploadChatAttachment({
              file: doc.file,
              kind: "document",
              attachmentId,
              messageId,
              originalName: doc.file.name,
            });

            uploaded.push({
              id: attachmentId,
              kind: "document",
              storagePath: path,
              mimeType: doc.file.type || "application/octet-stream",
              sizeBytes: doc.file.size,
              originalName: doc.file.name,
            });
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to upload document");
            return;
          }
        }

        attachments = uploaded;
      }

      const result = await mutation.mutateAsync({
        messageId,
        text,
        modelSlug,
        attachments,
      });

      if (result.error) {
        toast.error(result.message);
        if (result.roomId) {
          router.push(`/rooms/${result.roomId}`);
        }
        return;
      }

      router.push(`/rooms/${result.roomId}`);
    } finally {
      previewUrlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    }
  }

  const isCreating = useMemo(() => optimistic != null, [optimistic]);

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
            disabled={mutation.isPending || isCreating}
            className="w-full max-w-[min(220px,55vw)] sm:w-[220px] sm:max-w-none"
          />
        }
      />

      <div className="flex-1 min-h-0 flex flex-col">
        {optimistic ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="py-2">
                <ChatMessage
                  id={optimistic.id}
                  text={optimistic.text}
                  created_at={optimistic.createdAt}
                  author_id={user?.id ?? "pending-user"}
                  role="user"
                  author={{ name: "You", image_url: null }}
                  isOwn
                  status="pending"
                />
                <ChatMessage
                  id="optimistic-assistant"
                  text="Thinking…"
                  created_at={optimistic.createdAt}
                  author_id={null}
                  role="assistant"
                  author={{ name: "Assistant", image_url: null }}
                  isOwn={false}
                  status="pending"
                />
              </div>
            </div>

            <div className="px-0 py-3 border-t shrink-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                Creating chat…
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col justify-end pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:justify-center sm:pb-6">
            <div className="mx-auto w-full min-w-0 max-w-[800px] px-0 sm:px-0">
              <ChatComposerInput
                disabled={mutation.isPending}
                isSending={mutation.isPending}
                innerClassName="max-w-[800px]"
                onSubmit={({ text, pendingImages, pendingDocuments, createdAt }) =>
                  handleSubmit({ text, pendingImages, pendingDocuments, createdAt })
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
