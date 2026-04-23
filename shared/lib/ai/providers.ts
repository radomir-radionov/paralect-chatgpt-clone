import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText, type ModelMessage } from "ai";

import { getProviderApiKey } from "./env";
import { getAiModelBySlug, type AiModelDefinition, type AiModelSlug } from "./model-registry";

function resolveLanguageModel(model: AiModelDefinition) {
  switch (model.provider) {
    case "openai":
      return createOpenAI({
        apiKey: getProviderApiKey("openai"),
      })(model.providerModelId);
    case "groq":
      return createOpenAI({
        name: "groq",
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: getProviderApiKey("groq"),
      })(model.providerModelId);
    case "google":
      return createGoogleGenerativeAI({
        apiKey: getProviderApiKey("google"),
      })(model.providerModelId);
  }
}

function getModelOrThrow(modelSlug: AiModelSlug): AiModelDefinition {
  const model = getAiModelBySlug(modelSlug);
  if (model == null) {
    throw new Error(`Unsupported AI model: ${modelSlug}`);
  }
  return model;
}

function getResolvedLanguageModel(modelSlug: AiModelSlug) {
  const model = getModelOrThrow(modelSlug);
  return {
    model,
    languageModel: resolveLanguageModel(model),
  };
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
  const { model, languageModel } = getResolvedLanguageModel(modelSlug);

  const result = await generateText({
    model: languageModel,
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

export function streamAssistantText({
  modelSlug,
  messages,
  system,
}: {
  modelSlug: AiModelSlug;
  messages: ModelMessage[];
  system: string;
}) {
  const { model, languageModel } = getResolvedLanguageModel(modelSlug);

  const result = streamText({
    model: languageModel,
    system,
    messages,
  });

  return {
    model,
    textStream: result.textStream,
  };
}
