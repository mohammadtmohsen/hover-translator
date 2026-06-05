import * as assert from "assert";
import * as vscode from "vscode";

type FetchFn = typeof globalThis.fetch;
const realFetch: FetchFn = globalThis.fetch;

function stubMyMemory(translated: string): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ responseData: { translatedText: translated }, responseStatus: 200 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as FetchFn;
}

async function getHovers(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.Hover[]> {
  return (
    (await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      doc.uri,
      pos
    )) ?? []
  );
}

function hoverText(hovers: vscode.Hover[]): string {
  return hovers
    .flatMap((h) => h.contents)
    .map((c) => (typeof c === "string" ? c : (c as vscode.MarkdownString).value))
    .join("\n");
}

suite("hover provider (integration)", () => {
  suiteSetup(async () => {
    // Ensure the extension is active so the hover provider is registered.
    const ext = vscode.extensions.all.find((e) => e.packageJSON?.name === "hover-translator");
    await ext?.activate();
    const cfg = vscode.workspace.getConfiguration("translator");
    await cfg.update("targetLanguage", "es", vscode.ConfigurationTarget.Global);
    await cfg.update("sourceLanguage", "auto", vscode.ConfigurationTarget.Global);
    // Give the config-change listener a tick to refresh the provider.
    await new Promise((r) => setTimeout(r, 100));
  });

  teardown(() => {
    globalThis.fetch = realFetch;
  });

  test("translates an identifier (camelCase split) on hover", async () => {
    stubMyMemory("obtener nombre de usuario");
    const doc = await vscode.workspace.openTextDocument({
      language: "typescript",
      content: "const getUserName = 1;\n",
    });
    const hovers = await getHovers(doc, new vscode.Position(0, 10)); // inside getUserName
    const text = hoverText(hovers);
    assert.ok(text.includes("Translation"), `expected a Translation section, got: ${text}`);
    assert.ok(
      text.includes("obtener nombre de usuario"),
      `expected translated text, got: ${text}`
    );
  });

  test("translates a line comment on hover", async () => {
    stubMyMemory("hola mundo");
    const doc = await vscode.workspace.openTextDocument({
      language: "typescript",
      content: "// hello world\n",
    });
    const hovers = await getHovers(doc, new vscode.Position(0, 6)); // inside the comment
    const text = hoverText(hovers);
    assert.ok(text.includes("hola mundo"), `expected translated comment, got: ${text}`);
  });

  test("returns no translation hover for trivial tokens", async () => {
    stubMyMemory("yo");
    const doc = await vscode.workspace.openTextDocument({
      language: "typescript",
      content: "let i = 0;\n",
    });
    const hovers = await getHovers(doc, new vscode.Position(0, 4)); // on "i"
    const text = hoverText(hovers);
    assert.ok(!text.includes("Translation"), `expected no translation for "i", got: ${text}`);
  });
});
