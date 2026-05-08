import type { NextResponse } from "next/server";

import { jsonError } from "./nextJson";

export type ReadJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; response: NextResponse };

export async function readJson(req: Request): Promise<ReadJsonResult> {
  try {
    const data: unknown = await req.json();
    return { ok: true, data };
  } catch {
    return { ok: false, response: jsonError("Invalid JSON body", 400) };
  }
}

