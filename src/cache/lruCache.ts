/**
 * Minimal LRU cache backed by a Map (which preserves insertion order).
 * Pure module — no `vscode` dependency.
 */
export class LruCache<V> {
  private readonly store = new Map<string, V>();

  constructor(private capacity: number) {
    this.capacity = Math.max(1, Math.floor(capacity));
  }

  get(key: string): V | undefined {
    const value = this.store.get(key);
    if (value === undefined) {
      return undefined;
    }
    // Mark as most-recently-used by re-inserting.
    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  set(key: string, value: V): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.capacity) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }
    this.store.set(key, value);
  }

  clear(): void {
    this.store.clear();
  }

  /** Resize the cache, evicting oldest entries if the new capacity is smaller. */
  resize(capacity: number): void {
    this.capacity = Math.max(1, Math.floor(capacity));
    while (this.store.size > this.capacity) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.store.delete(oldest);
    }
  }

  get size(): number {
    return this.store.size;
  }
}
