/**
 * Snapshot = the complete portable state of one profile.
 */
import { db } from './db';

export const SNAPSHOT_SCHEMA_VERSION = 2;
const TOMBSTONE_TTL_MS = 180 * 24 * 3600 * 1000;

const LS_INCLUDE_RE = /^aida[-_]/i;
const LS_INCLUDE_EXTRA = new Set(['accountActiveTab']);
const LS_EXCLUDE = new Set([
    'aidaToken', 'aidaTokenExpiry', 'aidaUser',
    'aida-drive-token', 'aida-drive-token-expiry', 'aida-drive-last-synced-at',
    'aida_pre_payment_balance', 'aida-is-open',
    'aida-active-profile', 'aida-device-id', 'aida-device-label',
]);
const SESSION_KEYS = ['aida-current-session-id'];

const nowIso = () => new Date().toISOString();
const tsNum = (v) => { const t = new Date(v || 0).getTime(); return Number.isFinite(t) ? t : 0; };

export const chatLastActivity = (chat) => Math.max(
    tsNum(chat?.updatedAt),
    tsNum(chat?.createdAt),
    ...(chat?.messages || []).map(m => tsNum(m?.timestamp)),
    0,
);

const sanitizeChats = (chats = []) => chats.map(chat => ({
    ...chat,
    messages: (chat.messages || []).map(msg => ({
        ...msg,
        images: (msg.images || []).map(img => ({
            id: img.id, name: img.name,
            src: (img.src || '').startsWith('data:') ? '' : img.src,
        })),
        attachments: (msg.attachments || []).map(att => {
            if (att.type === 'image' && (att.src || '').startsWith('data:')) return { ...att, src: '' };
            if (att.type === 'text' && (att.content || '').length > 100_000) {
                return { ...att, content: att.content.slice(0, 100_000) + '\n[truncated for sync]' };
            }
            return att;
        }),
    })),
}));

const readManagedLocalStorage = () => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (LS_EXCLUDE.has(key)) continue;
        if (LS_INCLUDE_RE.test(key) || LS_INCLUDE_EXTRA.has(key)) {
            out[key] = localStorage.getItem(key);
        }
    }
    return out;
};

export const harvest = async (profileRecord) => {
    const now = nowIso();
    const prevConfig = profileRecord.lastSyncedConfig || {};
    const currentConfig = readManagedLocalStorage();

    const config = {};
    for (const [key, v] of Object.entries(currentConfig)) {
        config[key] = (prevConfig[key] && prevConfig[key].v === v && prevConfig[key].t)
            ? { v, t: prevConfig[key].t }
            : { v, t: now };
    }
    for (const key of Object.keys(prevConfig)) {
        if (!(key in currentConfig) && prevConfig[key].v !== null) {
            config[key] = { v: null, t: now };
        }
    }

    const [chats, projects] = await Promise.all([db.chats.toArray(), db.projects.toArray()]);

    const tombMap = new Map((profileRecord.tombstones || []).map(t => [`${t.kind}:${t.id}`, t]));
    const currentChatIds = new Set(chats.map(c => c.id));
    for (const id of profileRecord.lastSyncedChatIds || []) {
        if (!currentChatIds.has(id)) {
            const k = `chat:${id}`;
            if (!tombMap.has(k)) tombMap.set(k, { id, kind: 'chat', deletedAt: now });
        }
    }
    const cutoff = Date.now() - TOMBSTONE_TTL_MS;
    const tombstones = [...tombMap.values()].filter(t => tsNum(t.deletedAt) >= cutoff);

    const session = {};
    for (const k of SESSION_KEYS) {
        const v = sessionStorage.getItem(k);
        if (v !== null) session[k] = v;
    }

    return {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        profileId: profileRecord.id,
        exportedAt: now,
        config,
        session,
        idb: { chats: sanitizeChats(chats), projects },
        tombstones,
    };
};

const mergeMessages = (a = [], b = []) => {
    if (![...a, ...b].every(m => m && m.id != null)) {
        return b.length >= a.length ? b : a;
    }
    const byId = new Map();
    for (const m of [...a, ...b]) {
        const prev = byId.get(m.id);
        if (!prev || tsNum(m.timestamp) >= tsNum(prev.timestamp)) byId.set(m.id, m);
    }
    return [...byId.values()].sort((x, y) => tsNum(x.timestamp) - tsNum(y.timestamp));
};

