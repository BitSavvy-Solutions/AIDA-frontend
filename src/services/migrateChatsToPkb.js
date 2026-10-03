// src/services/migrateChatsToPkb.js
//
// One-shot migration from the old widget history database
// (AidaWidgetDB: chats, projects) into the PKB local database
// (pkb-local: docs) so chat history can be encrypted and synced
// by pkbSync like any other PKB content.
//
// Mapping:
//   widget chat    -> PKB note (kind: 'note')
//                     content holds the chat as pretty printed JSON:
//                       { schema: 'aida/chat', version: 1, messages: [...] }
//                     Messages keep their original shape (id, sender,
//                     text, reasoning, meta, model, ...) with one
//                     exception: every attachment is replaced by a small
//                     reference object:
//                       { resourceId, name, size, mimeType, type, id? }
//   widget project -> PKB tag (kind: 'tag', id: tag_mig_<slug>)
//   attachment     -> PKB resource (kind: 'resource', id: res_<sha256>)
//                     title is the first seen attachment name and blob
//                     holds the bytes. Identical bytes attached anywhere
//                     resolve to the same document, so vault objects are
//                     linked, never re-uploaded.
//
// This migration runs exactly once. If the PKB docs table already has
// any rows, it exits immediately and never runs again.

import { db as pkbDb, setMeta } from './pkbSync';

const SOURCE_DB = 'AidaWidgetDB';
const META_KEY = 'migration.widgetChats.v1';

// 1 = old flattened markdown transcript, 2 = structured chat JSON.
const CONTENT_FORMAT = 2;

// ═══════════════════════════════════════════════════════════════════
// Source database access (plain IndexedDB, read only)
// ═══════════════════════════════════════════════════════════════════

const openSourceDb = () =>
    new Promise((resolve) => {
        try {
            const request = indexedDB.open(SOURCE_DB);
            request.onerror = () => resolve(null);
            request.onblocked = () => resolve(null);
            request.onsuccess = () => resolve(request.result);
        } catch {
            resolve(null);
        }
    });

const getKeysFromStore = (idb, storeName) =>
    new Promise((resolve) => {
        try {
            const tx = idb.transaction(storeName, 'readonly');
            const rq = tx.objectStore(storeName).getAllKeys();
            rq.onsuccess = () => resolve(rq.result || []);
            rq.onerror = () => resolve([]);
        } catch {
            resolve([]);
        }
    });

const getAllFromStore = (idb, storeName) =>
    new Promise((resolve) => {
        try {
            const tx = idb.transaction(storeName, 'readonly');
            const rq = tx.objectStore(storeName).getAll();
            rq.onsuccess = () => resolve(rq.result || []);
            rq.onerror = () => resolve([]);
        } catch {
            resolve([]);
        }
    });

const getFromStore = (idb, storeName, key) =>
    new Promise((resolve) => {
        try {
            const tx = idb.transaction(storeName, 'readonly');
            const rq = tx.objectStore(storeName).get(key);
            rq.onsuccess = () => resolve(rq.result || null);
            rq.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });

const chatRevision = (chat) => {
    const messages = Array.isArray(chat.messages) ? chat.messages : [];
    const last = messages.length ? messages[messages.length - 1] : null;

    return JSON.stringify([
        chat.title || '',
        messages.length,
        chat.updatedAt ||
            (last && (last.timestamp || last.createdAt || last.time)) ||
            chat.createdAt ||
            0,
    ]);
};

// ═══════════════════════════════════════════════════════════════════
// Byte helpers
// ═══════════════════════════════════════════════════════════════════

const base64ToBytes = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
};

const dataUrlToBytes = (dataUrl) => {
    const comma = dataUrl.indexOf(',');
    const meta = dataUrl.slice(0, comma);
    const payload = dataUrl.slice(comma + 1);
    const isBase64 = /;base64$/i.test(meta);
    const mimeType = meta.slice(5).split(';')[0] || 'application/octet-stream';

    const bytes = isBase64
        ? base64ToBytes(payload)
        : new TextEncoder().encode(decodeURIComponent(payload));

    return { bytes, mimeType };
};

const sha256Hex = async (bytes) => {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
};

const EXTENSIONS = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'application/json': 'json',
    'application/pdf': 'pdf',
};

