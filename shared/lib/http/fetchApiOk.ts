import { ApiError } from "./ApiError";

export type ApiErrorBody = {
  error: true;
  message: string;
};

export type ApiOk<T extends Record<string, unknown>> = { error: false } & T;

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value != null &&
    (value as { error?: unknown }).error === true &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

export async function fetchApiOk<T extends Record<string, unknown>>(
  input: string | URL,
  init?: RequestInit,
): Promise<ApiOk<T>> {
  const res = await fetch(input, init);

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    if (isApiErrorBody(json)) throw new ApiError(json.message, res.status);
    throw new ApiError("Request failed", res.status);
  }

  if (typeof json !== "object" || json == null) {
    throw new ApiError("Invalid JSON response", res.status);
  }

  if (isApiErrorBody(json)) {
    throw new ApiError(json.message, res.status);
  }

  if ((json as { error?: unknown }).error !== false) {
    throw new ApiError("Unexpected API response shape", res.status);
  }

  return json as ApiOk<T>;
}

