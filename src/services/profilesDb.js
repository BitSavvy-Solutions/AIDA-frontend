/**
 * Local registry of vault profiles. The DEK is NEVER stored here.
 */
const DB_NAME = 'AidaVaultDB';
const STORE = 'profiles';

const openDB = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE)) {
            database.createObjectStore(STORE, { keyPath: 'id' });
        }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});

const tx = async (mode, fn) => {
    const database = await openDB();
    return new Promise((resolve, reject) => {
        const t = database.transaction(STORE, mode);
        const result = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(result?.result ?? undefined);
        t.onerror = () => reject(t.error);
    });
};

export const profilesDb = {
    put:    (record) => tx('readwrite', (s) => s.put(record)),
    get:    async (id) => {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const req = database.transaction(STORE, 'readonly').objectStore(STORE).get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    },
    getAll: async () => {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const req = database.transaction(STORE, 'readonly').objectStore(STORE).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    },
    remove: (id) => tx('readwrite', (s) => s.delete(id)),
};