const extensionFor = (mimeType) => EXTENSIONS[mimeType] || 'bin';

const isBlob = (value) => typeof Blob !== 'undefined' && value instanceof Blob;
const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:');
const isHttpUrl = (value) => typeof value === 'string' && /^https?:/i.test(value);

// entry.type is sometimes 'image' (a kind) and sometimes a mime type.
// Only accept it as a mime type when it actually looks like one.
const mimeFromEntry = (entry) => {
    const candidate = entry.mimeType || entry.contentType || entry.type;
    return typeof candidate === 'string' && candidate.includes('/')
        ? candidate
        : null;
};

const toIso = (value) => {
    const numeric = typeof value === 'number' ? value : Date.parse(value || '');
    const time = Number.isFinite(numeric) ? numeric : Date.now();
    return new Date(time).toISOString();
};

const slugify = (value) =>
    String(value)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64) || 'tag';

// ═══════════════════════════════════════════════════════════════════
// Attachment normalization
// ═══════════════════════════════════════════════════════════════════

const resolveAttachment = async (origin, entry, msgIndex, entryIndex) => {
    const fallbackName = (mimeType) =>
        `attachment-msg${msgIndex}-${entryIndex}.${extensionFor(mimeType)}`;

    if (isBlob(entry)) {
        const buffer = await entry.arrayBuffer();
        const mimeType = entry.type || 'application/octet-stream';
        return {
            bytes: new Uint8Array(buffer),
            mimeType,
            name: entry.name || fallbackName(mimeType),
        };
    }

    if (isDataUrl(entry)) {
        const { bytes, mimeType } = dataUrlToBytes(entry);
        return { bytes, mimeType, name: fallbackName(mimeType) };
    }

    if (isHttpUrl(entry)) {
        console.warn('Migration: skipping remote URL attachment', entry);
        return null;
    }

    if (typeof entry === 'string') {
        if (origin === 'image') {
            const mimeType = 'image/png';
            try {
                return {
                    bytes: base64ToBytes(entry),
                    mimeType,
                    name: fallbackName(mimeType),
                };
            } catch {
                return null;
            }
        }

        const mimeType = 'text/plain';
        return {
            bytes: new TextEncoder().encode(entry),
            mimeType,
            name: fallbackName(mimeType),
        };
    }

    if (entry && typeof entry === 'object') {
        const name = entry.name || entry.fileName || entry.title || null;
        const mimeType = mimeFromEntry(entry);

        if (isBlob(entry.blob)) {
            const buffer = await entry.blob.arrayBuffer();
            const mime = mimeType || entry.blob.type || 'application/octet-stream';
            return {
                bytes: new Uint8Array(buffer),
                mimeType: mime,
                name: name || fallbackName(mime),
            };
        }

        const urlCandidate = entry.dataUrl || entry.data || entry.url || entry.src;
        if (isDataUrl(urlCandidate)) {
            const parsed = dataUrlToBytes(urlCandidate);
            const mime = mimeType || parsed.mimeType;
            return { bytes: parsed.bytes, mimeType: mime, name: name || fallbackName(mime) };
        }

        if (typeof entry.base64 === 'string') {
            const mime = mimeType || 'application/octet-stream';
            try {
                return {
                    bytes: base64ToBytes(entry.base64),
                    mimeType: mime,
                    name: name || fallbackName(mime),
                };
            } catch {
                return null;
            }
        }

        const text = typeof entry.content === 'string' ? entry.content : entry.text;
        if (typeof text === 'string') {
            const mime = mimeType || 'text/plain';
            return {
                bytes: new TextEncoder().encode(text),
                mimeType: mime,
                name: name || fallbackName(mime),
            };
        }
    }

    return null;
};

// ═══════════════════════════════════════════════════════════════════
// Message transformation: attachments become resource references
// ═══════════════════════════════════════════════════════════════════

