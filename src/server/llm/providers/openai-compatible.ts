import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";
import type { StreamChatCompletion } from "./types";
import { streamOpenAIWithClient } from "./openai";

/** OpenAI-compatible HTTP API (Groq, Together, vLLM, etc.). */
export const streamOpenAICompatible: StreamChatCompletion = async function* (
  model,
  system,
  messages,
) {
  const env = getServerEnv();
  const baseURL = env.OPENAI_COMPATIBLE_BASE_URL;
  const apiKey = env.OPENAI_COMPATIBLE_API_KEY;
  if (!baseURL?.trim() || !apiKey) {
    throw new Error(
      "OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_API_KEY are required for compat models",
    );
  }
  const client = new OpenAI({
    apiKey,
    baseURL: baseURL.replace(/\/$/, ""),
  });
  yield* streamOpenAIWithClient(client, model, system, messages);
};
