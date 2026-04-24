"use client";

import { ImagePlusIcon, LoaderCircleIcon, SendIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@shared/components/ui/input-group";
import {
  AI_MODELS,
  DEFAULT_AI_MODEL_SLUG,
  type AiModelSlug,
} from "@shared/lib/ai/model-registry";
import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";
import { cn } from "@shared/lib/utils";

import { useCurrentUser } from "@domains/auth/queries/useCurrentUser";
import { ChatHeader } from "@domains/chat/components/ChatHeader";
import { ChatMessage } from "@domains/chat/components/ChatMessage";
import { usePendingChatImages } from "@domains/chat/hooks/usePendingChatImages";
import {
  CHAT_IMAGES_BUCKET,
  CHAT_IMAGES_MAX_ATTACHMENTS,
  fileExtensionForMime,
} from "@domains/chat/lib/chatImages";
import { useStartRoomWithFirstMessage } from "@domains/chat/mutations/useStartRoomWithFirstMessage";

const MAX_LENGTH = 2000;

type OptimisticBubble = {
  id: string;
  text: string;
  createdAt: string;
};

export function NewRoomComposer() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const mutation = useStartRoomWithFirstMessage(user?.id ?? null);

  const [message, setMessage] = useState("");
  const [modelSlug, setModelSlug] = useState<AiModelSlug>(
    DEFAULT_AI_MODEL_SLUG,
  );
  const [optimistic, setOptimistic] = useState<OptimisticBubble | null>(null);
  const { images, previews, fileInputRef, addImages, removeImage, clearImages, onPaste } =
    usePendingChatImages();

  const remaining = MAX_LENGTH - message.length;
  const isOverLimit = remaining < 0;
  const showCounter = remaining <= 200;

  async function handleSubmit(e?: { preventDefault(): void }) {
    e?.preventDefault();
    const text = message.trim();
    const hasImages = images.length > 0;
    if ((!text && !hasImages) || mutation.isPending || isOverLimit) return;

    setMessage("");
    const pendingImages = hasImages ? images.slice() : [];
    clearImages();
    const messageId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    setOptimistic({ id: messageId, text, createdAt });

    let attachments:
      | Array<{
          id: string;
          storagePath: string;
          mimeType: string;
          sizeBytes: number;
          width?: number;
          height?: number;
        }>
      | undefined;

    if (hasImages) {
      if (!user?.id) {
        toast.error("You must be signed in to upload images");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const uploaded: NonNullable<typeof attachments> = [];

      for (const img of pendingImages) {
        const ext = fileExtensionForMime(img.file.type) ?? "bin";
        const attachmentId = crypto.randomUUID();
        const path = `${user.id}/tmp/${messageId}/${attachmentId}.${ext}`;

        const { error } = await supabase.storage
          .from(CHAT_IMAGES_BUCKET)
          .upload(path, img.file, { contentType: img.file.type, upsert: false });

        if (error) {
          toast.error(error.message || "Failed to upload image");
          return;
        }

        uploaded.push({
          id: attachmentId,
          storagePath: path,
          mimeType: img.file.type || "application/octet-stream",
          sizeBytes: img.file.size,
        });
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
  }

  const canSend = useMemo(() => {
    const hasText = message.trim().length > 0;
    const hasImages = images.length > 0;
    return !mutation.isPending && !isOverLimit && (hasText || hasImages);
  }, [images.length, isOverLimit, message, mutation.isPending]);

  return (
    <div className="h-full flex flex-col">
      <ChatHeader
        right={
          <>
            <label className="text-xs text-muted-foreground hidden sm:block">
              Model
            </label>
            <select
              value={modelSlug}
              onChange={(e) => setModelSlug(e.target.value as AiModelSlug)}
              disabled={mutation.isPending}
              className={cn(
                "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow]",
                "focus-visible:ring-[3px]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "w-[220px] max-w-[60vw]",
              )}
              aria-label="AI model"
            >
              {AI_MODELS.map((model) => (
                <option key={model.slug} value={model.slug}>
                  {model.label}
                </option>
              ))}
            </select>
          </>
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
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
            <div className="w-full max-w-2xl -translate-y-20">
              <p className="text-2xl font-semibold tracking-tight">
                Ready when you are.
              </p>

              <form onSubmit={handleSubmit} className="mt-5">
                <InputGroup data-disabled={mutation.isPending || undefined}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length > 0) addImages(files);
                      e.currentTarget.value = "";
                    }}
                  />
                  {previews.length > 0 && (
                    <InputGroupAddon align="block-start" className="border-b w-full">
                      <div className="flex flex-wrap gap-2">
                        {previews.map((p) => (
                          <div
                            key={p.id}
                            className="relative h-20 w-20 overflow-hidden rounded-md border border-border/60 bg-muted"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.url}
                              alt={p.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            <button
                              type="button"
                              className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-full bg-background/80 shadow-sm hover:bg-background"
                              onClick={() => removeImage(p.id)}
                              aria-label="Remove image"
                              title="Remove"
                            >
                              <XIcon className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </InputGroupAddon>
                  )}
                  <InputGroupTextarea
                    placeholder="Ask anything…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="field-sizing-content min-h-auto max-h-40"
                    disabled={mutation.isPending}
                    aria-invalid={isOverLimit || undefined}
                    onPaste={onPaste}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                  />
                  <InputGroupAddon align="inline-start" className="self-end pb-1.5">
                    <InputGroupButton
                      type="button"
                      aria-label="Attach image"
                      title="Attach image"
                      size="icon-sm"
                      disabled={
                        mutation.isPending || images.length >= CHAT_IMAGES_MAX_ATTACHMENTS
                      }
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlusIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                  <InputGroupAddon
                    align="inline-end"
                    className="self-end pb-1.5"
                  >
                    {showCounter && (
                      <span
                        className={
                          isOverLimit
                            ? "text-xs text-destructive font-medium"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {remaining}
                      </span>
                    )}
                    <InputGroupButton
                      type="submit"
                      aria-label="Send"
                      title="Send (Enter)"
                      size="icon-sm"
                      disabled={!canSend}
                    >
                      {mutation.isPending ? (
                        <LoaderCircleIcon className="animate-spin" />
                      ) : (
                        <SendIcon />
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <p className="mt-1.5 text-xs text-muted-foreground/60 hidden sm:block">
                  Enter to send · Shift+Enter for new line · Paste image or attach
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
