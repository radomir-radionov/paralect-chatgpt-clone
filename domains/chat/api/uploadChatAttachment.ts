export type UploadChatAttachmentInput = {
  readonly file: File;
  readonly kind: "image" | "document";
  readonly attachmentId: string;
  readonly messageId: string;
  readonly roomId?: string;
  readonly originalName?: string;
};

export async function uploadChatAttachment(input: UploadChatAttachmentInput): Promise<string> {
  const form = new FormData();
  form.set("kind", input.kind);
  form.set("attachmentId", input.attachmentId);
  form.set("messageId", input.messageId);
  if (input.roomId != null && input.roomId !== "") {
    form.set("roomId", input.roomId);
  }
  if (input.originalName != null && input.originalName !== "") {
    form.set("originalName", input.originalName);
  }
  form.set("file", input.file);

  const res = await fetch("/api/uploads/chat-attachment", {
    method: "POST",
    body: form,
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("Upload failed");
  }

  const errMsg =
    typeof (json as { message?: string })?.message === "string"
      ? (json as { message: string }).message
      : `Upload failed (${res.status})`;

  if (!res.ok) {
    throw new Error(errMsg);
  }

  if ((json as { error?: boolean }).error !== false) {
    throw new Error(errMsg);
  }

  const storagePath = (json as { storagePath?: string }).storagePath;
  if (typeof storagePath !== "string" || !storagePath) {
    throw new Error("Invalid upload response");
  }

  return storagePath;
}
