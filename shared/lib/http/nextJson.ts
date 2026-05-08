import { NextResponse } from "next/server";

export type ApiErrorBody = {
  error: true;
  message: string;
};

export type ApiOkBody<T extends Record<string, unknown> = Record<string, never>> =
  { error: false } & T;

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: true, message } satisfies ApiErrorBody, {
    status,
  });
}

export function jsonOk<T extends Record<string, unknown>>(
  body?: T,
  init?: number | ResponseInit,
): NextResponse {
  const responseInit: ResponseInit | undefined =
    typeof init === "number" ? { status: init } : init;

  const payload = ({ error: false, ...(body ?? {}) } as unknown) as ApiOkBody<T>;
  return NextResponse.json(payload, responseInit);
}

