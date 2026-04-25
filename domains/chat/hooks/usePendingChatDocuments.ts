"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  CHAT_DOCUMENTS_MAX_ATTACHMENTS,
  CHAT_DOCUMENTS_MAX_BYTES,
  isSupportedChatDocument,
} from "@domains/chat/lib/chatDocuments";

type PendingDocument = {
  id: string;
  file: File;
};

export type PendingChatDocument = PendingDocument;

export function usePendingChatDocuments() {
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const documentInputRef = useRef<HTMLInputElement | null>(null);

  const documentPreviews = useMemo(
    () =>
      documents.map((doc) => ({
        id: doc.id,
        name: doc.file.name,
        size: doc.file.size,
        type: doc.file.type,
      })),
    [documents],
  );

  const addDocuments = (files: File[]) => {
    const incoming = files.filter(isSupportedChatDocument);
    if (incoming.length === 0) {
      toast.error("Unsupported document type.");
      return;
    }

    const currentCount = documents.length;
    const available = Math.max(0, CHAT_DOCUMENTS_MAX_ATTACHMENTS - currentCount);
    const accepted = incoming.slice(0, available);

    if (incoming.length > accepted.length) {
      toast.error(`You can attach up to ${CHAT_DOCUMENTS_MAX_ATTACHMENTS} documents.`);
    }

    const tooLarge = accepted.find((f) => f.size > CHAT_DOCUMENTS_MAX_BYTES);
    if (tooLarge) {
      toast.error("One of the documents is too large (max 15MB).");
      return;
    }

    setDocuments((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
      })),
    ]);
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((x) => x.id !== id));
  };

  const clearDocuments = () => {
    setDocuments([]);
  };

  const consumeDocuments = () => {
    const current = documents;
    setDocuments([]);
    return current;
  };

  return {
    documents,
    documentPreviews,
    documentInputRef,
    addDocuments,
    removeDocument,
    clearDocuments,
    consumeDocuments,
  };
}
