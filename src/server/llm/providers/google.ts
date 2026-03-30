import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerEnv } from "@/lib/env";
import type { LlmMessage } from "../types";
import type { StreamChatCompletion } from "./types";

export const streamGemini: StreamChatCompletion = async function* (
  model,
  system,
  messages,
) {
  const { GOOGLE_GENERATIVE_AI_API_KEY } = getServerEnv();
  if (!GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
  }
  const gen = new GoogleGenerativeAI(GOOGLE_GENERATIVE_AI_API_KEY);
  const mdl = gen.getGenerativeModel({
    model,
    systemInstruction: system,
  });
  if (messages.length === 0) return;
  const history = messages.slice(0, -1).map((msg) => ({
    role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: geminiParts(msg),
  }));
  const last = messages[messages.length - 1]!;
  const chat = mdl.startChat({ history });
  const result = await chat.sendMessageStream(geminiParts(last));
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
};

function geminiParts(msg: LlmMessage) {
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: msg.content }];
  if (msg.images?.length) {
    for (const img of msg.images) {
      parts.push({
        inlineData: { mimeType: img.mimeType, data: img.base64 },
      });
    }
  }
  return parts;
}
