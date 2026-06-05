import { GoogleProvider } from "./google";
import { LibreTranslateProvider } from "./libre";
import { LingvaProvider } from "./lingva";
import { MyMemoryProvider } from "./myMemory";
import { TranslationProvider, TranslationResult } from "./types";
import { TranslatorSettings } from "../config/settings";

export interface ChainResult {
  result?: TranslationResult;
  /** True when at least one provider reported hitting a daily/rate limit. */
  limitReached: boolean;
  /** Provider failure detail per provider, for logging. */
  log: string[];
}

/**
 * Ordered chain of keyless translation providers. The first successful provider wins.
 *
 * When the user configures a self-hosted LibreTranslate endpoint we try it first —
 * it is their deliberate unlimited/offline choice. Otherwise Google (keyless, fast,
 * effectively unlimited for this low volume) is primary, with MyMemory and Lingva as
 * fallbacks for the rare case Google is blocked.
 */
export class ProviderChain {
  private readonly providers: TranslationProvider[];

  constructor(private readonly settings: TranslatorSettings) {
    const ordered: TranslationProvider[] = [];
    if (settings.libreTranslateUrl) {
      ordered.push(new LibreTranslateProvider(settings.libreTranslateUrl));
    }
    ordered.push(new GoogleProvider());
    ordered.push(new MyMemoryProvider());
    ordered.push(new LingvaProvider(settings.lingvaInstanceUrl));
    this.providers = ordered.filter((p) => p.isAvailable());
  }

  async translate(
    text: string,
    source: string,
    target: string,
    signal: AbortSignal
  ): Promise<ChainResult> {
    const log: string[] = [];
    let limitReached = false;

    for (const provider of this.providers) {
      if (signal.aborted) {
        break;
      }
      const outcome = await provider.translate({
        text,
        source,
        target,
        email: this.settings.email || undefined,
        signal,
      });

      if (outcome.ok) {
        return { result: outcome.result, limitReached, log };
      }

      log.push(`${provider.name}: ${outcome.failure.kind}`);
      if (outcome.failure.kind === "limit") {
        limitReached = true;
      }
    }

    return { result: undefined, limitReached, log };
  }
}
