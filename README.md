# Hover Translator

Translate code and text **on hover** — right inside VSCode, in any file type. Built to help
non-native English speakers read code faster.

- **Free, no API key, no signup.** Uses keyless public translation services.
- **Coexists with other hovers.** Your translation appears *alongside* the TypeScript type hover
  and any other extension's hover — it never replaces or blocks them.
- **Understands code.** `getUserName` is split into "get user name" before translating.
- **Works on** identifiers, comments, string literals, the current selection, and prose in
  `.md` / `.txt` files.

## Usage

1. Run **Hover Translator: Set Target Language** (or set `translator.targetLanguage`, e.g. `es`).
2. Hover any word, comment, string, or selection. The translation shows in the hover popup.

## How translation works

A keyless provider chain, tried in order until one succeeds:

1. **MyMemory** — translation-memory backed. 5,000 chars/day free; set `translator.email` to raise
   it to 50,000 (no signup).
2. **Lingva** — Google Translate frontend fallback.
3. **LibreTranslate** — used first if you set `translator.libreTranslateUrl` (unlimited / offline).

## Settings

| Setting | Default | Description |
|---|---|---|
| `translator.targetLanguage` | editor language | Language to translate into (ISO 639-1). |
| `translator.sourceLanguage` | `auto` | Source language or `auto`. |
| `translator.email` | — | Raises MyMemory's free daily limit. |
| `translator.libreTranslateUrl` | — | Self-hosted LibreTranslate endpoint. |
| `translator.lingvaInstanceUrl` | `https://lingva.ml` | Lingva fallback instance. |
| `translator.maxSelectionLength` | `1000` | Max chars translated from a selection. |
| `translator.cacheSize` | `500` | In-memory translation cache size. |
| `translator.translateIdentifiers` / `Comments` / `Strings` | `true` | Toggle what gets translated. |

## Develop

```bash
npm install
npm run compile      # or: npm run watch
# press F5 in VSCode to launch the Extension Development Host
npm test             # unit + integration tests
npx @vscode/vsce package
```