const mergeChat = (local, remote) => {
    const newer = chatLastActivity(remote) >= chatLastActivity(local) ? remote : local;
    return { ...newer, messages: mergeMessages(local.messages, remote.messages) };
};

export const mergeSnapshots = (local, remote) => {
    const config = {};
    for (const key of new Set([...Object.keys(local.config || {}), ...Object.keys(remote.config || {})])) {
        const a = local.config?.[key], b = remote.config?.[key];
        const winner = !a ? b : !b ? a : (tsNum(a.t) >= tsNum(b.t) ? a : b);
        if (winner) config[key] = winner;
    }

    const tombMap = new Map();
    for (const t of [...(local.tombstones || []), ...(remote.tombstones || [])]) {
        const k = `${t.kind}:${t.id}`;
        const prev = tombMap.get(k);
        if (!prev || tsNum(t.deletedAt) > tsNum(prev.deletedAt)) tombMap.set(k, t);
    }
    const tombFor = (kind, id) => tombMap.get(`${kind}:${id}`);

    const localChats = new Map((local.idb?.chats || []).map(c => [c.id, c]));
    const remoteChats = new Map((remote.idb?.chats || []).map(c => [c.id, c]));
    const chats = [];
    for (const id of new Set([...localChats.keys(), ...remoteChats.keys()])) {
        const l = localChats.get(id), r = remoteChats.get(id);
        const candidate = l && r ? mergeChat(l, r) : (l || r);
        if (!candidate) continue;
        const tomb = tombFor('chat', id);
        if (tomb && tsNum(tomb.deletedAt) >= chatLastActivity(candidate)) continue;
        chats.push(candidate);
    }

    const localProjects = new Map((local.idb?.projects || []).map(p => [p.id, p]));
    const remoteProjects = new Map((remote.idb?.projects || []).map(p => [p.id, p]));
    const projects = [];
    for (const id of new Set([...localProjects.keys(), ...remoteProjects.keys()])) {
        const l = localProjects.get(id), r = remoteProjects.get(id);
        if (!l) projects.push(r);
        else if (!r) projects.push(l);
        else projects.push(tsNum(r.updatedAt) >= tsNum(l.updatedAt) ? r : l);
    }

    const newerSide = tsNum(remote.exportedAt) >= tsNum(local.exportedAt) ? remote : local;

    return {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        profileId: local.profileId,
        exportedAt: nowIso(),
        config,
        session: newerSide.session || {},
        idb: { chats, projects },
        tombstones: [...tombMap.values()],
    };
};

export const applySnapshot = async (snapshot) => {
    let configChanged = false;
    const entries = snapshot.config || {};

    const current = readManagedLocalStorage();
    for (const key of Object.keys(current)) {
        if (!(key in entries)) { localStorage.removeItem(key); configChanged = true; }
    }
    for (const [key, e] of Object.entries(entries)) {
        if (e.v === null) {
            if (localStorage.getItem(key) !== null) { localStorage.removeItem(key); configChanged = true; }
        } else if (localStorage.getItem(key) !== e.v) {
            localStorage.setItem(key, e.v); configChanged = true;
        }
    }

    for (const [k, v] of Object.entries(snapshot.session || {})) {
        sessionStorage.setItem(k, v);
    }

    const tombstonedChatIds = (snapshot.tombstones || [])
        .filter(t => t.kind === 'chat')
        .map(t => t.id);

    if (snapshot.idb?.chats?.length) await db.chats.bulkPut(snapshot.idb.chats);
    if (snapshot.idb?.projects?.length) await db.projects.bulkPut(snapshot.idb.projects);
    if (tombstonedChatIds.length) await db.chats.bulkDelete(tombstonedChatIds);

    return { configChanged, chatsApplied: snapshot.idb?.chats?.length || 0 };
};

export const computeLocalSignature = async () => {
    const meta = await db.chats.getMeta();
    const configStr = JSON.stringify(readManagedLocalStorage());
    let h = 5381;
    for (let i = 0; i < configStr.length; i++) h = ((h << 5) + h + configStr.charCodeAt(i)) >>> 0;
    return `${meta.count}:${meta.msgs}:${meta.maxTs}:${h}`;
};