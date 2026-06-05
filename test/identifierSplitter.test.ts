import * as assert from "assert";
import { splitIdentifier } from "../src/text/identifierSplitter";

suite("identifierSplitter", () => {
  test("splits camelCase", () => {
    assert.strictEqual(splitIdentifier("getUserName"), "get user name");
  });

  test("splits PascalCase", () => {
    assert.strictEqual(splitIdentifier("UserProfile"), "user profile");
  });

  test("splits snake_case", () => {
    assert.strictEqual(splitIdentifier("user_id_value"), "user id value");
  });

  test("splits kebab-case", () => {
    assert.strictEqual(splitIdentifier("fetch-data-now"), "fetch data now");
  });

  test("preserves acronym runs", () => {
    assert.strictEqual(splitIdentifier("HTMLParser"), "html parser");
    assert.strictEqual(splitIdentifier("getHTTPResponse"), "get http response");
    assert.strictEqual(splitIdentifier("IOError"), "io error");
  });

  test("splits letter/number boundaries", () => {
    assert.strictEqual(splitIdentifier("user2name"), "user 2 name");
  });

  test("returns existing phrases unchanged", () => {
    assert.strictEqual(splitIdentifier("already a phrase"), "already a phrase");
  });

  test("skips trivial short tokens", () => {
    assert.strictEqual(splitIdentifier("i"), undefined);
    assert.strictEqual(splitIdentifier("id"), undefined);
  });

  test("handles empty / non-alpha input", () => {
    assert.strictEqual(splitIdentifier(""), undefined);
    assert.strictEqual(splitIdentifier("___"), undefined);
  });
});
