import { ApiError } from "../http/ApiError";

/** Avoid TanStack Query retry storms when the API returns terminal client errors. */
export function chatFetchRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 404 || error.status === 401 || error.status === 403) {
      return false;
    }
  }
  return failureCount < 3;
}
