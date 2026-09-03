import { NextResponse } from "next/server";

/**
 * Build a 500 response with a safe, human-readable detail.
 *
 * Notion SDK errors and our own env-check errors expose `.code`/`.message`
 * that never contain the integration token, so surfacing them helps debug
 * misconfiguration (missing env var, unshared database, wrong id) in
 * production without leaking secrets.
 */
export function errorResponse(message: string, err: unknown, status = 500) {
  const e = err as { code?: string; message?: string } | undefined;
  const detail = [e?.code, e?.message].filter(Boolean).join(": ") || undefined;
  return NextResponse.json({ error: message, detail }, { status });
}
