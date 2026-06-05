import * as vscode from "vscode";
import { splitIdentifier } from "../text/identifierSplitter";
import { TranslatorSettings } from "../config/settings";

export type ExtractKind = "selection" | "comment" | "string" | "identifier" | "prose";

export interface Extraction {
  /** Text sent to the translator (for identifiers, the split phrase). */
  sourceText: string;
  /** Original text under the cursor, shown for context (may equal sourceText). */
  original: string;
  /** Range the hover should be scoped to. */
  range: vscode.Range;
  kind: ExtractKind;
}

const IDENTIFIER_RE = /[A-Za-z_$][A-Za-z0-9_$]*/;
const PROSE_LANGUAGES = new Set(["markdown", "plaintext", "asciidoc", "restructuredtext"]);

/**
 * Determines what text under the cursor should be translated, in priority order:
 * selection → comment → string literal → identifier → prose.
 * Returns `undefined` when there is nothing worth translating.
 */
export function extractAt(
  document: vscode.TextDocument,
  position: vscode.Position,
  settings: TranslatorSettings,
  selection?: vscode.Selection
): Extraction | undefined {
  // 1. Active selection that covers the hovered position (same document).
  if (selection && !selection.isEmpty && selection.contains(position)) {
    let text = document.getText(selection);
    if (text.length > settings.maxSelectionLength) {
      text = text.slice(0, settings.maxSelectionLength);
    }
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      return { sourceText: trimmed, original: trimmed, range: selection, kind: "selection" };
    }
  }

  const line = document.lineAt(position.line);
  const lineText = line.text;

  // 2. Comment on this line.
  if (settings.translateComments) {
    const comment = findComment(lineText, position.character, document.languageId);
    if (comment) {
      const range = new vscode.Range(
        position.line,
        comment.start,
        position.line,
        comment.end
      );
      return { sourceText: comment.text, original: comment.text, range, kind: "comment" };
    }
  }

  // 3. String literal containing the cursor.
  if (settings.translateStrings) {
    const str = findString(lineText, position.character);
    if (str) {
      const range = new vscode.Range(position.line, str.start, position.line, str.end);
      return { sourceText: str.text, original: str.text, range, kind: "string" };
    }
  }

  // 4. Identifier under the cursor.
  if (settings.translateIdentifiers) {
    const wordRange = document.getWordRangeAtPosition(position, IDENTIFIER_RE);
    if (wordRange) {
      const word = document.getText(wordRange);
      const phrase = splitIdentifier(word);
      if (phrase) {
        return { sourceText: phrase, original: word, range: wordRange, kind: "identifier" };
      }
    }
  }

  // 5. Prose word/phrase in plain-text documents.
  if (PROSE_LANGUAGES.has(document.languageId)) {
    const wordRange = document.getWordRangeAtPosition(position, /[^\s]+/);
    if (wordRange) {
      const word = document.getText(wordRange).trim();
      if (word.length > 1 && /[A-Za-zÀ-ɏ]/.test(word)) {
        return { sourceText: word, original: word, range: wordRange, kind: "prose" };
      }
    }
  }

  return undefined;
}

interface Span {
  text: string;
  start: number;
  end: number;
}

/** Per-language single-line comment prefixes. */
function lineCommentTokens(languageId: string): string[] {
  switch (languageId) {
    case "python":
    case "shellscript":
    case "ruby":
    case "yaml":
    case "dockerfile":
    case "perl":
    case "r":
    case "toml":
      return ["#"];
    case "sql":
    case "lua":
    case "haskell":
      return ["--"];
    case "clojure":
    case "lisp":
    case "scheme":
      return [";"];
    default:
      return ["//", "#"];
  }
}

/**
 * Detects a comment that contains `col`. Handles single-line tokens (`//`, `#`, `--`, `;`),
 * inline/block C-style comments, and HTML `<!-- -->` on the same line. Heuristic, not a full parser.
 */
function findComment(lineText: string, col: number, languageId: string): Span | undefined {
  // Block: /* ... */  (possibly unterminated on this line)
  const block = matchDelimited(lineText, col, "/*", "*/");
  if (block) {
    return block;
  }
  // HTML/XML/Markdown: <!-- ... -->
  const html = matchDelimited(lineText, col, "<!--", "-->");
  if (html) {
    return html;
  }

  // Line comments.
  for (const token of lineCommentTokens(languageId)) {
    const idx = lineText.indexOf(token);
    if (idx >= 0 && col >= idx) {
      const text = lineText.slice(idx + token.length).trim();
      if (text.length > 0) {
        return { text, start: idx + token.length, end: lineText.length };
      }
    }
  }
  return undefined;
}

/** Finds an open/close delimited region (e.g. block comment) containing `col`. */
function matchDelimited(
  lineText: string,
  col: number,
  open: string,
  close: string
): Span | undefined {
  const openIdx = lineText.indexOf(open);
  if (openIdx < 0 || col < openIdx) {
    return undefined;
  }
  const contentStart = openIdx + open.length;
  const closeIdx = lineText.indexOf(close, contentStart);
  const contentEnd = closeIdx >= 0 ? closeIdx : lineText.length;
  if (col > contentEnd + close.length) {
    return undefined;
  }
  const text = lineText.slice(contentStart, contentEnd).trim();
  if (text.length === 0) {
    return undefined;
  }
  return { text, start: contentStart, end: contentEnd };
}

/** Finds a quoted string literal (`'`, `"`, or backtick) containing `col`. */
function findString(lineText: string, col: number): Span | undefined {
  for (const quote of ['"', "'", "`"]) {
    let searchFrom = 0;
    let open = lineText.indexOf(quote, searchFrom);
    while (open >= 0) {
      const close = lineText.indexOf(quote, open + 1);
      if (close < 0) {
        break;
      }
      if (col > open && col <= close) {
        const text = lineText.slice(open + 1, close).trim();
        if (text.length > 0 && /[A-Za-zÀ-ɏ]/.test(text)) {
          return { text, start: open + 1, end: close };
        }
      }
      searchFrom = close + 1;
      open = lineText.indexOf(quote, searchFrom);
    }
  }
  return undefined;
}
