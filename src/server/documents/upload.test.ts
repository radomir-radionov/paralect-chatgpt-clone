import assert from "node:assert/strict";
import test from "node:test";
import {
  DocumentUploadError,
  parseDocumentUpload,
  sanitizeDocumentFilename,
} from "@/server/documents/upload";

test("sanitizeDocumentFilename trims separators and length", () => {
  const name = sanitizeDocumentFilename(`  a/b\\${"x".repeat(210)}.pdf  `);

  assert.equal(name.includes("/"), false);
  assert.equal(name.includes("\\"), false);
  assert.equal(name.length <= 200, true);
});

test("parseDocumentUpload rejects requests without a file", async () => {
  const request = new Request("http://localhost/api/documents", {
    method: "POST",
    body: new FormData(),
  });

  await assert.rejects(
    () => parseDocumentUpload(request),
    (error: unknown) =>
      error instanceof DocumentUploadError &&
      error.status === 400 &&
      error.message === "Missing file field",
  );
});

test("parseDocumentUpload accepts supported files and normalizes the filename", async () => {
  const form = new FormData();
  form.append(
    "file",
    new File(["hello"], " nested/path.md ", { type: "text/markdown" }),
  );
  const request = new Request("http://localhost/api/documents", {
    method: "POST",
    body: form,
  });

  const upload = await parseDocumentUpload(request);

  assert.equal(upload.mimeType, "text/markdown");
  assert.equal(upload.filename, "nested_path.md");
  assert.equal(upload.buffer.toString("utf8"), "hello");
});
