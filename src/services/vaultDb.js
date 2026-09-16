/**
 * Local storage for the single encrypted-sync vault record.
 * The DEK is NEVER stored here in the clear.
 *
 * The deviceKeys store holds a non-extractable AES-GCM CryptoKey unique to
 * this browser profile. It wraps the DEK so the vault can unlock silently on
 * this device without ever storing the password.
 */
const DB_NAME = 'AidaVaultDB';
const STORE = 'vault';
const KEYS_STORE = 'deviceKeys';
const RECORD_ID = 'vault';
const DEVICE_KEY_ID = 'device-wrap-key';

const openDB = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 3);
    req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE)) {
            database.createObjectStore(STORE, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(KEYS_STORE)) {
            database.createObjectStore(KEYS_STORE);
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

export const deviceKeyStore = {
    get: async () => {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const req = database.transaction(KEYS_STORE, 'readonly').objectStore(KEYS_STORE).get(DEVICE_KEY_ID);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    },
    getOrCreate: async () => {
        const existing = await deviceKeyStore.get();
        if (existing) return existing;
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            false, // non-extractable: raw key bytes can never leave the browser
            ['wrapKey', 'unwrapKey']
        );
        const database = await openDB();
        await new Promise((resolve, reject) => {
            const tx = database.transaction(KEYS_STORE, 'readwrite');
            // IndexedDB stores CryptoKey objects via structured clone.
            tx.objectStore(KEYS_STORE).put(key, DEVICE_KEY_ID);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        return key;
    },
    remove: async () => {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(KEYS_STORE, 'readwrite');
            tx.objectStore(KEYS_STORE).delete(DEVICE_KEY_ID);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },
};