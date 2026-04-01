import { useCallback, useMemo, useState } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export const MAX_DOCS_PER_MESSAGE = 8;

export type ContextDocumentRow = {
  id: string;
  filename: string;
  status: string;
  errorText?: string | null;
};

/** Human-readable status for the context library; DB may store `failed` + `errorText`. */
export function getContextDocumentStatusHint(doc: ContextDocumentRow): {
  text: string;
  title?: string;
} {
  if (doc.status === "ready") return { text: "" };
  if (doc.status === "processing") return { text: "(processing…)" };
  if (doc.status === "failed") {
    const detail = doc.errorText?.trim();
    if (!detail) return { text: "(failed)" };
    const short = detail.length > 72 ? `${detail.slice(0, 69)}…` : detail;
    return {
      text: `(${short})`,
      title: detail.length > 72 ? detail : undefined,
    };
  }
  return { text: `(${doc.status})` };
}

type ApiSurface = {
  documentQueryKey: readonly ["documents"] | readonly ["guest-documents"];
  documentsPath: "/api/documents" | "/api/guest/documents";
  deleteDocumentPath: (documentId: string) => string;
};

export function useChatContextDocuments(options: {
  apiSurface: ApiSurface;
  enabled: boolean;
  queryClient: QueryClient;
  setSendError: (message: string | null) => void;
}) {
  const { apiSurface, enabled, queryClient, setSendError } = options;
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);

  const documentsQuery = useQuery({
    queryKey: apiSurface.documentQueryKey,
    queryFn: () =>
      apiJson<{
        documents: ContextDocumentRow[];
      }>(apiSurface.documentsPath),
    enabled,
  });

  const docList = useMemo(
    () => documentsQuery.data?.documents ?? [],
    [documentsQuery.data],
  );

  const toggleDocumentSelection = useCallback((id: string) => {
    setSelectedDocumentIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_DOCS_PER_MESSAGE) return prev;
      return [...prev, id];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedDocumentIds([]);
  }, []);

  const handleDocumentUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      setSendError(null);
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(apiSurface.documentsPath, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSendError(
          typeof err.error === "string" ? err.error : "Document upload failed",
        );
        return;
      }
      void queryClient.invalidateQueries({ queryKey: apiSurface.documentQueryKey });
    },
    [apiSurface.documentQueryKey, apiSurface.documentsPath, queryClient, setSendError],
  );

  const handleDeleteContextDocument = useCallback(
    async (documentId: string) => {
      setSendError(null);
      const queryKey = apiSurface.documentQueryKey;
      const previous = queryClient.getQueryData<{ documents: ContextDocumentRow[] }>(
        queryKey,
      );
      const wasSelected = selectedDocumentIds.includes(documentId);

      queryClient.setQueryData<{ documents: ContextDocumentRow[] }>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          documents: prev.documents.filter((d) => d.id !== documentId),
        };
      });
      setSelectedDocumentIds((prev) => prev.filter((id) => id !== documentId));

      const res = await fetch(apiSurface.deleteDocumentPath(documentId), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        if (previous) {
          queryClient.setQueryData(queryKey, previous);
        } else {
          void queryClient.invalidateQueries({ queryKey });
        }
        if (wasSelected) {
          setSelectedDocumentIds((prev) =>
            prev.includes(documentId) ? prev : [...prev, documentId],
          );
        }
        const err = await res.json().catch(() => ({}));
        setSendError(
          typeof err.error === "string" ? err.error : "Could not remove document",
        );
        return;
      }
      void queryClient.invalidateQueries({ queryKey });
    },
    [apiSurface, queryClient, selectedDocumentIds, setSendError],
  );

  return {
    documentsQuery,
    docList,
    selectedDocumentIds,
    toggleDocumentSelection,
    clearSelection,
    handleDocumentUpload,
    handleDeleteContextDocument,
  };
}

