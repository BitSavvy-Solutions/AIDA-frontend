// src/services/pkbSync.js
import Dexie from 'dexie';
import config from '../config/apiConfig';

// ═══════════════════════════════════════════════════════════════════════════════
// Local PKB database
// ═══════════════════════════════════════════════════════════════════════════════

export const db = new Dexie('pkb-local');

db.version(1).stores({
    docs: 'id, kind, title, modified, dirty, deleted, *tagIds, *resourceIds',
    meta: 'key',
});

db.version(2).stores({
    docs: 'id, kind, title, modified, dirty, deleted, *tagIds, *resourceIds',
    meta: 'key',
});

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const APP_ID = 'pkb';
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const REMOTE_TOLERANCE_MS = 2000;
const KDF_ITERATIONS = 310000;

const docKey = (id) => `${id}.enc`;
const blobKey = (id) => `blob_${id}.enc`;

const engine = {
    token: null,
    dek: null,
    timer: null,
    debounceTimer: null,
    syncing: false,
    onStatus: () => {},
};

// ═══════════════════════════════════════════════════════════════════════════════
// Small utilities
// ═══════════════════════════════════════════════════════════════════════════════

export const uid = (prefix = 'doc') => {
    return `${prefix}_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;
};

export async function setMeta(key, value) {
    await db.meta.put({ key, value });
}

export async function getMeta(key) {
    const row = await db.meta.get(key);
    return row?.value;
}

const fileNameFromKey = (key) => key.split('/').pop() || '';

const isBlobKey = (key) => fileNameFromKey(key).startsWith('blob_');

const idFromDocKey = (key) => fileNameFromKey(key).replace(/\.enc$/, '');

const idFromBlobKey = (key) =>
    fileNameFromKey(key)
        .replace(/^blob_/, '')
        .replace(/\.enc$/, '');

const timestamp = (isoString) => Date.parse(isoString || '') || 0;

const isNewerRemote = (remoteModified, localModified) => {
    return (
        timestamp(remoteModified) >
        timestamp(localModified) + REMOTE_TOLERANCE_MS
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Base64 helpers
// ═══════════════════════════════════════════════════════════════════════════════

function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }

    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

function bytesToBase64Url(bytes) {
    return bytesToBase64(bytes)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function base64UrlToBytes(input) {
    let base64 = input
        .trim()
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const padding = base64.length % 4;

    if (padding) {
        base64 += '='.repeat(4 - padding);
    }

    return base64ToBytes(base64);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WebCrypto helpers
// ═══════════════════════════════════════════════════════════════════════════════

const subtle = window.crypto.subtle;

function randomBytes(length) {
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    return bytes;
}

async function importRawAesKey(bytes) {
    return subtle.importKey(
        'raw',
        bytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
}

async function generateDek() {
    return subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

async function deriveKek(password, salt, iterations) {
    const passwordBytes = new TextEncoder().encode(password);

    const keyMaterial = await subtle.importKey(
        'raw',
        passwordBytes,
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptBytesWithKey(key, data) {
    const iv = randomBytes(12);

    const ciphertext = await subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );

    return {
        iv,
        ct: new Uint8Array(ciphertext),
    };
}

async function decryptBytesWithKey(key, iv, ciphertext) {
    const plaintext = await subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
    );

    return new Uint8Array(plaintext);
}

async function encryptJsonToEnvelopeText(key, payload) {
    const data = new TextEncoder().encode(JSON.stringify(payload));
    const { iv, ct } = await encryptBytesWithKey(key, data);

    return JSON.stringify({
        v: 1,
        iv: bytesToBase64(iv),
        ct: bytesToBase64(ct),
    });
}

async function decryptEnvelopeTextToJson(key, text) {
    const envelope = JSON.parse(text);

    const iv = base64ToBytes(envelope.iv);
    const ct = base64ToBytes(envelope.ct);

    const plaintext = await decryptBytesWithKey(key, iv, ct);

    return JSON.parse(new TextDecoder().decode(plaintext));
}

async function encryptBytesToBase64Envelope(key, bytes) {
    const { iv, ct } = await encryptBytesWithKey(key, bytes);

    const envelope = JSON.stringify({
        v: 1,
        iv: bytesToBase64(iv),
        ct: bytesToBase64(ct),
    });

    return btoa(envelope);
}

async function decryptBase64EnvelopeToBytes(key, base64Envelope) {
    const envelope = JSON.parse(atob(base64Envelope));

    const iv = base64ToBytes(envelope.iv);
    const ct = base64ToBytes(envelope.ct);

    return decryptBytesWithKey(key, iv, ct);
}

async function wrapDek(dek, wrappingKey) {
    const rawDek = await subtle.exportKey('raw', dek);
    return encryptBytesToBase64Envelope(wrappingKey, new Uint8Array(rawDek));
}

async function unwrapDek(wrappingKey, wrappedDekBase64) {
    const rawDek = await decryptBase64EnvelopeToBytes(
        wrappingKey,
        wrappedDekBase64
    );

    return subtle.importKey(
        'raw',
        rawDek,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
    );
}

async function createVerifier(kek) {
    const verifierText = 'pkb-verifier-v1';
    const data = new TextEncoder().encode(verifierText);
    const { iv, ct } = await encryptBytesWithKey(kek, data);

    const envelope = JSON.stringify({
        v: 1,
        iv: bytesToBase64(iv),
        ct: bytesToBase64(ct),
    });

    return btoa(envelope);
}

async function checkVerifier(kek, verifierBase64) {
    const envelope = JSON.parse(atob(verifierBase64));

    const iv = base64ToBytes(envelope.iv);
    const ct = base64ToBytes(envelope.ct);

    const plaintext = await decryptBytesWithKey(kek, iv, ct);
    const text = new TextDecoder().decode(plaintext);

    if (text !== 'pkb-verifier-v1') {
        throw new Error('Invalid verifier');
    }
}

async function encryptDocToText(dek, doc) {
    const payload = {
        schema: 'pkb/doc',
        version: 1,
        doc: cleanDocForSync(doc),
    };

    return encryptJsonToEnvelopeText(dek, payload);
}

async function encryptBlobToBlob(dek, blob) {
    const buffer = await blob.arrayBuffer();
    const { iv, ct } = await encryptBytesWithKey(dek, new Uint8Array(buffer));

    const combined = new Uint8Array(iv.length + ct.length);
    combined.set(iv, 0);
    combined.set(ct, iv.length);

    return new Blob([combined], { type: 'application/octet-stream' });
}

async function decryptBlobFromBuffer(dek, buffer, mimeType) {
    const bytes = new Uint8Array(buffer);
    const iv = bytes.slice(0, 12);
    const ct = bytes.slice(12);

    const plaintext = await decryptBytesWithKey(dek, iv, ct);

    return new Blob([plaintext], {
        type: mimeType || 'application/octet-stream',
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Vault backend API (app-scoped, no vaultId)
// ═══════════════════════════════════════════════════════════════════════════════

const vaultBaseUrl = () => `${config.VAULT_URL}/vault`;

async function vaultFetch(path, { method = 'GET', token, body } = {}) {
    const headers = {
        Accept: 'application/json',
    };

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${vaultBaseUrl()}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();

    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { raw: text };
        }
    }

    if (!response.ok) {
        const detail = data?.detail;

        let message = `Vault API failed with status ${response.status}`;

        if (typeof detail === 'string') {
            message = detail;
        }

        if (detail && typeof detail === 'object') {
            message = detail.error || detail.message || message;
        }

        const error = new Error(message);
        error.status = response.status;
        error.detail = detail;

        throw error;
    }

    return data || {};
}

async function getAppVault(token) {
    try {
        const data = await vaultFetch(`/apps/${APP_ID}/vault`, { token });
        return data?.data || null;
    } catch (error) {
        if (error.status === 404) {
            return null;
        }
        throw error;
    }
}

export async function getPkbVaultStatus(token) {
    try {
        const data = await vaultFetch(`/apps/${APP_ID}/vault/status`, { token });
        return Boolean(data?.data?.exists);
    } catch {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sync endpoint helpers (app-scoped, relative keys)
// ═══════════════════════════════════════════════════════════════════════════════

async function listAllObjects(token) {
    let cursor = null;
    const objects = [];

    for (;;) {
        const query = cursor
            ? `?cursor=${encodeURIComponent(cursor)}`
            : '';

        const data = await vaultFetch(
            `/apps/${APP_ID}/sync/list${query}`,
            { token }
        );

        const root = data?.data || {};
        const page = root.objects || [];

        objects.push(...page);

        if (!root.isTruncated || !root.nextCursor) {
            break;
        }

        cursor = root.nextCursor;
    }

    return objects;
}

async function presignPut(token, key) {
    const data = await vaultFetch(
        `/apps/${APP_ID}/sync/presign-put`,
        {
            method: 'POST',
            token,
            body: { key },
        }
    );

    return data?.data?.uploadUrl;
}

async function presignGets(token, keys) {
    if (!keys.length) {
        return [];
    }

    const data = await vaultFetch(
        `/apps/${APP_ID}/sync/presign-get`,
        {
            method: 'POST',
            token,
            body: { keys },
        }
    );

    return data?.data?.objects || [];
}

async function deleteRemoteKeys(token, keys) {
    if (!keys.length) {
        return;
    }

    for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000);

        await vaultFetch(`/apps/${APP_ID}/sync/delete`, {
            method: 'POST',
            token,
            body: { keys: batch },
        });
    }
}

async function uploadToPresignedUrl(url, body) {
    const response = await fetch(url, {
        method: 'PUT',
        body,
    });

    if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
    }
}

async function downloadDoc(token, key) {
    const urls = await presignGets(token, [key]);
    const downloadUrl = urls[0]?.downloadUrl;

    if (!downloadUrl) {
        return null;
    }

    const response = await fetch(downloadUrl);

    if (!response.ok) {
        return null;
    }

    const text = await response.text();
    const payload = await decryptEnvelopeTextToJson(engine.dek, text);

    return payload.doc || payload;
}

async function downloadBlob(token, key, mimeType) {
    const urls = await presignGets(token, [key]);
    const downloadUrl = urls[0]?.downloadUrl;

    if (!downloadUrl) {
        return null;
    }

    const response = await fetch(downloadUrl);

    if (!response.ok) {
        return null;
    }

    const buffer = await response.arrayBuffer();

    return decryptBlobFromBuffer(engine.dek, buffer, mimeType);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Vault creation, unlock, recovery (no vaultId returned)
// ═══════════════════════════════════════════════════════════════════════════════

export async function createPkbVault(token, password) {
    const existing = await getAppVault(token);

    if (existing) {
        throw new Error('A PKB vault already exists for this account.');
    }

    const dek = await generateDek();

    const salt = randomBytes(16);
    const kek = await deriveKek(password, salt, KDF_ITERATIONS);

    const wrappedDek = await wrapDek(dek, kek);
    const verifier = await createVerifier(kek);

    const recoveryKeyBytes = randomBytes(32);
    const recoveryKey = bytesToBase64Url(recoveryKeyBytes);

    const recoveryCryptoKey = await importRawAesKey(recoveryKeyBytes);
    const wrappedDekRecovery = await wrapDek(dek, recoveryCryptoKey);

    const payload = {
        name: 'PKB',
        kdf: {
            algo: 'PBKDF2-SHA256',
            iterations: KDF_ITERATIONS,
            salt: bytesToBase64(salt),
        },
        wrappedDek,
        wrappedDekRecovery,
        verifier,
    };

    await vaultFetch(`/apps/${APP_ID}/vault`, {
        method: 'POST',
        token,
        body: payload,
    });

    await markUnsyncedDocsDirty();

    return {
        dek,
        recoveryKey,
    };
}

export async function unlockPkbVault(token, password) {
    const vault = await getAppVault(token);

    if (!vault) {
        throw new Error('No PKB vault found for this account.');
    }

    const salt = base64ToBytes(vault.kdf.salt);
    const iterations = vault.kdf.iterations || KDF_ITERATIONS;

    const kek = await deriveKek(password, salt, iterations);

    let dek;

    try {
        await checkVerifier(kek, vault.verifier);
        dek = await unwrapDek(kek, vault.wrappedDek);
    } catch {
        throw new Error('Wrong password or corrupt vault.');
    }

    return {
        dek,
    };
}

export async function resetPasswordWithRecovery(
    token,
    recoveryKeyInput,
    newPassword
) {
    const vault = await getAppVault(token);

    if (!vault) {
        throw new Error('No PKB vault found for this account.');
    }

    if (!vault.wrappedDekRecovery) {
        throw new Error('This vault does not have a recovery key configured.');
    }

    let dek;

    try {
        const recoveryBytes = base64UrlToBytes(recoveryKeyInput);
        const recoveryCryptoKey = await importRawAesKey(recoveryBytes);
        dek = await unwrapDek(recoveryCryptoKey, vault.wrappedDekRecovery);
    } catch {
        throw new Error('Invalid recovery key.');
    }

    const salt = randomBytes(16);
    const kek = await deriveKek(newPassword, salt, KDF_ITERATIONS);

    const wrappedDek = await wrapDek(dek, kek);
    const verifier = await createVerifier(kek);

    await vaultFetch(`/apps/${APP_ID}/vault`, {
        method: 'PATCH',
        token,
        body: {
            kdf: {
                algo: 'PBKDF2-SHA256',
                iterations: KDF_ITERATIONS,
                salt: bytesToBase64(salt),
            },
            wrappedDek,
            verifier,
        },
    });

    return {
        dek,
    };
}

// Add after resetPasswordWithRecovery in src/services/pkbSync.js

export async function deletePkbVault(token) {
    await vaultFetch(`/apps/${APP_ID}/vault`, {
        method: 'DELETE',
        token,
    });
}

export async function changePkbPassword(token, currentPassword, newPassword) {
    const vault = await getAppVault(token);

    if (!vault) {
        throw new Error('No PKB vault found for this account.');
    }

    const salt = base64ToBytes(vault.kdf.salt);
    const iterations = vault.kdf.iterations || KDF_ITERATIONS;

    const kek = await deriveKek(currentPassword, salt, iterations);

    let dek;
    try {
        await checkVerifier(kek, vault.verifier);
        dek = await unwrapDek(kek, vault.wrappedDek);
    } catch {
        throw new Error('Current password is incorrect.');
    }

    const newSalt = randomBytes(16);
    const newKek = await deriveKek(newPassword, newSalt, KDF_ITERATIONS);

    const wrappedDek = await wrapDek(dek, newKek);
    const verifier = await createVerifier(newKek);

    await vaultFetch(`/apps/${APP_ID}/vault`, {
        method: 'PATCH',
        token,
        body: {
            kdf: {
                algo: 'PBKDF2-SHA256',
                iterations: KDF_ITERATIONS,
                salt: bytesToBase64(newSalt),
            },
            wrappedDek,
            verifier,
        },
    });

    return { dek };
}

export async function clearLocalPkbData() {
    try {
        await db.docs.clear();
        await db.meta.clear();
    } catch (error) {
        console.error('Failed to clear local PKB data:', error);
        throw error;
    }
}



// ═══════════════════════════════════════════════════════════════════════════════
// Local sync helpers
// ═══════════════════════════════════════════════════════════════════════════════

function cleanDocForSync(doc) {
    const clone = { ...doc };

    delete clone.blob;
    delete clone.dirty;
    delete clone.deleted;
    delete clone.syncTime;
    delete clone.remoteModified;
    delete clone.lastSyncedModified;
    delete clone.blobDirty;
    delete clone.blobSyncTime;
    delete clone.blobRemoteModified;

    return clone;
}

export async function markUnsyncedDocsDirty() {
    const docs = await db.docs.toArray();
    const jobs = [];

    for (const doc of docs) {
        const changes = {};

        if (!doc.deleted && !doc.syncTime && doc.dirty !== 1) {
            changes.dirty = 1;
        }

        if (
            doc.kind === 'resource' &&
            doc.blob &&
            !doc.blobSyncTime &&
            doc.blobDirty !== 1
        ) {
            changes.blobDirty = 1;
        }

        if (Object.keys(changes).length) {
            jobs.push(db.docs.update(doc.id, changes));
        }
    }

    await Promise.all(jobs);
}

export async function clearSyncMetadataForAllDocs() {
    const docs = await db.docs.toArray();
    const updateJobs = [];
    const tombstoneIds = [];

    for (const doc of docs) {
        if (doc.deleted) {
            tombstoneIds.push(doc.id);
        } else {
            updateJobs.push(db.docs.update(doc.id, {
                syncTime: null,
                remoteModified: null,
                lastSyncedModified: null,
                blobSyncTime: null,
                blobRemoteModified: null,
            }));
        }
    }

    await Promise.all(updateJobs);

    if (tombstoneIds.length) {
        await db.docs.bulkDelete(tombstoneIds);
    }

    // Clear the last sync timestamp as well
    await db.meta.delete('lastSyncAt');
}

async function addConflictCopy(doc, label) {
    const copy = cleanDocForSync(doc);

    const prefix =
        copy.kind === 'tag'
            ? 'tag'
            : copy.kind === 'resource'
              ? 'res'
              : 'note';

    copy.id = uid(prefix);
    copy.title = `${copy.title || 'Untitled'} ${label}`;
    copy.conflictOf = doc.id;
    copy.created = new Date().toISOString();
    copy.modified = copy.created;
    copy.dirty = 1;
    copy.deleted = 0;

    await db.docs.add(copy);
}

// Chat notes merge at the message level instead of creating conflict copies.
const messageTs = (m) => {
    const t = Date.parse(m?.timestamp || m?.createdAt || m?.time || '');
    return Number.isFinite(t) ? t : 0;
};

const unionIds = (a = [], b = []) => [...new Set([...a, ...b])];

const tryMergeChatDocs = (localDoc, remoteDoc) => {
    try {
        const local = JSON.parse(localDoc.content || '{}');
        const remote = JSON.parse(remoteDoc.content || '{}');

        if (local.schema !== 'aida/chat' || remote.schema !== 'aida/chat') return null;
        if (!Array.isArray(local.messages) || !Array.isArray(remote.messages)) return null;

        const all = [...local.messages, ...remote.messages];
        if (!all.every((m) => m && m.id != null)) return null;

        const byId = new Map();
        for (const m of all) {
            const prev = byId.get(m.id);
            if (!prev || messageTs(m) >= messageTs(prev)) byId.set(m.id, m);
        }
        const messages = [...byId.values()].sort((a, b) => messageTs(a) - messageTs(b));

        const localModified = timestamp(localDoc.modified);
        const remoteModified = timestamp(remoteDoc.modified);
        const newerDoc = remoteModified >= localModified ? remoteDoc : localDoc;
        const base = remoteModified >= localModified ? remote : local;

        return {
            content: JSON.stringify({ ...base, messages }, null, 2),
            title: newerDoc.title || localDoc.title,
            tagIds: unionIds(localDoc.tagIds, remoteDoc.tagIds),
            resourceIds: unionIds(localDoc.resourceIds, remoteDoc.resourceIds),
            modified: new Date(Math.max(localModified, remoteModified, Date.now())).toISOString(),
        };
    } catch {
        return null;
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// Sync engine (no vaultId)
// ═══════════════════════════════════════════════════════════════════════════════

export function startPkbSync({ token, dek, onStatus }) {
    stopPkbSync();

    engine.token = token;
    engine.dek = dek;
    engine.onStatus = onStatus || (() => {});

    markUnsyncedDocsDirty()
        .then(() => syncNow())
        .catch((error) => {
            console.error('Initial PKB sync failed:', error);
            engine.onStatus(`Sync failed: ${error.message}`);
        });

    engine.timer = setInterval(() => {
        syncNow().catch((error) => {
            console.error('PKB interval sync failed:', error);
        });
    }, SYNC_INTERVAL_MS);
}

export function stopPkbSync() {
    if (engine.timer) {
        clearInterval(engine.timer);
        engine.timer = null;
    }

    if (engine.debounceTimer) {
        clearTimeout(engine.debounceTimer);
        engine.debounceTimer = null;
    }

    engine.token = null;
    engine.dek = null;
    engine.syncing = false;
    engine.onStatus = () => {};
}

export function requestPkbSync(delayMs = 1500) {
    if (!engine.token || !engine.dek) {
        return;
    }

    if (engine.debounceTimer) {
        clearTimeout(engine.debounceTimer);
    }

    engine.debounceTimer = setTimeout(() => {
        syncNow().catch((error) => {
            console.error('PKB requested sync failed:', error);
        });
    }, delayMs);
}

export async function syncNow() {
    if (!engine.token || !engine.dek || engine.syncing) {
        return;
    }

    engine.syncing = true;

    const setStatus = (message) => {
        engine.onStatus(message);
    };

    try {
        setStatus('Sync: listing remote objects');

        const remoteObjects = await listAllObjects(engine.token);

        const remoteByKey = new Map(
            remoteObjects.map((item) => [item.key, item])
        );

        const now = new Date().toISOString();
        const uploadedKeys = new Set();

        // Push deletions.
        const tombstones = await db.docs
            .filter((doc) => doc.deleted && doc.dirty)
            .toArray();

        if (tombstones.length) {
            setStatus('Sync: pushing deletions');

            const keysToDelete = [];

            for (const doc of tombstones) {
                keysToDelete.push(docKey(doc.id));

                if (doc.kind === 'resource') {
                    keysToDelete.push(blobKey(doc.id));
                }
            }

            await deleteRemoteKeys(engine.token, keysToDelete);
            await db.docs.bulkDelete(tombstones.map((doc) => doc.id));
        }

        // Upload dirty docs.
        const docs = await db.docs
            .filter((doc) => !doc.deleted)
            .toArray();

        const dirtyDocs = docs.filter((doc) => doc.dirty);

        for (const doc of dirtyDocs) {
            setStatus(`Sync: uploading ${doc.title || doc.id}`);

            const key = docKey(doc.id);
            const remote = remoteByKey.get(key);

            let shouldUpload = true;

            // A remote object may contain changes we have not yet seen if
            // its server lastModified is newer than the version we last
            // acknowledged, or if we have never acknowledged a remote
            // version at all.
            const remoteMayHaveChanged =
                remote &&
                (!doc.remoteModified ||
                    isNewerRemote(remote.lastModified, doc.remoteModified));

            if (remoteMayHaveChanged) {
                try {
                    const remoteDoc = await downloadDoc(
                        engine.token,
                        remote.key
                    );

                    if (remoteDoc) {
                        const localModified = timestamp(doc.modified);
                        const remoteModified = timestamp(remoteDoc.modified);
                        const lastSynced = timestamp(doc.lastSyncedModified);

                        if (remoteModified <= lastSynced) {
                            // The remote object is our own previous upload
                            // (or something older). Not a conflict.
                        } else {
                            const merged = tryMergeChatDocs(doc, remoteDoc);

                            if (merged) {
                                // Chat notes merge at the message level.
                                // Both sides keep every message and no
                                // conflict copy is created.
                                await db.docs.update(doc.id, {
                                    content: merged.content,
                                    title: merged.title,
                                    tagIds: merged.tagIds,
                                    resourceIds: merged.resourceIds,
                                    modified: merged.modified,
                                });
                                doc.content = merged.content;
                                doc.title = merged.title;
                                doc.tagIds = merged.tagIds;
                                doc.resourceIds = merged.resourceIds;
                                doc.modified = merged.modified;
                            } else if (remoteModified > localModified) {
                                if (doc.kind !== 'resource') {
                                    await addConflictCopy(doc, '(local conflict)');
                                }

                                const accepted = {
                                    ...remoteDoc,
                                    id: doc.id,
                                    deleted: 0,
                                    dirty: 0,
                                    syncTime: now,
                                    remoteModified: remote.lastModified,
                                    lastSyncedModified: remoteDoc.modified,
                                };

                                if (doc.kind === 'resource') {
                                    accepted.blob = doc.blob;
                                    accepted.blobDirty = doc.blobDirty;
                                    accepted.blobSyncTime = doc.blobSyncTime;
                                    accepted.blobRemoteModified =
                                        remoteByKey.get(blobKey(doc.id))
                                            ?.lastModified ||
                                        doc.blobRemoteModified;
                                }

                                await db.docs.put(accepted);
                                shouldUpload = false;
                            } else {
                                if (doc.kind !== 'resource') {
                                    await addConflictCopy(
                                        remoteDoc,
                                        '(remote conflict)'
                                    );
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn('Conflict check failed:', error);
                }
            }

            if (!shouldUpload) {
                continue;
            }

            const encryptedText = await encryptDocToText(engine.dek, doc);
            const uploadUrl = await presignPut(engine.token, key);

            await uploadToPresignedUrl(
                uploadUrl,
                new Blob([encryptedText], { type: '' })
            );

            uploadedKeys.add(key);

            // Stamp the doc with the moment this upload finished. The
            // server records almost the same instant as the object's
            // lastModified, so the next sync can tell "unchanged since my
            // upload" apart from "changed by someone else". Previously this
            // stored the lastModified of the version BEFORE the upload,
            // which made every doc look remotely changed on the next sync.
            const uploadedAt = new Date().toISOString();

            const update = {
                dirty: 0,
                syncTime: uploadedAt,
                remoteModified: uploadedAt,
                lastSyncedModified: doc.modified,
            };

            if (
                doc.kind === 'resource' &&
                doc.blob &&
                (doc.blobDirty || !doc.blobSyncTime)
            ) {
                const resourceBlobKey = blobKey(doc.id);

                const encryptedBlob = await encryptBlobToBlob(
                    engine.dek,
                    doc.blob
                );

                const blobUploadUrl = await presignPut(
                    engine.token,
                    resourceBlobKey
                );

                await uploadToPresignedUrl(blobUploadUrl, encryptedBlob);

                uploadedKeys.add(resourceBlobKey);

                const blobUploadedAt = new Date().toISOString();

                update.blobDirty = 0;
                update.blobSyncTime = blobUploadedAt;
                update.blobRemoteModified = blobUploadedAt;
            }

            await db.docs.update(doc.id, update);
        }

        // Download remote doc changes.
        setStatus('Sync: downloading remote changes');

        const remoteDocObjects = remoteObjects.filter(
            (item) => !isBlobKey(item.key)
        );

        for (const remote of remoteDocObjects) {
            if (uploadedKeys.has(remote.key)) {
                continue;
            }

            const id = idFromDocKey(remote.key);
            const local = await db.docs.get(id);

            if (local && (local.dirty || local.deleted)) {
                continue;
            }

            const shouldDownload =
                !local ||
                !local.remoteModified ||
                isNewerRemote(remote.lastModified, local.remoteModified);

            if (!shouldDownload) {
                continue;
            }

            const remoteDoc = await downloadDoc(
                engine.token,
                remote.key
            );

            if (!remoteDoc) {
                continue;
            }

            const docToPut = {
                ...remoteDoc,
                id,
                deleted: 0,
                dirty: 0,
                syncTime: now,
                remoteModified: remote.lastModified,
                lastSyncedModified: remoteDoc.modified,
            };

            if (local && local.kind === 'resource') {
                docToPut.blob = local.blob;
                docToPut.blobDirty = local.blobDirty;
                docToPut.blobSyncTime = local.blobSyncTime;
                docToPut.blobRemoteModified = local.blobRemoteModified;
            }

            await db.docs.put(docToPut);
        }

        // Download remote blob changes.
        const remoteBlobObjects = remoteObjects.filter((item) =>
            isBlobKey(item.key)
        );

        for (const remote of remoteBlobObjects) {
            if (uploadedKeys.has(remote.key)) {
                continue;
            }

            const id = idFromBlobKey(remote.key);
            const local = await db.docs.get(id);

            if (!local || local.deleted || local.dirty) {
                continue;
            }

            const shouldDownload =
                !local.blob ||
                !local.blobRemoteModified ||
                isNewerRemote(remote.lastModified, local.blobRemoteModified);

            if (!shouldDownload) {
                continue;
            }

            const blob = await downloadBlob(
                engine.token,
                remote.key,
                local.mimeType
            );

            if (!blob) {
                continue;
            }

            await db.docs.update(id, {
                blob,
                blobDirty: 0,
                blobSyncTime: now,
                blobRemoteModified: remote.lastModified,
            });
        }

        // Detect remote deletions.
        setStatus('Sync: checking remote deletions');

        const finalDocs = await db.docs
            .filter((doc) => !doc.dirty && !doc.deleted)
            .toArray();

        const remoteKeys = new Set(remoteObjects.map((item) => item.key));

        const missingLocally = finalDocs.filter((doc) => {
            return (
                doc.syncTime &&
                !remoteKeys.has(docKey(doc.id)) &&
                !uploadedKeys.has(docKey(doc.id))
            );
        });

        if (missingLocally.length) {
            await db.docs.bulkDelete(missingLocally.map((doc) => doc.id));
        }

        await setMeta('lastSyncAt', now);

        setStatus('Sync complete');
    } catch (error) {
        console.error('PKB sync failed:', error);
        setStatus(`Sync failed: ${error.message}`);
    } finally {
        engine.syncing = false;
    }
}