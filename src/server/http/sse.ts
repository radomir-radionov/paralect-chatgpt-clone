export function sseResponse(
  stream: AsyncIterable<string>,
  onComplete?: (fullText: string) => Promise<void>,
) {
  const encoder = new TextEncoder();
  let full = "";
  const readable = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
        );
      };
      const sendDone = () => send({ type: "done" });
      try {
        for await (const chunk of stream) {
          full += chunk;
          send({ type: "token", text: chunk });
        }
        if (onComplete) await onComplete(full);
        sendDone();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Stream error";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
