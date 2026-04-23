import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type ModelMessage } from "ai";

import { getProviderApiKey } from "./env";
import { getAiModelBySlug, type AiModelDefinition, type AiModelSlug } from "./model-registry";

function resolveLanguageModel(model: AiModelDefinition) {
  switch (model.provider) {
    case "openai":
      return createOpenAI({
        apiKey: getProviderApiKey("openai"),
      })(model.providerModelId);
    case "google":
      return createGoogleGenerativeAI({
        apiKey: getProviderApiKey("google"),
      })(model.providerModelId);
  }
}

export async function generateAssistantText({
  modelSlug,
  messages,
  system,
}: {
  modelSlug: AiModelSlug;
  messages: ModelMessage[];
  system: string;
}) {
  const model = getAiModelBySlug(modelSlug);

  if (model == null) {
    throw new Error(`Unsupported AI model: ${modelSlug}`);
  }

  const result = await generateText({
    model: resolveLanguageModel(model),
    system,
    messages,
  });

  const text = result.text.trim();
  if (!text) {
    throw new Error("The selected model returned an empty response");
  }

  return {
    model,
    text,
  };
}
