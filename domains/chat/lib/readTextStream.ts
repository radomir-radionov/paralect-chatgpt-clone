export async function readTextStream(
  response: Response,
  onChunk: (chunk: string) => void,
): Promise<void> {
  if (response.body == null) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) onChunk(decoder.decode(value, { stream: true }));
  }

  const remainder = decoder.decode();
  if (remainder) onChunk(remainder);
}

