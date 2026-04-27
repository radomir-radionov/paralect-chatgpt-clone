export function apiUrl(pathname: string, origin?: string | null) {
  if (!pathname.startsWith("/")) {
    throw new Error(`apiUrl requires a leading '/': ${pathname}`);
  }

  if (origin == null) return pathname;
  return new URL(pathname, origin).toString();
}

