/** A successful translation result. */
export interface TranslationResult {
  /** The translated text. */
  text: string;
  /** Language detected/used as the source, when the provider reports it. */
  detectedSource?: string;
  /** Name of the provider that produced this result. */
  provider: string;
}

/** Why a provider declined to translate, used to drive fallback and hints. */
export type ProviderFailure =
  | { kind: "limit" } // daily quota / rate limit reached
  | { kind: "error" } // network, parse, or HTTP error
  | { kind: "unavailable" }; // provider not configured / disabled

export type ProviderOutcome =
  | { ok: true; result: TranslationResult }
  | { ok: false; failure: ProviderFailure };

export interface TranslateRequest {
  text: string;
  source: string; // ISO code or "auto"
  target: string; // ISO code
  email?: string; // optional, raises MyMemory limit
  signal: AbortSignal;
}

/** A keyless translation backend. */
export interface TranslationProvider {
  readonly name: string;
  /** Whether this provider can run with the current settings. */
  isAvailable(): boolean;
  translate(req: TranslateRequest): Promise<ProviderOutcome>;
}
