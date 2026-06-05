import { ProviderOutcome, TranslateRequest, TranslationProvider } from "./types";

const ENDPOINT = "https://api.mymemory.translated.net/get";

interface MyMemoryResponse {
  responseData?: { translatedText?: string };
  responseStatus?: number | string;
  responseDetails?: string;
  matches?: Array<{ translation?: string; quality?: string | number }>;
}

/**
 * MyMemory translation API — keyless, translation-memory backed.
 * Free anonymous limit is 5,000 chars/day per IP; supplying an email raises it to 50,000.
 * Docs: https://mymemory.translated.net/doc/spec.php
 */
export class MyMemoryProvider implements TranslationProvider {
  readonly name = "MyMemory";

  isAvailable(): boolean {
    return true;
  }

  async translate(req: TranslateRequest): Promise<ProviderOutcome> {
    // MyMemory uses "Autodetect" rather than "auto" for the source side.
    const source = req.source === "auto" ? "Autodetect" : req.source;
    const params = new URLSearchParams({
      q: req.text,
      langpair: `${source}|${req.target}`,
    });
    if (req.email) {
      params.set("de", req.email);
    }

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

    let body: MyMemoryResponse;
    try {
      body = (await response.json()) as MyMemoryResponse;
    } catch {
      return { ok: false, failure: { kind: "error" } };
    }

    const status = Number(body.responseStatus);
    if (status === 429 || status === 403) {
      return { ok: false, failure: { kind: "limit" } };
    }

    // The daily limit is reported with HTTP 200 and a message in responseDetails.
    if (typeof body.responseDetails === "string" && /quota|limit/i.test(body.responseDetails)) {
      return { ok: false, failure: { kind: "limit" } };
    }

    const text = body.responseData?.translatedText?.trim();
    if (!text) {
      return { ok: false, failure: { kind: "error" } };
    }

    return {
      ok: true,
      result: { text, provider: this.name },
    };
  }
}