const makeRef = async (origin, entry, msgIndex, entryIndex, ctx) => {
    const resolved = await resolveAttachment(origin, entry, msgIndex, entryIndex);

    if (!resolved) {
        const placeholder = {
            resourceId: null,
            name:
                (entry && typeof entry === 'object' && (entry.name || entry.fileName)) ||
                `attachment-msg${msgIndex}-${entryIndex}`,
            type: (entry && typeof entry === 'object' && entry.type) || origin,
        };

        const url = isHttpUrl(entry)
            ? entry
            : entry && typeof entry === 'object' && isHttpUrl(entry.src || entry.url)
              ? (entry.src || entry.url)
              : null;

        if (url) placeholder.url = url;

        ctx.stats.attachmentsSkipped += 1;
        return { ref: placeholder, resourceId: null };
    }

    const resourceId = await ensureResource({
        bytes: resolved.bytes,
        name: resolved.name,
        mimeType: resolved.mimeType,
        now: ctx.now,
        stats: ctx.stats,
    });

    const ref = {
        resourceId,
        name: resolved.name,
        size: resolved.bytes.byteLength,
        mimeType: resolved.mimeType,
        type: (entry && typeof entry === 'object' && entry.type) || origin,
    };

    if (entry && typeof entry === 'object' && entry.id) {
        ref.id = entry.id;
    }

    ctx.stats.attachmentsLinked += 1;

    return { ref, resourceId };
};

const transformMessage = async (msg, msgIndex, ctx) => {
    const clone = { ...msg };
    const resourceIds = [];

    const track = (id) => {
        if (id && !resourceIds.includes(id)) resourceIds.push(id);
    };

    const listFields = [
        ['images', 'image'],
        ['attachments', 'file'],
        ['files', 'file'],
    ];

    for (const [field, origin] of listFields) {
        if (!Array.isArray(clone[field])) continue;

        const out = [];
        let index = 0;

        for (const entry of clone[field]) {
            index += 1;
            const { ref, resourceId } = await makeRef(origin, entry, msgIndex, index, ctx);
            out.push(ref);
            track(resourceId);
        }

        clone[field] = out;
    }

    if (clone.image) {
        const { ref, resourceId } = await makeRef('image', clone.image, msgIndex, 0, ctx);
        clone.image = ref;
        track(resourceId);
    }

    if (clone.attachment) {
        const { ref, resourceId } = await makeRef('file', clone.attachment, msgIndex, 0, ctx);
        clone.attachment = ref;
        track(resourceId);
    }

    return { message: clone, resourceIds };
};

// ═══════════════════════════════════════════════════════════════════
// PKB document creators with hash based reuse
// ═══════════════════════════════════════════════════════════════════

const ensureResource = async ({ bytes, name, mimeType, now, stats }) => {
    const hash = await sha256Hex(bytes);
    const id = `res_${hash}`;
    const existing = await pkbDb.docs.get(id);

    if (existing && !existing.deleted) {
        const missingBlob =
            !existing.blob && !existing.blobSyncTime && !existing.blobRemoteModified;

        if (missingBlob) {
            await pkbDb.docs.update(id, {
                blob: new Blob([bytes], { type: mimeType }),
                blobDirty: 1,
                dirty: 1,
                modified: now,
            });
            stats.resourcesFilled += 1;
        } else {
            stats.resourcesReused += 1;
        }

        return id;
    }

    const doc = {
        id,
        kind: 'resource',
        title: name,
        mimeType,
        size: bytes.byteLength,
        blob: new Blob([bytes], { type: mimeType }),
        created: now,
        modified: now,
        dirty: 1,
        deleted: 0,
        blobDirty: 1,
        migratedFrom: SOURCE_DB,
    };

    await pkbDb.docs.put(doc);

    stats.resourcesCreated += 1;
    stats.bytes += bytes.byteLength;

    return id;
};

const ensureTag = async ({ name, extra = {}, now, stats, byName }) => {
    const key = String(name).toLowerCase();

    if (byName.has(key)) return byName.get(key);

    const id = `tag_mig_${slugify(name)}`;
    const existing = await pkbDb.docs.get(id);

    if (existing && !existing.deleted) {
        byName.set(key, id);
        return id;
    }

    await pkbDb.docs.put({
        id,
        kind: 'tag',
        title: String(name),
        created: now,
        modified: now,
        dirty: 1,
        deleted: 0,
        migratedFrom: SOURCE_DB,
        ...extra,
    });

    byName.set(key, id);
    stats.tagsCreated += 1;

    return id;
};

// ═══════════════════════════════════════════════════════════════════
// Note payload: the chat as structured JSON
// ═══════════════════════════════════════════════════════════════════

