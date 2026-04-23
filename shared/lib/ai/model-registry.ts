export const AI_MODELS = [
  {
    slug: "openai:gpt-5-mini",
    provider: "openai",
    providerModelId: "gpt-5-mini",
    label: "OpenAI GPT-5 Mini",
    description: "Fast general-purpose OpenAI model for everyday chat.",
  },
  {
    slug: "google:gemini-2.5-flash",
    provider: "google",
    providerModelId: "gemini-2.5-flash",
    label: "Google Gemini 2.5 Flash",
    description: "Fast Gemini model tuned for responsive interactive chat.",
  },
  {
    slug: "groq:llama-3.3-70b-versatile",
    provider: "groq",
    providerModelId: "llama-3.3-70b-versatile",
    label: "Groq Llama 3.3 70B",
    description: "High-quality Groq-hosted model (OpenAI-compatible endpoint).",
  },
] as const;

export type AiModelDefinition = (typeof AI_MODELS)[number];
export type AiModelSlug = AiModelDefinition["slug"];
export type AiProvider = AiModelDefinition["provider"];

export const DEFAULT_AI_MODEL_SLUG: AiModelSlug = "google:gemini-2.5-flash";
export const AI_MODEL_SLUGS = AI_MODELS.map((model) => model.slug) as [
  AiModelSlug,
  ...AiModelSlug[],
];

export function isAiModelSlug(value: string): value is AiModelSlug {
  return AI_MODEL_SLUGS.includes(value as AiModelSlug);
}

export function getAiModelBySlug(slug: string): AiModelDefinition | null {
  return AI_MODELS.find((model) => model.slug === slug) ?? null;
}
