import { ProviderOutcome, TranslateRequest, TranslationProvider } from "./types";

interface LingvaResponse {
  translation?: string;
  error?: string;
}

/**
 * Lingva Translate — an open-source Google Translate frontend, used as a fallback.
 * Keyless. Endpoint: GET {instance}/api/v1/{source}/{target}/{encoded text}
 */
export class LingvaProvider implements TranslationProvider {
  readonly name = "Lingva";

  constructor(private readonly instanceUrl: string) {}

  isAvailable(): boolean {
    return this.instanceUrl.length > 0;
  }

  async translate(req: TranslateRequest): Promise<ProviderOutcome> {
    const source = req.source === "auto" ? "auto" : req.source;
    // Path segments must be encoded; encode slashes etc. inside the text.
    const url = `${this.instanceUrl}/api/v1/${encodeURIComponent(source)}/${encodeURIComponent(
      req.target
    )}/${encodeURIComponent(req.text)}`;

    let response: Response;
    try {
      response = await fetch(url, {
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

    let body: LingvaResponse;
    try {
      body = (await response.json()) as LingvaResponse;
    } catch {
      return { ok: false, failure: { kind: "error" } };
    }

    const text = body.translation?.trim();
    if (!text || body.error) {
      return { ok: false, failure: { kind: "error" } };
    }

    return {
      ok: true,
      result: { text, detectedSource: source, provider: this.name },
    };
  }
}
