/**
 * Recent Node versions expose their own `localStorage` global, which is
 * undefined unless Node is started with --localstorage-file and shadows the
 * jsdom one. Give every test a working in-memory Storage instead.
 */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  let works = false;
  try { works = typeof globalThis[name]?.getItem === 'function'; } catch { /* access can throw */ }
  if (!works) Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true, writable: true });
}
