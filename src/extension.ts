import * as vscode from "vscode";
import { TranslationHoverProvider } from "./hover/translationHoverProvider";
import { ClipboardTranslator } from "./clipboard/clipboardTranslator";
import { affectsSettings, writeTargetLanguage } from "./config/settings";

const COMMON_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "hi", label: "Hindi" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "it", label: "Italian" },
  { code: "ko", label: "Korean" },
  { code: "tr", label: "Turkish" },
];

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Translator");
  const provider = new TranslationHoverProvider(output, context.globalState);
  const clipboard = new ClipboardTranslator(output);
  void clipboard.init();

  // Register for every file scheme/language. VSCode merges our Hover with other
  // providers' hovers, so this never blocks TypeScript or other extensions.
  const selectors: vscode.DocumentSelector = [
    { scheme: "file", language: "*" },
    { scheme: "untitled", language: "*" },
  ];

  context.subscriptions.push(
    output,
    clipboard,
    vscode.languages.registerHoverProvider(selectors, provider),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (affectsSettings(e)) {
        provider.refresh();
        clipboard.refresh();
      }
    }),
    vscode.commands.registerCommand("translator.toggleClipboardTranslation", () => clipboard.toggle()),
    vscode.commands.registerCommand("translator.translateClipboard", () => clipboard.translateClipboardNow()),
    vscode.commands.registerCommand("translator.clearCache", () => {
      provider.clearCache();
      void vscode.window.showInformationMessage("Hover Translator: translation cache cleared.");
    }),
    vscode.commands.registerCommand("translator.setTargetLanguage", async () => {
      const picked = await vscode.window.showQuickPick(
        [
          ...COMMON_LANGUAGES.map((l) => ({ label: l.label, description: l.code })),
          { label: "Other (enter code)…", description: "" },
        ],
        { placeHolder: "Select the language to translate into" }
      );
      if (!picked) {
        return;
      }
      let code = picked.description;
      if (!code) {
        code =
          (await vscode.window.showInputBox({
            prompt: "Enter an ISO 639-1 language code (e.g. nl, sv, pl)",
            validateInput: (v) => (/^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(v.trim()) ? null : "Enter a valid language code"),
          })) ?? "";
        code = code.trim();
      }
      if (code) {
        await writeTargetLanguage(code.toLowerCase());
      }
    })
  );
}

export function deactivate(): void {
  // Disposables registered in context.subscriptions are cleaned up automatically.
}
