"use client";

import { FileTextIcon, ImagePlusIcon, LoaderCircleIcon, SendIcon, XIcon } from "lucide-react";
import { type FormEvent, useId, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@shared/components/ui/input-group";
import { getSupabaseBrowserClient } from "@shared/lib/supabase/client";

import { useSendMessage } from "@domains/chat/mutations/useSendMessage";
import { usePendingChatDocuments } from "@domains/chat/hooks/usePendingChatDocuments";
import { usePendingChatImages } from "@domains/chat/hooks/usePendingChatImages";
import {
  CHAT_DOCUMENT_ACCEPT,
  CHAT_DOCUMENTS_BUCKET,
  CHAT_DOCUMENTS_MAX_ATTACHMENTS,
  fileExtensionForDocument,
} from "@domains/chat/lib/chatDocuments";
import {
  CHAT_IMAGES_BUCKET,
  CHAT_IMAGES_MAX_ATTACHMENTS,
  fileExtensionForMime,
} from "@domains/chat/lib/chatImages";

const MAX_LENGTH = 2000;

type Props = {
  roomId: string;
  author: {
    id: string;
    name: string;
    image_url: string | null;
  };
};

export function ChatInput({ roomId, author }: Props) {
  const [message, setMessage] = useState("");
  const sendMessage = useSendMessage();
  const remaining = MAX_LENGTH - message.length;
  const isOverLimit = remaining < 0;
  const showCounter = remaining <= 200;
  const fileInputId = useId();
  const documentInputId = useId();
  const {
    images,
    previews,
    fileInputRef,
    addImages,
    removeImage,
    consumeImages,
    onPaste,
  } = usePendingChatImages();
  const {
    documents,
    documentPreviews,
    documentInputRef,
    addDocuments,
    removeDocument,
    consumeDocuments,
  } = usePendingChatDocuments();

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = message.trim();
    const hasImages = images.length > 0;
    const hasDocuments = documents.length > 0;
    if ((!text && !hasImages && !hasDocuments) || sendMessage.isPending || isOverLimit) {
      return;
    }

    setMessage("");
    const pendingImages = hasImages ? consumeImages() : [];
    const pendingDocuments = hasDocuments ? consumeDocuments() : [];
    const id = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    let attachments:
      | Array<{
          id: string;
          kind: "image";
          mime_type: string;
          size_bytes: number;
          width: number | null;
          height: number | null;
          storagePath: string;
          preview_url?: string;
          original_name?: string;
        } | {
          id: string;
          kind: "document";
          mime_type: string;
          size_bytes: number;
          width: null;
          height: null;
          storagePath: string;
          original_name: string;
        }>
      | undefined;

    if (hasImages || hasDocuments) {
      const supabase = getSupabaseBrowserClient();
      const uploaded: typeof attachments = [];

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
  }

  const canSend = useMemo(() => {
    const hasText = message.trim().length > 0;
    const hasImages = images.length > 0;
    const hasDocuments = documents.length > 0;
    return !sendMessage.isPending && !isOverLimit && (hasText || hasImages || hasDocuments);
  }, [documents.length, images.length, isOverLimit, message, sendMessage.isPending]);

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 border-t shrink-0">
      {previews.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
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
      )}
      {documentPreviews.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {documentPreviews.map((doc) => (
            <div
              key={doc.id}
              className="flex max-w-64 items-center gap-2 rounded-md border border-border/60 bg-muted px-2.5 py-2 text-sm"
            >
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{doc.name}</span>
              <button
                type="button"
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-background"
                onClick={() => removeDocument(doc.id)}
                aria-label="Remove document"
                title="Remove"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <InputGroup>
        <input
          ref={fileInputRef}
          id={fileInputId}
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
        <input
          ref={documentInputRef}
          id={documentInputId}
          type="file"
          accept={CHAT_DOCUMENT_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) addDocuments(files);
            e.currentTarget.value = "";
          }}
        />
        <InputGroupTextarea
          placeholder="Ask anything…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="field-sizing-content min-h-auto max-h-40"
          disabled={sendMessage.isPending}
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
          <div className="flex items-center gap-1">
            <InputGroupButton
              type="button"
              aria-label="Attach image"
              title="Attach image"
              size="icon-sm"
              disabled={
                sendMessage.isPending || images.length >= CHAT_IMAGES_MAX_ATTACHMENTS
              }
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlusIcon />
            </InputGroupButton>
            <InputGroupButton
              type="button"
              aria-label="Attach document"
              title="Attach document"
              size="icon-sm"
              disabled={
                sendMessage.isPending || documents.length >= CHAT_DOCUMENTS_MAX_ATTACHMENTS
              }
              onClick={() => documentInputRef.current?.click()}
            >
              <FileTextIcon />
            </InputGroupButton>
          </div>
        </InputGroupAddon>
        <InputGroupAddon align="inline-end" className="self-end pb-1.5">
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
            {sendMessage.isPending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <SendIcon />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <p className="mt-1.5 text-xs text-muted-foreground/60 hidden sm:block">
        Enter to send · Shift+Enter for new line · Paste image or attach files
      </p>
    </form>
  );
}
