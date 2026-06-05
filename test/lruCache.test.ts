import * as assert from "assert";
import { LruCache } from "../src/cache/lruCache";

suite("LruCache", () => {
  test("stores and retrieves values", () => {
    const cache = new LruCache<string>(2);
    cache.set("a", "1");
    assert.strictEqual(cache.get("a"), "1");
  });

  test("evicts the least-recently-used entry", () => {
    const cache = new LruCache<string>(2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3"); // evicts "a"
    assert.strictEqual(cache.get("a"), undefined);
    assert.strictEqual(cache.get("b"), "2");
    assert.strictEqual(cache.get("c"), "3");
  });

  test("get refreshes recency", () => {
    const cache = new LruCache<string>(2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.get("a"); // "a" now most-recently-used
    cache.set("c", "3"); // evicts "b"
    assert.strictEqual(cache.get("a"), "1");
    assert.strictEqual(cache.get("b"), undefined);
  });

  test("resize evicts overflow", () => {
    const cache = new LruCache<string>(3);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    cache.resize(1);
    assert.strictEqual(cache.size, 1);
    assert.strictEqual(cache.get("c"), "3");
  });

  test("clear empties the cache", () => {
    const cache = new LruCache<string>(2);
    cache.set("a", "1");
    cache.clear();
    assert.strictEqual(cache.size, 0);
  });
});
