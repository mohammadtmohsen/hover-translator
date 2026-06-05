# Hover Translator — VSCode Extension

## What this project is

A VSCode extension that **helps non-native English speakers understand code and text** by showing a
translation popup **on hover over any text, in any file type**. Hovering an identifier, comment,
string literal, selection, or prose shows its translation in the user's chosen language.

It is **completely free — no API key, no signup**.

## Core principles (do not break these)

1. **Coexist, never block.** The extension registers a normal `HoverProvider`. VSCode invokes every
   registered provider for a position and **merges all non-null results into one popup**. We return
   a `Hover` only when we have a translation, and `undefined` otherwise — so the TypeScript type
   hover and other extensions always show alongside ours. **Never throw** from `provideHover`
   (catch → return `undefined`).
2. **Free, keyless translation.** Provider chain, tried in order, falling through on failure/limit:
   - **Google** (primary) — `GET https://translate.googleapis.com/translate_a/single?client=gtx&sl=<src>&tl=<tgt>&dt=t&q=<text>`.
     Keyless, fast (~0.5s), high quality, effectively unlimited for this low volume. Nested-array response.
   - **MyMemory** (fallback) — `GET https://api.mymemory.translated.net/get?q=<text>&langpair=<src>|<tgt>`.
     5,000 chars/day anonymous; optional `&de=<email>` setting raises it to 50,000.
   - **Lingva** (fallback) — `GET <instance>/api/v1/<src>/<tgt>/<text>` (Google Translate frontend).
   - **LibreTranslate** (optional, self-hosted) — `POST <url>/translate`; tried **first** when `libreTranslateUrl` is set.
3. **Respect the free limit.** LRU cache + in-flight de-dupe + 250ms debounce + honoring the
   `CancellationToken` keep API calls minimal as the cursor moves.
4. **camelCase handling.** Identifiers are split (`getUserName` → "get user name") before translating.

## Architecture

| File | Responsibility |
|---|---|
| `src/extension.ts` | `activate()`: register hover provider + commands, wire config-change listeners |
| `src/hover/translationHoverProvider.ts` | `provideHover()` — orchestrates extract → cache → translate → render |
| `src/hover/textExtractor.ts` | Extract `{text, range, kind}` at a position (selection > comment > string > identifier > prose) |
| `src/text/identifierSplitter.ts` | Pure: split camelCase/snake_case/PascalCase into a phrase |
| `src/translate/provider.ts` | Provider chain ([Libre] → Google → MyMemory → Lingva) |
| `src/translate/google.ts`, `myMemory.ts`, `lingva.ts`, `libre.ts` | Individual keyless clients (Node global `fetch`) |
| `src/cache/lruCache.ts` | Generic Map-based LRU |
| `src/config/settings.ts` | Typed config readers |

## Conventions

- **TypeScript strict**; no `any`, no `@ts-expect-error`.
- **No runtime dependencies** — use Node's global `fetch` (VSCode ≥ 1.85). Bundled with esbuild.
- Pure modules (`identifierSplitter`, `lruCache`) have **no `vscode` import** and are unit-tested with mocked `fetch`.
- All log output goes to the `Translator` `OutputChannel`, never `console.log`.

## Build & run

- `npm run compile` (or `watch`) — esbuild bundle to `dist/extension.js`.
- **F5** in VSCode → Extension Development Host; set `translator.targetLanguage`, then hover text.
- `npm test` — unit + integration tests via `@vscode/test-electron`.
- `npx @vscode/vsce package` — produce a `.vsix`.

## Plan

The full implementation plan lives at
[docs/plans/hover-translator-2026-06-05/plan.md](docs/plans/hover-translator-2026-06-05/plan.md).
