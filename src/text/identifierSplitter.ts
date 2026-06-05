/**
 * Splits programmer identifiers into a space-separated, lowercased phrase suitable
 * for machine translation. Pure module — no `vscode` dependency.
 *
 *   getUserName  -> "get user name"
 *   HTMLParser   -> "HTML Parser"  (acronym runs preserved, then lowercased)
 *   user_id      -> "user id"
 *   fetch-data   -> "fetch data"
 */

/** Minimum length for a single-token identifier to be considered worth translating. */
const MIN_TOKEN_LENGTH = 3;

/**
 * Returns the human-readable phrase for an identifier, or `undefined` when the
 * identifier is too trivial to translate (e.g. `i`, `id`, `x`).
 */
export function splitIdentifier(raw: string): string | undefined {
  const input = raw.trim();
  if (input.length === 0) {
    return undefined;
  }

  // Already a phrase — leave it for the caller to translate as-is.
  if (/\s/.test(input)) {
    return input;
  }

  // Split on common delimiters first (snake_case, kebab-case, dotted, slashed).
  const chunks = input.split(/[_\-./\\]+/).filter(Boolean);

  const words: string[] = [];
  for (const chunk of chunks) {
    words.push(...splitCamelCase(chunk));
  }

  const phrase = words
    .map((w) => w.toLowerCase())
    .filter(Boolean)
    .join(" ")
    .trim();

  if (phrase.length === 0) {
    return undefined;
  }

  // A single short token (e.g. "id") carries little meaning — skip it.
  if (words.length === 1 && phrase.length < MIN_TOKEN_LENGTH) {
    return undefined;
  }

  return phrase;
}

/**
 * Splits a single camelCase / PascalCase chunk into words, preserving acronym runs.
 *   "getHTTPResponse" -> ["get", "HTTP", "Response"]
 *   "IOError"         -> ["IO", "Error"]
 */
function splitCamelCase(chunk: string): string[] {
  return chunk
    // lower/digit -> Upper boundary: "getUser" -> "get User"
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    // acronym run -> Word boundary: "HTTPResponse" -> "HTTP Response"
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    // letter -> digit boundary: "user2" -> "user 2"
    .replace(/([A-Za-z])([0-9])/g, "$1 $2")
    // digit -> letter boundary: "2name" -> "2 name"
    .replace(/([0-9])([A-Za-z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);
}
