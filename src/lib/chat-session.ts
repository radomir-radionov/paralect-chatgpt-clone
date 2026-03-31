import type { User } from "@supabase/supabase-js";

export type ChatSessionState =
  | {
      status: "loading";
      role: null;
      user: null;
    }
  | {
      status: "guest";
      role: "guest";
      user: null;
    }
  | {
      status: "user";
      role: "user";
      user: User;
    };

export function resolveChatSessionState(options: {
  user: User | null;
  authLoading: boolean;
}): ChatSessionState {
  if (options.authLoading) {
    return {
      status: "loading",
      role: null,
      user: null,
    };
  }

  if (!options.user) {
    return {
      status: "guest",
      role: "guest",
      user: null,
    };
  }

  return {
    status: "user",
    role: "user",
    user: options.user,
  };
}

export function getChatApiSurface(session: ChatSessionState): {
  documentQueryKey: readonly ["documents"] | readonly ["guest-documents"];
  documentsPath: "/api/documents" | "/api/guest/documents";
  deleteDocumentPath: (documentId: string) => string;
  quotaPath: "/api/guest/quota" | null;
} {
  if (session.role === "user") {
    return {
      documentQueryKey: ["documents"],
      documentsPath: "/api/documents",
      deleteDocumentPath: (documentId) => `/api/documents/${documentId}`,
      quotaPath: null,
    };
  }

  return {
    documentQueryKey: ["guest-documents"],
    documentsPath: "/api/guest/documents",
    deleteDocumentPath: (documentId) => `/api/guest/documents/${documentId}`,
    quotaPath: "/api/guest/quota",
  };
}
