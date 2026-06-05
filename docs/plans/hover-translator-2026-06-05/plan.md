# Plan: VSCode Hover Translator Extension (Free, No API Key)

## Context

Goal: **help non-native English speakers understand code/text** by showing a translation popup
**on hover over any text in any file type** — splitting `camelCase`/`snake_case` identifiers into
readable phrases first. It must be **completely free, with no API key or signup required**, while
still being professional-quality.

The hard requirement: the popup must **coexist** with other hovers (TypeScript declarations, other
extensions) — never replace or block them.

**Key architectural insight (makes the coexistence requirement trivial):** VSCode invokes *every*
registered `HoverProvider` for a position and **merges all non-null results into one popup**, each
as its own section. So we register a normal `HoverProvider`, return a `Hover` only when we have a
translation, and `undefined` otherwise — TS's type hover and other extensions show side-by-side,
never blocked. Never throw (catch → return `undefined`).

### Free, no-key translation strategy (provider chain)
No paid API, no key, no signup. Try providers in order, fall through on failure/limit:
1. **MyMemory** (primary) — `GET https://api.mymemory.translated.net/get?q=<text>&langpair=<src>|<tgt>`.
   No key, CORS-friendly, translation-memory + MT (professional quality). Free anonymous limit
   **5,000 chars/day per IP**; raised to **50,000** by adding optional `&de=<email>` — exposed as an
   optional setting (still no signup). Response: `responseData.translatedText` (+ `responseStatus`).
2. **Lingva Translate** (fallback) — `GET https://lingva.ml/api/v1/<src>/<tgt>/<text>` (Google
   Translate frontend, no key). Used when MyMemory errors or daily limit hit. Instance URL is a setting.
3. **Self-hosted LibreTranslate** (optional power-user) — if `translator.libreTranslateUrl` is set,
   `POST {url}/translate` `{q, source, target, format:'text'}`. Enables unlimited/offline use.

Source language defaults to **auto** (English source detected automatically); target is the user's
native language via `translator.targetLanguage`.

This is a greenfield project — `/Users/mohamadtaleb/code/vscode-extensions` is empty.

## Scaffolding

`npx --package yo --package generator-code -- yo code` → "New Extension (TypeScript)", esbuild.
**No runtime deps** — use Node global `fetch` (VSCode ≥1.85). Structure:

```
package.json            engines.vscode ^1.85.0, main ./dist/extension.js,
                        activationEvents ["onStartupFinished"], contributes.{configuration,commands}
tsconfig.json           strict, ES2021, outDir dist
esbuild.js              bundle src -> dist/extension.js
.vscode/launch.json     F5 Extension Development Host
src/extension.ts        activate(): register hover provider + commands
src/hover/translationHoverProvider.ts   provideHover()
src/hover/textExtractor.ts               extract {text, range, kind} at a Position
src/text/identifierSplitter.ts           pure: getUserName -> "get user name"
src/translate/provider.ts                provider chain (MyMemory -> Lingva -> LibreTranslate)
src/translate/myMemory.ts | lingva.ts | libre.ts   individual clients
src/cache/lruCache.ts                    generic Map-based LRU
src/config/settings.ts                   read config helpers
test/suite/*.test.ts                     unit tests for pure modules + clients (mocked fetch)
```

### `contributes.configuration` (NO apiKey)
- `translator.targetLanguage` — enum of language codes (`es, fr, de, ar, zh, ja, hi, pt, ...`), default from `vscode.env.language`.
- `translator.sourceLanguage` — default `"auto"`.
- `translator.email` — optional, raises MyMemory limit to 50k chars/day (no signup).
- `translator.libreTranslateUrl` — optional self-hosted endpoint (unlimited/offline).
- `translator.lingvaInstanceUrl` — default `https://lingva.ml`.
- `translator.maxSelectionLength` (1000), `translator.cacheSize` (500).
- `translator.translateIdentifiers` / `translateComments` / `translateStrings` — booleans, default true.

### `contributes.commands`
- `translator.setTargetLanguage` (quick-pick), `translator.clearCache`.

## Implementation

