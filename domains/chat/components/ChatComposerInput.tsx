"use client";

import { FileTextIcon, ImagePlusIcon, LoaderCircleIcon, SendIcon, XIcon } from "lucide-react";
import { type FormEvent, useId, useMemo, useState } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@shared/components/ui/input-group";

import { usePendingChatDocuments } from "@domains/chat/hooks/usePendingChatDocuments";
import { usePendingChatImages } from "@domains/chat/hooks/usePendingChatImages";
import { CHAT_DOCUMENT_ACCEPT, CHAT_DOCUMENTS_MAX_ATTACHMENTS } from "@domains/chat/lib/chatDocuments";
import { CHAT_IMAGES_MAX_ATTACHMENTS } from "@domains/chat/lib/chatImages";

const MAX_LENGTH = 2000;

export type ComposerPendingImage = {
  id: string;
  file: File;
  previewUrl: string;
};

export type ComposerPendingDocument = {
  id: string;
  file: File;
};

export type ComposerSubmitPayload = {
  text: string;
  pendingImages: ComposerPendingImage[];
  pendingDocuments: ComposerPendingDocument[];
  createdAt: string;
};

type Props = {
  disabled?: boolean;
  isSending?: boolean;
  placeholder?: string;
  footerText?: string;
  onSubmit: (payload: ComposerSubmitPayload) => Promise<void> | void;
};

export function ChatComposerInput({
  disabled = false,
  isSending = false,
  placeholder = "Ask anything…",
  footerText = "Enter to send · Shift+Enter for new line · Paste image or attach files",
  onSubmit,
}: Props) {
  const [message, setMessage] = useState("");
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

  const canSend = useMemo(() => {
    const hasText = message.trim().length > 0;
    const hasImages = images.length > 0;
    const hasDocuments = documents.length > 0;
    return !disabled && !isOverLimit && (hasText || hasImages || hasDocuments);
  }, [disabled, documents.length, images.length, isOverLimit, message]);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();

    const text = message.trim();
    const hasImages = images.length > 0;
    const hasDocuments = documents.length > 0;
    if ((!text && !hasImages && !hasDocuments) || disabled || isOverLimit) {
      return;
    }

    setMessage("");
    const pendingImages = hasImages ? (consumeImages() as ComposerPendingImage[]) : [];
    const pendingDocuments = hasDocuments ? (consumeDocuments() as ComposerPendingDocument[]) : [];
    const createdAt = new Date().toISOString();

    await onSubmit({
      text,
      pendingImages,
      pendingDocuments,
      createdAt,
    });
  }

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

      <InputGroup data-disabled={disabled || undefined}>
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
          placeholder={placeholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="field-sizing-content min-h-auto max-h-40"
          disabled={disabled}
          aria-invalid={isOverLimit || undefined}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
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
              disabled={disabled || images.length >= CHAT_IMAGES_MAX_ATTACHMENTS}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlusIcon />
            </InputGroupButton>
            <InputGroupButton
              type="button"
              aria-label="Attach document"
              title="Attach document"
              size="icon-sm"
              disabled={disabled || documents.length >= CHAT_DOCUMENTS_MAX_ATTACHMENTS}
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
            {isSending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <SendIcon />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <p className="mt-1.5 text-xs text-muted-foreground/60 hidden sm:block">
        {footerText}
      </p>
    </form>
  );
}

