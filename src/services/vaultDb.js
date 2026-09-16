/**
 * Local storage for the single encrypted-sync vault record.
 * The DEK is NEVER stored here.
 */
const DB_NAME = 'AidaVaultDB';
const STORE = 'vault';
const RECORD_ID = 'vault';

const openDB = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE)) {
            database.createObjectStore(STORE, { keyPath: 'id' });
        }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});

export const vaultDb = {
    get: async () => {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const req = database.transaction(STORE, 'readonly').objectStore(STORE).get(RECORD_ID);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    },
    put: async (record) => {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({ ...record, id: RECORD_ID });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },
    remove: async () => {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(RECORD_ID);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },
};