### 1. HoverProvider — `src/hover/translationHoverProvider.ts`
Register `vscode.languages.registerHoverProvider({ scheme:'file', language:'*' }, provider)` (plus
`untitled`); push disposable to `context.subscriptions`. `provideHover(document, position, token)`:
1. `extractAt(document, position, activeSelection)` → `{text, range, kind} | undefined`; whitespace-only → `undefined`.
2. `token.isCancellationRequested` → `undefined`.
3. Cache lookup `${targetLang}:${text}`; hit → Hover.
4. Miss → ~250ms debounce (abort if token cancels), in-flight de-dupe, then `provider.translate(text, src, tgt, token)` (AbortController wired to token).
5. If translated == source (already target language) → `undefined` (no useless popup).
6. Return `new vscode.Hover(MarkdownString, range)` scoped to range, header `**Translation (auto → ES)**`, plus the split phrase for identifiers.

### 2. Text extraction — `src/hover/textExtractor.ts`
Precedence (first match wins): **selection** covering position (capped at `maxSelectionLength`) →
**comment** (per-language markers `//`, `#`, `--`, `/* */`, `<!-- -->`, `;` via `document.lineAt`) →
**string literal** (scan `'` `"` `` ` `` pairs around `position.character`) → **identifier**
(`document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/)` → `identifierSplitter`) →
**prose** (`markdown`/`plaintext`: current sentence / whitespace-delimited range). None → `undefined`.

### 3. Identifier splitter — `src/text/identifierSplitter.ts`
Pure, no VSCode dep. Split on `_`/`-`, then camelCase via `/([a-z0-9])([A-Z])/g` and acronyms
`/([A-Z]+)([A-Z][a-z])/g`. Lowercase, collapse spaces. `getUserName→"get user name"`,
`HTMLParser→"HTML Parser"`, `user_id→"user id"`. Skip very short single tokens (`i`, `id`).

### 4. Provider chain — `src/translate/provider.ts`
`translate(text, src, tgt, token)` tries MyMemory → Lingva → LibreTranslate(if configured),
returning the first success. Each client uses `fetch` + `AbortController` (token + ~8s timeout).
- MyMemory: parse `responseData.translatedText`; treat `responseStatus===403/429` or quota message as limit-hit → fall through. Append `&de=email` if set.
- Lingva: parse `{translation}`; on non-200 fall through.
- LibreTranslate: only if URL set; parse `{translatedText}`.
- All providers fail → return `undefined` (no popup); log to OutputChannel "Translator"; if the cause is daily-limit, show a one-time hint (set email or self-host URL), tracked in `globalState`.

### 5. Cache / cancellation / throttle
- `src/cache/lruCache.ts`: Map-based LRU, key `${tgt}:${text}`, size `cacheSize`. Cleared on `clearCache` and on `targetLanguage`/`sourceLanguage` config change.
- Cancellation: check token + wire to `AbortController.abort()` (primary spam guard as cursor moves).
- Throttle: 250ms debounce on miss + in-flight de-dupe `Map<key,Promise>` (stretches the free daily limit far, since identifiers are short and repeats are cached).

### Edge cases
Network fail (silent, no cache); empty/punctuation word (skip); long selection (cap/truncate);
**daily limit reached** (fall to next provider, then one-time hint to add email or self-host);
source==target (skip popup); short identifier (skip); selection from different editor (guarded);
provider instance down (fall through chain).

## Verification
1. `npm run compile`; open folder in VSCode, press **F5** → Extension Development Host.
2. Set `translator.targetLanguage` (e.g. `es`). No key needed — translations work immediately.
3. Hover `getUserName` in a `.ts` file → translation popup appears **alongside** TS's type hover (confirm both sections show).
4. Hover a comment, a string literal, select a phrase + hover, hover prose in `.md`/`.txt`.
5. Offline / provider down → no popup, no crash (chain falls through; OutputChannel logs).
6. Optionally set `translator.email` (higher MyMemory limit) and `translator.libreTranslateUrl` (offline) and re-verify.
7. Unit tests (`npm test`): `identifierSplitter`, `lruCache`, each translate client (mocked fetch).
8. Package: `npx @vscode/vsce package` → install the `.vsix` locally.

## Status

Track per-phase progress in [STATUS.md](STATUS.md) as phases ship.
