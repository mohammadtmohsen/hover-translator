import * as vscode from "vscode";
import { LruCache } from "../cache/lruCache";
import { ProviderChain } from "../translate/provider";
import { readSettings, TranslatorSettings } from "../config/settings";

const POLL_INTERVAL_MS = 800;
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Translates text the user copies, so chat panels (Claude, Codex, Copilot) — which are
 * webviews and cannot be hovered — can still be translated. The clipboard is only *read*,
 * never written, so the user's copied text stays intact for pasting elsewhere.
 */
export class ClipboardTranslator {
  private settings: TranslatorSettings;
  private chain: ProviderChain;
  private cache: LruCache<string>;
  private timer: ReturnType<typeof setInterval> | undefined;
  private enabled = false;
  private lastClipboard = "";
  private readonly statusBar: vscode.StatusBarItem;

  constructor(private readonly output: vscode.OutputChannel) {
    this.settings = readSettings();
    this.chain = new ProviderChain(this.settings);
    this.cache = new LruCache<string>(this.settings.cacheSize);
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBar.command = "translator.toggleClipboardTranslation";
    this.statusBar.show();
    this.updateStatusBar();
  }

  /** Begin auto-translation if the setting is enabled. */
  async init(): Promise<void> {
    this.enabled = this.settings.autoTranslateClipboard;
    // Snapshot the current clipboard so we don't translate stale content on startup.
    this.lastClipboard = await this.safeReadClipboard();
    this.updateStatusBar();
    this.applyPolling();
  }

  refresh(): void {
    this.settings = readSettings();
    this.chain = new ProviderChain(this.settings);
    this.cache.resize(this.settings.cacheSize);
    // Follow the setting unless the user toggled it manually this session.
    this.enabled = this.settings.autoTranslateClipboard;
    this.updateStatusBar();
    this.applyPolling();
  }

  async toggle(): Promise<void> {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.lastClipboard = await this.safeReadClipboard();
    }
    this.updateStatusBar();
    this.applyPolling();
    void vscode.window.setStatusBarMessage(
      `Clipboard translation ${this.enabled ? "on" : "off"}`,
      2000
    );
  }

  /** Manual one-shot translation of the current clipboard. */
  async translateClipboardNow(): Promise<void> {
    const text = (await this.safeReadClipboard()).trim();
    if (!text) {
      void vscode.window.showInformationMessage("Clipboard is empty — copy some text first.");
      return;
    }
    await this.translateAndShow(text);
  }

  dispose(): void {
    this.stopPolling();
    this.statusBar.dispose();
  }

  private applyPolling(): void {
    if (this.enabled && !this.timer) {
      this.timer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
    } else if (!this.enabled) {
      this.stopPolling();
    }
  }

  private stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async poll(): Promise<void> {
    if (!this.settings.targetLanguage) {
      return;
    }
    const current = await this.safeReadClipboard();
    if (current === this.lastClipboard) {
      return;
    }
    this.lastClipboard = current;
    const text = current.trim();
    if (!isTranslatable(text, this.settings.maxSelectionLength)) {
      return;
    }
    await this.translateAndShow(text);
  }

  private async translateAndShow(text: string): Promise<void> {
    const capped = text.length > this.settings.maxSelectionLength
      ? text.slice(0, this.settings.maxSelectionLength)
      : text;

    const target = this.settings.targetLanguage;
    const key = `${target}:${capped}`;
    let translated = this.cache.get(key);

    if (translated === undefined) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const result = await this.chain.translate(
          capped,
          this.settings.sourceLanguage,
          target,
          controller.signal
        );
        if (!result.result) {
          this.output.appendLine(
            `[clipboard miss] ${result.log.join(", ") || "(no providers ran)"}`
          );
          return;
        }
        translated = result.result.text;
        this.cache.set(key, translated);
      } catch (err) {
        this.output.appendLine(`[clipboard error] ${String(err)}`);
        return;
      } finally {
        clearTimeout(timeout);
      }
    }

    if (translated.trim().toLowerCase() === capped.trim().toLowerCase()) {
      return; // already in the target language
    }

    await this.showPopup(translated);
  }

  private async showPopup(translated: string): Promise<void> {
    // A plain notification (no buttons) uses VSCode's native behavior: the toast
    // auto-dismisses after a few seconds, but stays open if the user expands it
    // (the chevron) or hovers over it. VSCode also truncates + adds the expand
    // arrow for long text automatically. We never write to the clipboard.
    void vscode.window.showInformationMessage(translated);
  }

  private updateStatusBar(): void {
    const lang = this.settings.targetLanguage.toUpperCase() || "?";
    if (this.enabled) {
      this.statusBar.text = `$(globe) Translate: ${lang}`;
      this.statusBar.tooltip = "Auto-translating copied text. Click to turn off.";
    } else {
      this.statusBar.text = "$(globe) Translate: off";
      this.statusBar.tooltip = "Click to auto-translate text you copy (e.g. from chat panels).";
    }
  }

  private async safeReadClipboard(): Promise<string> {
    try {
      return await vscode.env.clipboard.readText();
    } catch {
      return "";
    }
  }
}

/** Accept prose-like clipboard content; skip empties and trivial fragments. */
function isTranslatable(text: string, max: number): boolean {
  if (text.length < 2 || text.length > max * 4) {
    return false;
  }
  return /\p{L}/u.test(text);
}
