import type { RequestPrincipal } from "@/server/auth/principal";
import type { AllowedDocumentMimeType } from "@/server/rag/constants";
import {
  ingestGuestDocument,
  ingestUserDocument,
} from "@/server/rag/ingest";
import {
  retrieveContextForGuest,
  retrieveContextForUser,
} from "@/server/rag/retrieve";

type RetrieveContextForPrincipalDependencies = {
  retrieveUserContext?: typeof retrieveContextForUser;
  retrieveGuestContext?: typeof retrieveContextForGuest;
};

export async function retrieveContextForPrincipal(
  principal: RequestPrincipal,
  options: {
    query: string;
    documentIds: string[];
  },
  dependencies: RetrieveContextForPrincipalDependencies = {},
): Promise<string | undefined> {
  const retrieveUserContext =
    dependencies.retrieveUserContext ?? retrieveContextForUser;
  const retrieveGuestContext =
    dependencies.retrieveGuestContext ?? retrieveContextForGuest;

  if (principal.role === "user") {
    return retrieveUserContext({
      userId: principal.user.id,
      query: options.query,
      documentIds: options.documentIds,
    });
  }

  return retrieveGuestContext({
    sessionId: principal.sessionId,
    query: options.query,
    documentIds: options.documentIds,
  });
}

type IngestDocumentForPrincipalDependencies = {
  ingestUserDocument?: typeof ingestUserDocument;
  ingestGuestDocument?: typeof ingestGuestDocument;
};

export async function ingestDocumentForPrincipal(
  principal: RequestPrincipal,
  options: {
    documentId: string;
    buffer: Buffer;
    mimeType: AllowedDocumentMimeType;
  },
  dependencies: IngestDocumentForPrincipalDependencies = {},
): Promise<void> {
  const runUserIngest =
    dependencies.ingestUserDocument ?? ingestUserDocument;
  const runGuestIngest =
    dependencies.ingestGuestDocument ?? ingestGuestDocument;

  if (principal.role === "user") {
    await runUserIngest(options);
    return;
  }

  await runGuestIngest(options);
}
