export type ApiError = {
  error: true;
  message: string;
};

export type ApiOk<T extends Record<string, unknown>> = { error: false } & T;

function isApiError(value: unknown): value is ApiError {
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
    if (isApiError(json)) throw new Error(json.message);
    throw new Error(`Request failed (${res.status})`);
  }

  if (typeof json !== "object" || json == null) {
    throw new Error("Invalid JSON response");
  }

  if (isApiError(json)) {
    throw new Error(json.message);
  }

  if ((json as { error?: unknown }).error !== false) {
    throw new Error("Unexpected API response shape");
  }

  return json as ApiOk<T>;
}

