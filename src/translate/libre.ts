import { ProviderOutcome, TranslateRequest, TranslationProvider } from "./types";

interface LibreResponse {
  translatedText?: string;
  detectedLanguage?: { language?: string };
  error?: string;
}

/**
 * Self-hosted LibreTranslate — only active when the user configures an endpoint.
 * Enables unlimited / offline translation. Endpoint: POST {url}/translate
 */
export class LibreTranslateProvider implements TranslationProvider {
  readonly name = "LibreTranslate";

  constructor(private readonly baseUrl: string) {}

  isAvailable(): boolean {
    return this.baseUrl.length > 0;
  }

  async translate(req: TranslateRequest): Promise<ProviderOutcome> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          q: req.text,
          source: req.source,
          target: req.target,
          format: "text",
        }),
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

    let body: LibreResponse;
    try {
      body = (await response.json()) as LibreResponse;
    } catch {
      return { ok: false, failure: { kind: "error" } };
    }

    const text = body.translatedText?.trim();
    if (!text) {
      return { ok: false, failure: { kind: "error" } };
    }

    return {
      ok: true,
      result: {
        text,
        detectedSource: body.detectedLanguage?.language,
        provider: this.name,
      },
    };
  }
}
