export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      const j = JSON.parse(text) as { error?: unknown };
      message =
        typeof j.error === "string"
          ? j.error
          : JSON.stringify(j.error ?? text);
    } catch {
      /* keep text */
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function uploadLibraryDocument(
  path: "/api/documents" | "/api/guest/documents",
  file: File,
  options?: { chatId?: string },
): Promise<{ document: { id: string } }> {
  const fd = new FormData();
  fd.append("file", file);
  if (options?.chatId) {
    fd.append("meta", JSON.stringify({ chatId: options.chatId }));
  }
  const res = await fetch(path, {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const j = JSON.parse(text) as { error?: unknown };
      if (typeof j.error === "string") message = j.error;
    } catch {
      /* keep text */
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ document: { id: string } }>;
}

export async function parseSseStream(
  response: Response,
  onToken: (chunk: string) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      const data = JSON.parse(json) as {
        type?: string;
        text?: string;
        message?: string;
      };
      if (data.type === "token" && data.text) {
        onToken(data.text);
      }
      if (data.type === "error") {
        throw new Error(data.message ?? "Stream error");
      }
    }
  }
}
