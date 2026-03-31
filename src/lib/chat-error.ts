const GENERIC_CHAT_ERROR_MESSAGE = "Failed to send message";

export const CHAT_MODEL_RATE_LIMIT_MESSAGE =
  "The selected AI model is temporarily rate-limited. Please wait a moment and try again, or switch to another model.";

const SAFE_CHAT_ERROR_MESSAGES = new Set([
  CHAT_MODEL_RATE_LIMIT_MESSAGE,
  "Streaming interrupted before completion. Please try again.",
  "The model stopped responding during streaming. Please try again.",
  "Anonymous quota exceeded",
  "Not found",
]);

const RAW_PROVIDER_MESSAGE_PATTERNS = [
  /\[GoogleGenerativeAI Error\]/i,
  /generativelanguage\.googleapis\.com/i,
  /streamGenerateContent/i,
];

const RATE_LIMIT_MESSAGE_PATTERNS = [
  /\b429\b/,
  /too many requests/i,
  /quota exceeded/i,
  /rate limit/i,
  /rate-limited/i,
  /resource_exhausted/i,
  /retry in \d/i,
  /generate_content_free_tier_requests/i,
];

type MaybeGeminiError = {
  message?: unknown;
  status?: unknown;
  statusText?: unknown;
  errorDetails?: unknown;
};

export function normalizeGeminiProviderError(error: unknown): Error {
  if (isGeminiRateLimitError(error)) {
    return new Error(CHAT_MODEL_RATE_LIMIT_MESSAGE);
  }

  if (error instanceof Error && looksLikeRawProviderMessage(error.message)) {
    return new Error(GENERIC_CHAT_ERROR_MESSAGE);
  }

  return error instanceof Error
    ? error
    : new Error(GENERIC_CHAT_ERROR_MESSAGE);
}

export function toUserFacingChatErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (!message) return GENERIC_CHAT_ERROR_MESSAGE;

  if (SAFE_CHAT_ERROR_MESSAGES.has(message)) {
    return message;
  }

  if (isGeminiRateLimitError(error)) {
    return CHAT_MODEL_RATE_LIMIT_MESSAGE;
  }

  if (looksLikeRawProviderMessage(message) || looksLikeRawTransportMessage(message)) {
    return GENERIC_CHAT_ERROR_MESSAGE;
  }

  return message;
}

/** True when a chat detail GET failed because the thread is missing or not owned (terminal: stop polling / redirect). */
export function isChatNotFoundError(error: unknown): boolean {
  const msg = errorMessageString(error);
  if (msg === "Not found" || msg === "HTTP 404") {
    return true;
  }
  if (error && typeof error === "object" && "cause" in error) {
    const { cause } = error as { cause: unknown };
    if (cause !== undefined && cause !== error) {
      return isChatNotFoundError(cause);
    }
  }
  return false;
}

function errorMessageString(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

export function parseChatErrorResponseText(text: string, status: number): string {
  if (!text) return `HTTP ${status}`;

  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {
    // Fall back to the raw text for plain-text responses.
  }

  return text || `HTTP ${status}`;
}

function isGeminiRateLimitError(error: unknown): boolean {
  if (!(typeof error === "object" && error !== null)) {
    return false;
  }

  const maybeError = error as MaybeGeminiError;
  const message =
    typeof maybeError.message === "string" ? maybeError.message : "";
  const status = typeof maybeError.status === "number" ? maybeError.status : undefined;
  const statusText =
    typeof maybeError.statusText === "string" ? maybeError.statusText : "";
  const detailText =
    typeof maybeError.errorDetails === "string"
      ? maybeError.errorDetails
      : JSON.stringify(maybeError.errorDetails ?? "");

  return (
    looksLikeRawProviderMessage(message) &&
    (status === 429 ||
      isRateLimitMessage(message) ||
      isRateLimitMessage(statusText) ||
      isRateLimitMessage(detailText))
  );
}

function isRateLimitMessage(value: string): boolean {
  return RATE_LIMIT_MESSAGE_PATTERNS.some((pattern) => pattern.test(value));
}

function looksLikeRawProviderMessage(value: string): boolean {
  return RAW_PROVIDER_MESSAGE_PATTERNS.some((pattern) => pattern.test(value));
}

function looksLikeRawTransportMessage(value: string): boolean {
  return (
    value.startsWith("<!DOCTYPE html") ||
    value.startsWith("<html") ||
    value.startsWith("{\"error\":") ||
    /^HTTP \d{3}$/i.test(value) ||
    value === "Internal error"
  );
}
