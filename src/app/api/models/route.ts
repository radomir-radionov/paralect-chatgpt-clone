import { NextResponse } from "next/server";

export async function GET() {
  const models: { id: string; label: string }[] = [];
  if (process.env.OPENAI_API_KEY) {
    models.push({
      id: "openai:gpt-4o-mini",
      label: "GPT-4o mini (OpenAI)",
    });
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const googleModels: { id: string; label: string }[] = [
      { id: "google:gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "google:gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
      { id: "google:gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ];
    models.push(...googleModels);
  }
  const compatBase = process.env.OPENAI_COMPATIBLE_BASE_URL?.trim();
  const compatKey = process.env.OPENAI_COMPATIBLE_API_KEY;
  const compatDefault = process.env.OPENAI_COMPATIBLE_DEFAULT_MODEL?.trim();
  if (compatBase && compatKey && compatDefault) {
    models.push({
      id: `compat:${compatDefault}`,
      label: `OpenAI-compatible (${compatDefault})`,
    });
  }
  if (!models.length) {
    return NextResponse.json(
      {
        models: [],
        error:
          "Configure OPENAI_API_KEY and/or GOOGLE_GENERATIVE_AI_API_KEY and/or OpenAI-compatible env (OPENAI_COMPATIBLE_BASE_URL, OPENAI_COMPATIBLE_API_KEY, OPENAI_COMPATIBLE_DEFAULT_MODEL)",
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ models });
}
