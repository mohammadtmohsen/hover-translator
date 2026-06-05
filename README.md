<div align="center">

<img src="media/icon.png" width="96" alt="Hover Translator icon" />

# Hover Translator

**Understand code and chat in your own language — translate on hover, free, no API key.**

[![CI](https://github.com/mohammadtmohsen/hover-translator/actions/workflows/ci.yml/badge.svg)](https://github.com/mohammadtmohsen/hover-translator/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/mohammadtmohsen/hover-translator)](https://github.com/mohammadtmohsen/hover-translator/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

Built to help **non-native English speakers** read code faster. Hover over any text to see its
translation — right inside the editor, in any file type — and translate text you copy from AI chat
panels (Claude, Codex, Copilot). **No API key, no signup.**

## Features

- **Translate on hover** — identifiers, comments, string literals, the current selection, and prose
  in Markdown/plain-text. The translation appears **alongside** the normal hover (e.g. the TypeScript
  type popup) — it never replaces or blocks it.
- **Understands code** — `getUserName` is split into *"get user name"* before translating
  (`HTMLParser` → *"HTML Parser"*, `user_id` → *"user id"*).
- **Translate chat conversations** — chat panels are sandboxed webviews that can't be hovered, so
  instead: **select text → copy (⌘C/Ctrl+C) → a translation popup appears.** Your clipboard is only
  **read, never overwritten**, so the copied text stays intact. Popup auto-dismisses (expand it to keep it).
- **Free & keyless** — a fallback chain of public translators, no account required.

## Install

From the [latest release](https://github.com/mohammadtmohsen/hover-translator/releases/latest):

1. Download `hover-translator-<version>.vsix`.
2. In VS Code: **Extensions** panel → `⋯` menu → **Install from VSIX…** → pick the file.
   _Or_ from a terminal: `code --install-extension hover-translator-<version>.vsix`
3. Reload the window.

## Usage

1. Set your language: Command Palette (`⇧⌘P`) → **Hover Translator: Set Target Language**
   (or set `translator.targetLanguage` in settings, e.g. `ar`, `es`, `fr`).
2. **In code / Markdown:** hover any word, comment, string, or selection.
3. **In chat panels:** select text and copy it — the translation pops up automatically.
4. Toggle copy-to-translate anytime from the **`🌐 Translate` status-bar button** (handy while
   copying code you don't want translated).

## How translation works

A keyless provider chain, tried in order until one succeeds — so it keeps working even if one service is down:

| Order | Provider | Notes |
|------:|----------|-------|
| 1 | **Google** (`translate_a`) | Keyless, fast, high quality. Primary. |
| 2 | **MyMemory** | Translation-memory backed. 5k chars/day free; set `translator.email` for 50k. |
| 3 | **Lingva** | Google Translate front-end fallback. |
| ⭐ | **LibreTranslate** | If you set `translator.libreTranslateUrl`, it's tried **first** (unlimited / offline, self-hosted). |

## Settings

| Setting | Default | Description |
|---|---|---|
| `translator.targetLanguage` | editor language | Language to translate into (ISO 639-1, e.g. `ar`, `es`). |
| `translator.sourceLanguage` | `auto` | Source language, or `auto` to detect. |
| `translator.autoTranslateClipboard` | `true` | Auto-translate copied text (for chat panels). Read-only on the clipboard. |
| `translator.email` | — | Raises MyMemory's free daily limit to 50k chars. |
| `translator.libreTranslateUrl` | — | Self-hosted LibreTranslate endpoint (unlimited / offline). |
| `translator.lingvaInstanceUrl` | `https://lingva.ml` | Lingva fallback instance. |
| `translator.maxSelectionLength` | `1000` | Max characters translated from a selection. |
| `translator.cacheSize` | `500` | In-memory translation cache size. |
| `translator.translateIdentifiers` / `translateComments` / `translateStrings` | `true` | Toggle what gets translated on hover. |

## Privacy

- Text you hover or copy is sent to the configured translation provider to be translated — same as
  any online translator. Use a **self-hosted LibreTranslate** (`translator.libreTranslateUrl`) to keep
  everything local/offline.
- The clipboard is **only read, never written**.

## Development

```bash
npm install
npm run compile        # or: npm run watch
# press F5 in VS Code to launch the Extension Development Host
npm test               # unit + integration tests (27)
npx @vscode/vsce package
```

Pushing a `v*` tag triggers the [release workflow](.github/workflows/release.yml): it builds, tests,
packages the `.vsix`, and attaches it to a GitHub Release (and publishes to the Marketplace / Open VSX
if `VSCE_PAT` / `OVSX_PAT` secrets are set).

See [docs/RELEASING.md](docs/RELEASING.md) for how to cut a release and publish to a public registry.

## License

[MIT](LICENSE) © Mohammad Taleb
