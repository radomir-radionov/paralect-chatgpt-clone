import type { LlmMessage } from "../types";

/** Streams UTF-8 text deltas from a chat completion. */
export type StreamChatCompletion = (
  model: string,
  system: string,
  messages: LlmMessage[],
) => AsyncGenerator<string>;
