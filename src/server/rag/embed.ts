import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { getServerEnv } from "@/lib/env";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./constants";

function getEmbeddingModel() {
  const { GOOGLE_GENERATIVE_AI_API_KEY } = getServerEnv();
  if (!GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY is required for document embeddings and RAG retrieval (Google AI Studio)",
    );
  }
  const genAI = new GoogleGenerativeAI(GOOGLE_GENERATIVE_AI_API_KEY);
  return genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
}

function assertEmbeddingDim(values: number[], context: string): void {
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected embedding size (${values.length} vs ${EMBEDDING_DIMENSIONS}) for ${context}`,
    );
  }
}

/** Single query embedding for similarity search. */
export async function embedQuery(text: string): Promise<number[]> {
  const model = getEmbeddingModel();
  const input = text.trim().slice(0, 8000);
  if (!input) {
    throw new Error("Empty query for embedding");
  }
  const res = await model.embedContent({
    content: { role: "user", parts: [{ text: input }] },
    taskType: TaskType.RETRIEVAL_QUERY,
  });
  const values = res.embedding.values;
  if (!values?.length) throw new Error("No embedding returned");
  assertEmbeddingDim(values, "query");
  return values;
}

const BATCH = 100;

/** Batch many chunk strings into vectors (same order). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = getEmbeddingModel();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH).map((t) => t.slice(0, 8000));
    const res = await model.batchEmbedContents({
      requests: batch.map((t) => ({
        content: { role: "user", parts: [{ text: t }] },
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      })),
    });
    const list = res.embeddings;
    if (!list || list.length !== batch.length) {
      throw new Error("Batch embedding response size mismatch");
    }
    for (let j = 0; j < batch.length; j++) {
      const values = list[j]?.values;
      if (!values?.length) throw new Error("Missing embedding in batch response");
      assertEmbeddingDim(values, `chunk batch ${i + j}`);
      out.push(values);
    }
  }
  return out;
}

/** True when Google embedding key is set (for RAG pre-checks). */
export function isRagEmbeddingConfigured(): boolean {
  return Boolean(getServerEnv().GOOGLE_GENERATIVE_AI_API_KEY?.trim());
}
