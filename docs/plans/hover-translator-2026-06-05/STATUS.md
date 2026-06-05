# Status — Hover Translator

## Phase 1 done: Full v0.1.0 implementation

Built the complete extension per plan:

- **Scaffolding**: package.json (contributes.configuration + commands, `onStartupFinished`),
  tsconfig (strict), esbuild bundler, `.vscode/launch.json` + tasks, eslint, `.vscode-test.mjs`.
- **Pure modules**: `identifierSplitter` (camelCase/snake/Pascal/acronym/digit splitting),
  `lruCache`, `settings` reader.
- **Provider chain** (keyless): `myMemory` (primary) → `lingva` (fallback) →
  `libre` (preferred when self-host URL configured). `provider.ts` orchestrates with limit-aware fallthrough.
- **Hover**: `textExtractor` (selection → comment → string → identifier → prose precedence) and
  `translationHoverProvider` (cache + 250ms cancellable debounce + in-flight de-dupe + AbortController
  timeout + one-time limit hint). Returns a `Hover` only when there's a translation → merges with,
  never blocks, other hovers. Catches all errors.
- **extension.ts**: registers hover provider for all file schemes/languages, config-change refresh,
  `setTargetLanguage` quick-pick and `clearCache` commands.

### Verification
- `npm run lint` ✓ · `tsc --noEmit` ✓ · `npm run compile` (esbuild bundle) ✓
- `npm test` → **20 passing** (identifierSplitter, lruCache, provider clients + chain).
- Live MyMemory check: `get user name` → `obtener nombre de usuario` (status 200) — response shape matches the parser.

### Not yet done
- Manual F5 verification in the Extension Development Host (hover alongside TS type hover, comments,
  strings, selections, `.md`/`.txt`) — pending user.
- `vsce package` to produce a `.vsix`.

## Phase 2 done: provider + tooling fixes from live testing

- **Google primary provider** ([src/translate/google.ts](../../../src/translate/google.ts)): live test
  showed MyMemory rate-limiting a burst of hovers and the MyMemory→Lingva fall-through was slow.
  Added keyless Google `translate_a` as the primary; chain is now `[Libre] → Google → MyMemory → Lingva`.
  Real latency ~0.5s, instant on cache hit. Debounce lowered 250ms → 180ms.
- **TS 6.0 compatibility**: added `"types": ["node","mocha","vscode"]` to tsconfig — TS 6.0 no longer
  auto-includes `@types`. Compiles clean on both 5.9.3 and 6.0.3.
- **ESLint env**: added `env: { node, es2021 }` + `.js`/test overrides so `esbuild.js` (`require`) and
  mocha globals lint clean.
- **Tests**: 27 passing (added Google parser/segment/429/chain-order tests).
- Demo workspace at `/tmp/translator-demo` (sample.ts, notes.md, preset `targetLanguage: es`).

## Phase 3 done: clipboard translation for chat panels + packaging

- **Clipboard translation** ([src/clipboard/clipboardTranslator.ts](../../../src/clipboard/clipboardTranslator.ts)):
  chat panels (Claude/Codex/Copilot) are sandboxed webviews — no API to read their selection/hover.
  The only cross-sandbox channel is the clipboard, so copied text is auto-translated. Clipboard is
  **read-only, never written**. Status-bar toggle `🌐 Translate: <LANG>`; settings `autoTranslateClipboard`.
- **Auto-dismiss popup**: plain `showInformationMessage` → native behavior (toast fades on its own,
  but stays if the user expands/hovers it). Replaced an earlier `withProgress` timed approach.
- **Verified live**: copy → Arabic popup (`Please review my pull request…` → `يرجى مراجعة…`), clipboard intact.
- **Cleanup**: removed all temporary `dlog` file logging (`src/debug.ts` deleted); kept `Translator`
  Output-channel logging.
- **Packaged + installed**: `publisher` set to `mohammad-taleb`, added `LICENSE`. Produced
  `hover-translator-0.1.0.vsix` and installed into the user's VSCode via `code --install-extension`.
- Gates: `tsc` (5.9.3 + 6.0.3) clean, `eslint` clean, **27 tests passing**.
