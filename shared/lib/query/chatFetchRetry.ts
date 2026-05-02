/** Avoid TanStack Query retry storms when the API returns 404 (e.g. deleted room). */
export function chatFetchRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof Error && error.message.includes("(404)")) return false;
  return failureCount < 3;
}
