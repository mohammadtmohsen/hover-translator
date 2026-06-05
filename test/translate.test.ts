import * as assert from "assert";
import { GoogleProvider } from "../src/translate/google";
import { MyMemoryProvider } from "../src/translate/myMemory";
import { LingvaProvider } from "../src/translate/lingva";
import { LibreTranslateProvider } from "../src/translate/libre";
import { ProviderChain } from "../src/translate/provider";
import { TranslatorSettings } from "../src/config/settings";

type FetchFn = typeof globalThis.fetch;
const realFetch: FetchFn = globalThis.fetch;

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): void {
  globalThis.fetch = ((input: Parameters<FetchFn>[0], init?: Parameters<FetchFn>[1]) =>
    Promise.resolve(handler(String(input), init as RequestInit))) as FetchFn;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const signal = new AbortController().signal;

function baseSettings(overrides: Partial<TranslatorSettings> = {}): TranslatorSettings {
  return {
    targetLanguage: "es",
    sourceLanguage: "auto",
    email: "",
    libreTranslateUrl: "",
    lingvaInstanceUrl: "https://lingva.ml",
    maxSelectionLength: 1000,
    cacheSize: 500,
    translateIdentifiers: true,
    translateComments: true,
    translateStrings: true,
    autoTranslateClipboard: false,
    ...overrides,
  };
}

suite("translation providers", () => {
  teardown(() => {
    globalThis.fetch = realFetch;
  });

  test("Google parses nested array response", async () => {
    mockFetch(() =>
      new Response(
        JSON.stringify([[["obtener nombre de usuario", "get user name", null, null, 3]], null, "en"]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const out = await new GoogleProvider().translate({
      text: "get user name",
      source: "auto",
      target: "es",
      signal,
    });
    assert.ok(out.ok);
    assert.strictEqual(out.ok && out.result.text, "obtener nombre de usuario");
    assert.strictEqual(out.ok && out.result.detectedSource, "en");
  });

  test("Google concatenates multiple segments", async () => {
    mockFetch(() =>
      new Response(
        JSON.stringify([[["hola ", "hello "], ["mundo", "world"]], null, "en"]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const out = await new GoogleProvider().translate({
      text: "hello world",
      source: "auto",
      target: "es",
      signal,
    });
    assert.ok(out.ok);
    assert.strictEqual(out.ok && out.result.text, "hola mundo");
  });

  test("Google falls through on 429", async () => {
    mockFetch(() => new Response("", { status: 429 }));
    const out = await new GoogleProvider().translate({
      text: "hello",
      source: "auto",
      target: "es",
      signal,
    });
    assert.ok(!out.ok);
    assert.strictEqual(!out.ok && out.failure.kind, "limit");
  });

  test("chain uses Google first", async () => {
    mockFetch((url) => {
      if (url.includes("translate.googleapis.com")) {
        return new Response(JSON.stringify([[["hola", "hello"]], null, "en"]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return json({}, 500);
    });
    const chain = new ProviderChain(baseSettings());
    const result = await chain.translate("hello", "auto", "es", signal);
    assert.strictEqual(result.result?.text, "hola");
    assert.strictEqual(result.result?.provider, "Google");
  });

  test("MyMemory parses translatedText", async () => {
    mockFetch(() => json({ responseData: { translatedText: "hola" }, responseStatus: 200 }));
    const out = await new MyMemoryProvider().translate({
      text: "hello",
      source: "auto",
      target: "es",
      signal,
    });
    assert.ok(out.ok);
    assert.strictEqual(out.ok && out.result.text, "hola");
  });

  test("MyMemory reports quota as a limit failure", async () => {
    mockFetch(() =>
      json({ responseData: { translatedText: "" }, responseStatus: 200, responseDetails: "DAILY LIMIT EXCEEDED" })
    );
    const out = await new MyMemoryProvider().translate({
      text: "hello",
      source: "auto",
      target: "es",
      signal,
    });
    assert.ok(!out.ok);
    assert.strictEqual(!out.ok && out.failure.kind, "limit");
  });

  test("Lingva parses translation", async () => {
    mockFetch(() => json({ translation: "bonjour" }));
    const out = await new LingvaProvider("https://lingva.ml").translate({
      text: "hello",
      source: "auto",
      target: "fr",
      signal,
    });
    assert.ok(out.ok);
    assert.strictEqual(out.ok && out.result.text, "bonjour");
  });

  test("LibreTranslate parses translatedText", async () => {
    mockFetch(() => json({ translatedText: "hallo" }));
    const out = await new LibreTranslateProvider("http://localhost:5000").translate({
      text: "hello",
      source: "auto",
      target: "de",
      signal,
    });
    assert.ok(out.ok);
    assert.strictEqual(out.ok && out.result.text, "hallo");
  });

  test("chain falls through MyMemory limit to Lingva", async () => {
    let call = 0;
    mockFetch((url) => {
      call++;
      if (url.includes("mymemory")) {
        return json({ responseStatus: 429, responseDetails: "limit" });
      }
      if (url.includes("lingva")) {
        return json({ translation: "hola" });
      }
      return json({}, 500);
    });

    const chain = new ProviderChain(baseSettings());
    const result = await chain.translate("hello", "auto", "es", signal);
    assert.strictEqual(result.result?.text, "hola");
    assert.strictEqual(result.limitReached, true);
    assert.ok(call >= 2);
  });

  test("chain prefers configured LibreTranslate", async () => {
    mockFetch((url) => {
      if (url.includes("localhost:5000")) {
        return json({ translatedText: "ciao" });
      }
      return json({}, 500);
    });

    const chain = new ProviderChain(baseSettings({ libreTranslateUrl: "http://localhost:5000" }));
    const result = await chain.translate("hello", "auto", "it", signal);
    assert.strictEqual(result.result?.text, "ciao");
    assert.strictEqual(result.result?.provider, "LibreTranslate");
  });
});
