"use client";

import { type ClipboardEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  CHAT_IMAGES_MAX_ATTACHMENTS,
  CHAT_IMAGES_MAX_BYTES,
} from "@domains/chat/lib/chatImages";

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
};

export type PendingChatImage = PendingImage;

export function usePendingChatImages() {
  const [images, setImages] = useState<PendingImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const previews = useMemo(
    () =>
      images.map((img) => ({
        id: img.id,
        url: img.previewUrl,
        name: img.file.name,
        size: img.file.size,
        type: img.file.type,
      })),
    [images],
  );

  const addImages = (files: File[]) => {
    const incoming = files.filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) return;

    const currentCount = images.length;
    const available = Math.max(0, CHAT_IMAGES_MAX_ATTACHMENTS - currentCount);
    const accepted = incoming.slice(0, available);

    if (incoming.length > accepted.length) {
      toast.error(`You can attach up to ${CHAT_IMAGES_MAX_ATTACHMENTS} images.`);
    }

    const tooLarge = accepted.find((f) => f.size > CHAT_IMAGES_MAX_BYTES);
    if (tooLarge) {
      toast.error("One of the images is too large (max 10MB).");
      return;
    }

    setImages((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const removed = prev.find((x) => x.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const clearImages = () => {
    setImages((prev) => {
      prev.forEach((i) => URL.revokeObjectURL(i.previewUrl));
      return [];
    });
  };

  /**
   * Clears the pending images WITHOUT revoking object URLs.
   * Useful when the caller needs the previews to remain valid (e.g. optimistic
   * message rendering) and will handle revocation later.
   */
  const consumeImages = () => {
    const current = images;
    setImages([]);
    return current;
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const files = items
      .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .filter((f): f is File => f != null);
    if (files.length > 0) {
      e.preventDefault();
      addImages(files);
    }
  };

  return {
    images,
    previews,
    fileInputRef,
    addImages,
    removeImage,
    clearImages,
    consumeImages,
    onPaste,
  };
}

