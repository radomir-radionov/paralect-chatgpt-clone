import "server-only";

import type { AiProvider } from "./model-registry";

function requireEnv(name: "OPENAI_API_KEY" | "GOOGLE_GENERATIVE_AI_API_KEY") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

export function getProviderApiKey(provider: AiProvider) {
  switch (provider) {
    case "openai":
      return requireEnv("OPENAI_API_KEY");
    case "google":
      return requireEnv("GOOGLE_GENERATIVE_AI_API_KEY");
  }
}
