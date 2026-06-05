import * as vscode from "vscode";

export interface TranslatorSettings {
  targetLanguage: string;
  sourceLanguage: string;
  email: string;
  libreTranslateUrl: string;
  lingvaInstanceUrl: string;
  maxSelectionLength: number;
  cacheSize: number;
  translateIdentifiers: boolean;
  translateComments: boolean;
  translateStrings: boolean;
  autoTranslateClipboard: boolean;
}

const SECTION = "translator";

/** Reads the current extension settings, applying sensible fallbacks. */
export function readSettings(): TranslatorSettings {
  const cfg = vscode.workspace.getConfiguration(SECTION);

  return {
    targetLanguage: normalizeTarget(cfg.get<string>("targetLanguage", "")),
    sourceLanguage: cfg.get<string>("sourceLanguage", "auto").trim() || "auto",
    email: cfg.get<string>("email", "").trim(),
    libreTranslateUrl: stripTrailingSlash(cfg.get<string>("libreTranslateUrl", "").trim()),
    lingvaInstanceUrl:
      stripTrailingSlash(cfg.get<string>("lingvaInstanceUrl", "https://lingva.ml").trim()) ||
      "https://lingva.ml",
    maxSelectionLength: cfg.get<number>("maxSelectionLength", 1000),
    cacheSize: cfg.get<number>("cacheSize", 500),
    translateIdentifiers: cfg.get<boolean>("translateIdentifiers", true),
    translateComments: cfg.get<boolean>("translateComments", true),
    translateStrings: cfg.get<boolean>("translateStrings", true),
    autoTranslateClipboard: cfg.get<boolean>("autoTranslateClipboard", true),
  };
}

/** True when a configuration change touched any of our settings. */
export function affectsSettings(e: vscode.ConfigurationChangeEvent): boolean {
  return e.affectsConfiguration(SECTION);
}

/** Persists the target language to user settings. */
export async function writeTargetLanguage(code: string): Promise<void> {
  await vscode.workspace
    .getConfiguration(SECTION)
    .update("targetLanguage", code, vscode.ConfigurationTarget.Global);
}

/** Falls back to the editor's display language when no target is configured. */
function normalizeTarget(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length > 0) {
    return trimmed.toLowerCase();
  }
  // vscode.env.language is e.g. "en", "pt-br" — take the base subtag.
  const base = (vscode.env.language || "en").split("-")[0];
  return base.toLowerCase();
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
