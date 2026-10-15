// The page's localStorage, or a store in memory where there is none to have.
//
// A sandboxed document without allow-same-origin -- a documentation example in
// an iframe -- throws on the mere read of window.localStorage, and the Loader,
// which reads it to cache its plugin lists, stopped there: nothing it found was
// ever fetched (DEV, 2026-10-15). In memory the caches live as long as the
// page, which is all such a page can keep anyway.
const memory = new Map();
const memoryStorage = {
    get length() {
        return memory.size;
    },
    key: (index) => [...memory.keys()][index] ?? null,
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => {
        memory.set(String(key), String(value));
    },
    removeItem: (key) => {
        memory.delete(String(key));
    },
    clear: () => memory.clear(),
};

export default function pageStorage() {
    try {
        const storage = globalThis.localStorage;
        if (storage) return storage;
    } catch {
        // Sandboxed: fall through to memory.
    }
    return memoryStorage;
}
