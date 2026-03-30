import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";
import type { LlmMessage } from "../types";
import type { StreamChatCompletion } from "./types";

export async function* streamOpenAIWithClient(
  client: OpenAI,
  model: string,
  system: string,
  messages: LlmMessage[],
): AsyncGenerator<string> {
  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...messages.map((m) => toOpenAIMessage(m)),
  ];
  const stream = await client.chat.completions.create({
    model,
    messages: openaiMessages,
    stream: true,
  });
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

export const streamOpenAI: StreamChatCompletion = async function* (
  model,
  system,
  messages,
) {
  const { OPENAI_API_KEY } = getServerEnv();
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  yield* streamOpenAIWithClient(client, model, system, messages);
};

function toOpenAIMessage(
  m: LlmMessage,
): OpenAI.Chat.ChatCompletionMessageParam {
  if (m.role === "assistant") {
    return { role: "assistant", content: m.content };
  }
  if (m.images?.length) {
    const parts: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: "text", text: m.content },
      ...m.images.map(
        (img): OpenAI.Chat.ChatCompletionContentPart => ({
          type: "image_url",
          image_url: {
            url: `data:${img.mimeType};base64,${img.base64}`,
          },
        }),
      ),
    ];
    return { role: "user", content: parts };
  }
  return { role: "user", content: m.content };
}
