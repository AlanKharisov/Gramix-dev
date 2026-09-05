// Bounded session cache. Account identity is part of every key; no meal data is
// persisted to disk. Invalidated in-flight reads cannot overwrite newer writes.
export class ReadCache {
  constructor({ maxBytes = 6 * 1024 * 1024, ttl = 30000 } = {}) {
    this.maxBytes = maxBytes;
    this.ttl = ttl;
    this.entries = new Map();
    this.pending = new Map();
    this.bytes = 0;
  }
  remove(key) {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.entries.delete(key);
    this.pending.delete(key);
  }
  clear() { this.entries.clear(); this.pending.clear(); this.bytes = 0; }
  put(key, value) {
    this.remove(key);
    const bytes = JSON.stringify(value).length * 2;
    if (bytes > this.maxBytes) return;
    while (this.bytes + bytes > this.maxBytes || this.entries.size >= 200) this.remove(this.entries.keys().next().value);
    this.entries.set(key, { value: structuredClone(value), bytes, at: Date.now() });
    this.bytes += bytes;
  }
  async get(key, loader, force = false) {
    const entry = this.entries.get(key);
    if (!force && entry && Date.now() - entry.at < this.ttl) return structuredClone(entry.value);
    if (this.pending.has(key)) return structuredClone(await this.pending.get(key));
    const promise = Promise.resolve().then(loader);
    this.pending.set(key, promise);
    try {
      const value = await promise;
      if (this.pending.get(key) === promise) this.put(key, value);
      return structuredClone(value);
    } finally { if (this.pending.get(key) === promise) this.pending.delete(key); }
  }
}
