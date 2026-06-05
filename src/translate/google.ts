import { ProviderOutcome, TranslateRequest, TranslationProvider } from "./types";

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

/**
 * Google's public `translate_a` endpoint — keyless, fast, and high quality.
 * Used as the primary provider. Response is a nested array:
 *   [[["<translated>", "<original>", ...], ...], null, "<detected source>", ...]
 */
export class GoogleProvider implements TranslationProvider {
  readonly name = "Google";

  isAvailable(): boolean {
    return true;
  }

  async translate(req: TranslateRequest): Promise<ProviderOutcome> {
    const params = new URLSearchParams({
      client: "gtx",
      sl: req.source || "auto",
      tl: req.target,
      dt: "t",
      q: req.text,
    });

    let response: Response;
    try {
      response = await fetch(`${ENDPOINT}?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: req.signal,
      });
    } catch {
      return { ok: false, failure: { kind: "error" } };
    }

    if (response.status === 429) {
      return { ok: false, failure: { kind: "limit" } };
    }
    if (!response.ok) {
      return { ok: false, failure: { kind: "error" } };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, failure: { kind: "error" } };
    }

    const parsed = parseGoogleBody(body);
    if (!parsed) {
      return { ok: false, failure: { kind: "error" } };
    }

    return {
      ok: true,
      result: { text: parsed.text, detectedSource: parsed.detected, provider: this.name },
    };
  }
}

interface ParsedGoogle {
  text: string;
  detected?: string;
}

/** Safely extracts the translated text and detected language from Google's array response. */
function parseGoogleBody(body: unknown): ParsedGoogle | undefined {
  if (!Array.isArray(body)) {
    return undefined;
  }
  const segments = body[0];
  if (!Array.isArray(segments)) {
    return undefined;
  }
  let text = "";
  for (const seg of segments) {
    if (Array.isArray(seg) && typeof seg[0] === "string") {
      text += seg[0];
    }
  }
  text = text.trim();
  if (text.length === 0) {
    return undefined;
  }
  const detected = typeof body[2] === "string" ? body[2] : undefined;
  return { text, detected };
}
