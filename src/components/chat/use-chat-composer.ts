import { useCallback, useEffect, useState } from "react";
import { assertImageFileClient, getClipboardImageFile } from "@/lib/image-attachment";

export type PendingImage = {
  mimeType: string;
  base64: string;
  preview: string;
};

function revokePreviewUrls(images: readonly PendingImage[]) {
  for (const image of images) {
    URL.revokeObjectURL(image.preview);
  }
}

function readFileAsBase64(file: File) {
  return new Promise<PendingImage>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve({
        mimeType: file.type,
        base64,
        preview: URL.createObjectURL(file),
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useChatComposer(options: {
  setSendError: (message: string | null) => void;
}) {
  const { setSendError } = options;
  const [draft, setDraft] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);

  useEffect(() => {
    return () => {
      revokePreviewUrls(pendingImages);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearPendingImages = useCallback(() => {
    setPendingImages((previous) => {
      revokePreviewUrls(previous);
      return [];
    });
  }, []);

  const addValidatedImage = useCallback(
    async (file: File) => {
      const err = assertImageFileClient(file);
      if (err) {
        setSendError(err);
        return;
      }
      setSendError(null);
      const image = await readFileAsBase64(file);
      setPendingImages((previous) => {
        revokePreviewUrls(previous);
        return [image];
      });
    },
    [setSendError],
  );

  const removePendingImage = useCallback((index: number) => {
    setPendingImages((previous) => {
      const removed = previous[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return previous.filter((_, itemIndex) => itemIndex !== index);
    });
  }, []);

  const handlePasteImage = useCallback(
    async (event: React.ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items?.length) return;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item) continue;
        const file = getClipboardImageFile(item);
        if (!file) continue;
        event.preventDefault();
        await addValidatedImage(file);
        break;
      }
    },
    [addValidatedImage],
  );

  const handleImageFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        try {
          await addValidatedImage(file);
        } catch {
          setSendError("Could not read image file.");
        }
      }
      event.target.value = "";
    },
    [addValidatedImage, setSendError],
  );

  const resetAfterSend = useCallback(() => {
    setDraft("");
    clearPendingImages();
  }, [clearPendingImages]);

  return {
    draft,
    setDraft,
    pendingImages,
    addValidatedImage,
    removePendingImage,
    clearPendingImages,
    handlePasteImage,
    handleImageFileInputChange,
    resetAfterSend,
  };
}