const noteIdFor = (chatId) =>
    `note_mig_${String(chatId).replace(/[^A-Za-z0-9_-]/g, '-')}`;

const buildNotePayload = async (chat, ctx) => {
    const messages = Array.isArray(chat.messages) ? chat.messages : [];
    const transformed = [];
    const resourceIds = [];

    let msgIndex = 0;

    for (const msg of messages) {
        msgIndex += 1;
        const { message, resourceIds: ids } = await transformMessage(msg, msgIndex, ctx);
        transformed.push(message);

        for (const id of ids) {
            if (!resourceIds.includes(id)) resourceIds.push(id);
        }
    }

    const tagIds = [];
    for (const tagId of ctx.chatTagIds.get(chat.id) || []) {
        if (!tagIds.includes(tagId)) tagIds.push(tagId);
    }

    const last = messages.length ? messages[messages.length - 1] : null;

    return {
        id: noteIdFor(chat.id),
        kind: 'note',
        title: chat.title || 'Migrated chat',
        content: JSON.stringify(
            { schema: 'aida/chat', version: 1, messages: transformed },
            null,
            2
        ),
        contentFormat: CONTENT_FORMAT,
        tagIds,
        resourceIds,
        created: toIso(chat.createdAt),
        modified: toIso(
            chat.updatedAt ||
                (last && (last.timestamp || last.createdAt || last.time)) ||
                chat.createdAt
        ),
        dirty: 1,
        deleted: 0,
        migratedFrom: `${SOURCE_DB}:${chat.id}`,
        sourceRev: chatRevision(chat),
    };
};

// ═══════════════════════════════════════════════════════════════════
// Migration entry point
// ═══════════════════════════════════════════════════════════════════

export const getChatsMigrationStatus = () => pkbDb.docs.count();

export const migrateWidgetChatsToPkb = async () => {
    const idb = await openSourceDb();

    if (!idb) {
        return { skipped: true, reason: 'source database unavailable' };
    }

    if (!idb.objectStoreNames.contains('chats')) {
        idb.close();
        return { skipped: true, reason: 'no chats in source database' };
    }

    // One-shot guard: if the PKB docs table already has any documents,
    // do not run the migration again.
    const docCount = await pkbDb.docs.count();
    if (docCount > 0) {
        idb.close();
        return { skipped: true, reason: 'pkb database already present' };
    }

    const chatIds = await getKeysFromStore(idb, 'chats');

    if (!chatIds.length) {
        idb.close();
        return { skipped: true, reason: 'no chats in source database' };
    }

    const projects = idb.objectStoreNames.contains('projects')
        ? await getAllFromStore(idb, 'projects')
        : [];

    const now = new Date().toISOString();
    const stats = {
        chats: 0,
        tagsCreated: 0,
        resourcesCreated: 0,
        resourcesReused: 0,
        resourcesFilled: 0,
        attachmentsLinked: 0,
        attachmentsSkipped: 0,
        bytes: 0,
    };

    try {
        const byName = new Map();
        const existingTags = await pkbDb.docs.where('kind').equals('tag').toArray();
        for (const tag of existingTags) {
            byName.set(String(tag.title).toLowerCase(), tag.id);
        }

        const chatTagIds = new Map();

        for (const project of projects) {
            if (!project?.name) continue;

            const tagId = await ensureTag({
                name: project.name,
                extra: { iconKey: project.iconKey, iconColor: project.iconColor },
                now,
                stats,
                byName,
            });

            for (const chatId of project.chatIds || []) {
                const list = chatTagIds.get(chatId) || [];
                list.push(tagId);
                chatTagIds.set(chatId, list);
            }
        }

        const ctx = { now, stats, chatTagIds };

        for (const chatId of chatIds) {
            const noteId = noteIdFor(chatId);
            const existing = await pkbDb.docs.get(noteId);

            // One-shot import. Once a note exists, the migration never
            // touches it again.
            if (existing) {
                continue;
            }

            const chat = await getFromStore(idb, 'chats', chatId);
            if (!chat) continue;

            const payload = await buildNotePayload(chat, ctx);
            await pkbDb.docs.put(payload);
            stats.chats += 1;
        }
    } finally {
        idb.close();
    }

    const summary = { at: now, ...stats };
    await setMeta(META_KEY, summary);

    return summary;
};