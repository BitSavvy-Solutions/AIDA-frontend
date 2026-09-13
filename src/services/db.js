const DB_NAME = 'AidaWidgetDB';

const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const getAll = async (storeName) => {
    const database = await openDB();
    return new Promise((resolve, reject) => {
        if (!database.objectStoreNames.contains(storeName)) return resolve([]);
        const tx = database.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
};

const bulkPut = async (storeName, items) => {
    if (!items || items.length === 0) return;
    const database = await openDB();
    return new Promise((resolve, reject) => {
        if (!database.objectStoreNames.contains(storeName)) {
            return reject(new Error(`Store ${storeName} does not exist yet.`));
        }
        const tx = database.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        items.forEach(item => store.put(item));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

const bulkDelete = async (storeName, ids) => {
    if (!ids || ids.length === 0) return;
    const database = await openDB();
    return new Promise((resolve, reject) => {
        if (!database.objectStoreNames.contains(storeName)) return resolve();
        const tx = database.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        ids.forEach(id => store.delete(id));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

const getChatsMeta = async () => {
    const database = await openDB();
    if (!database.objectStoreNames.contains('chats')) return { count: 0, msgs: 0, maxTs: 0 };
    return new Promise((resolve, reject) => {
        const tx = database.transaction('chats', 'readonly');
        const req = tx.objectStore('chats').openCursor();
        let count = 0, msgs = 0, maxTs = 0;
        const tsNum = (v) => { const t = new Date(v || 0).getTime(); return Number.isFinite(t) ? t : 0; };
        req.onsuccess = () => {
            const cur = req.result;
            if (!cur) return resolve({ count, msgs, maxTs });
            const c = cur.value || {};
            count += 1;
            msgs += (c.messages?.length || 0);
            maxTs = Math.max(maxTs, tsNum(c.updatedAt), tsNum(c.createdAt));
            cur.continue();
        };
        req.onerror = () => reject(req.error);
    });
};

export const db = {
    chats: {
        toArray:    () => getAll('chats'),
        bulkPut:    (items) => bulkPut('chats', items),
        bulkDelete: (ids) => bulkDelete('chats', ids),
        getMeta:    () => getChatsMeta(),
    },
    projects: {
        toArray:    () => getAll('projects'),
        bulkPut:    (items) => bulkPut('projects', items),
        bulkDelete: (ids) => bulkDelete('projects', ids),
    },
};