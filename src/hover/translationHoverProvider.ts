import * as vscode from "vscode";
import { extractAt, Extraction } from "./textExtractor";
import { LruCache } from "../cache/lruCache";
import { ProviderChain, ChainResult } from "../translate/provider";
import { readSettings, TranslatorSettings } from "../config/settings";

const REQUEST_TIMEOUT_MS = 8000;
const DEBOUNCE_MS = 180;
const LIMIT_HINT_KEY = "translator.limitHintShown";

const KIND_LABEL: Record<Extraction["kind"], string> = {
  selection: "Selection",
  comment: "Comment",
  string: "String",
  identifier: "Identifier",
  prose: "Text",
};

export class TranslationHoverProvider implements vscode.HoverProvider {
  private settings: TranslatorSettings;
  private chain: ProviderChain;
  private cache: LruCache<string>;
  private readonly inFlight = new Map<string, Promise<ChainResult>>();

  constructor(
    private readonly output: vscode.OutputChannel,
    private readonly globalState: vscode.Memento
  ) {
    this.settings = readSettings();
    this.chain = new ProviderChain(this.settings);
    this.cache = new LruCache<string>(this.settings.cacheSize);
  }

  /** Re-read settings after a configuration change. */
  refresh(): void {
    const previous = this.settings;
    this.settings = readSettings();
    this.chain = new ProviderChain(this.settings);
    this.cache.resize(this.settings.cacheSize);
    if (
      previous.targetLanguage !== this.settings.targetLanguage ||
      previous.sourceLanguage !== this.settings.sourceLanguage
    ) {
      this.cache.clear();
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    try {
      return await this.computeHover(document, position, token);
    } catch (err) {
      // Never throw from a hover provider — it would noise up the merged popup.
      this.output.appendLine(`[error] ${String(err)}`);
      return undefined;
    }
  }

  private async computeHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    const target = this.settings.targetLanguage;
    if (!target) {
      this.output.appendLine("[skip] no targetLanguage set — run 'Hover Translator: Set Target Language'");
      return undefined;
    }

    const selection = this.selectionFor(document);
    const extraction = extractAt(document, position, this.settings, selection);
    if (!extraction) {
      return undefined;
    }
    this.output.appendLine(`[hover] ${extraction.kind} "${extraction.sourceText}" -> ${target}`);
    if (token.isCancellationRequested) {
      return undefined;
    }

    const key = `${target}:${extraction.sourceText}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return this.buildHover(extraction, cached, target);
    }

    // Debounce: if the cursor moves on within the window, the token cancels and we bail
    // before spending a request — this is what keeps us within the free daily limit.
    const moved = await delay(DEBOUNCE_MS, token);
    if (moved || token.isCancellationRequested) {
      return undefined;
    }

    const chainResult = await this.translateDeduped(key, extraction.sourceText, target, token);
    if (token.isCancellationRequested) {
      return undefined;
    }

    if (!chainResult.result) {
      if (chainResult.log.length > 0) {
        this.output.appendLine(`[miss] "${extraction.sourceText}" -> ${chainResult.log.join(", ")}`);
      }
      if (chainResult.limitReached) {
        void this.maybeShowLimitHint();
      }
      return undefined;
    }

    const translated = chainResult.result.text;

    // Nothing useful if the text is already in the target language.
    if (normalizeForCompare(translated) === normalizeForCompare(extraction.sourceText)) {
      this.output.appendLine(`[skip] translation equals source ("${translated}")`);
      return undefined;
    }

    this.output.appendLine(`[ok] "${extraction.sourceText}" -> "${translated}" via ${chainResult.result.provider}`);
    this.cache.set(key, translated);
    return this.buildHover(extraction, translated, target, chainResult.result.detectedSource);
  }

  /** Shares one network request across concurrent hovers for the same key. */
  private translateDeduped(
    key: string,
    text: string,
    target: string,
    token: vscode.CancellationToken
  ): Promise<ChainResult> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const onCancel = token.onCancellationRequested(() => controller.abort());

    const promise = this.chain
      .translate(text, this.settings.sourceLanguage, target, controller.signal)
      .finally(() => {
        clearTimeout(timeout);
        onCancel.dispose();
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  private selectionFor(document: vscode.TextDocument): vscode.Selection | undefined {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.toString() === document.uri.toString()) {
      return editor.selection;
    }
    return undefined;
  }

  private buildHover(
    extraction: Extraction,
    translated: string,
    target: string,
    detectedSource?: string
  ): vscode.Hover {
    const md = new vscode.MarkdownString();
    md.supportThemeIcons = true;
    const sourceLabel = (detectedSource || this.settings.sourceLanguage).toUpperCase();
    const arrow = `${sourceLabel} → ${target.toUpperCase()}`;
    md.appendMarkdown(`$(globe) **Translation** &nbsp;·&nbsp; ${KIND_LABEL[extraction.kind]} &nbsp;·&nbsp; ${arrow}\n\n`);
    md.appendMarkdown(`${escapeMarkdown(translated)}\n\n`);
    if (extraction.kind === "identifier" && extraction.sourceText !== extraction.original) {
      md.appendMarkdown(`<sub>from \`${extraction.original}\` → _${escapeMarkdown(extraction.sourceText)}_</sub>`);
      md.supportHtml = true;
    }
    return new vscode.Hover(md, extraction.range);
  }

  private async maybeShowLimitHint(): Promise<void> {
    if (this.globalState.get<boolean>(LIMIT_HINT_KEY)) {
      return;
    }
    await this.globalState.update(LIMIT_HINT_KEY, true);
    const pick = await vscode.window.showInformationMessage(
      "Hover Translator reached the free daily translation limit. Add an email or a self-hosted LibreTranslate URL to raise it.",
      "Open Settings"
    );
    if (pick === "Open Settings") {
      await vscode.commands.executeCommand("workbench.action.openSettings", "translator");
    }
  }
}

/** Resolves to `false` after `ms`, or `true` immediately if cancelled. */
function delay(ms: number, token: vscode.CancellationToken): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sub.dispose();
      resolve(false);
    }, ms);
    const sub = token.onCancellationRequested(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

function normalizeForCompare(s: string): string {
  return s.trim().toLowerCase();
}

function escapeMarkdown(s: string): string {
  return s.replace(/([\\`*_{}[\]()#+\-.!|>])/g, "\\$1");
}
