import type { RequestPrincipal } from "@/server/auth/principal";
import type { AllowedDocumentMimeType } from "@/server/rag/constants";
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

type IngestFn = (options: {
  documentId: string;
  buffer: Buffer;
  mimeType: AllowedDocumentMimeType;
}) => Promise<void>;

type IngestDocumentForPrincipalDependencies = {
  ingestUserDocument?: IngestFn;
  ingestGuestDocument?: IngestFn;
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
  // Dynamic import to avoid pulling parse.ts (pdf-parse / pdfjs-dist) into
  // routes that only need retrieveContextForPrincipal.  The top-level
  // ensurePdfJsWorkerSrc() in parse.ts uses require.resolve which Turbopack
  // replaces with a numeric module id, breaking the build for stream routes.
  const { ingestUserDocument, ingestGuestDocument } = await import(
    "@/server/rag/ingest"
  );
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
