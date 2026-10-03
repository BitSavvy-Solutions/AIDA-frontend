// src/services/pkbMemoryAdapter.js
import { liveQuery } from 'dexie';
import { db as pkbDb, uid } from './pkbSync';

const CHAT_SCHEMA = 'aida/chat';

// Helper: parse chat messages from a note's content
const parseChatContent = (note) => {
    try {
        const parsed = JSON.parse(note.content || '{}');
        if (parsed.schema === CHAT_SCHEMA && Array.isArray(parsed.messages)) {
            return parsed.messages;
        }
    } catch {
        // ignore malformed content
    }
    return [];
};

// Helper: convert a PKB note to a widget session object
const noteToSession = (note) => ({
    id: note.id,
    title: note.title || 'Untitled',
    updatedAt: note.modified || note.created || new Date().toISOString(),
});

// Helper: convert a PKB tag to a widget project object
const tagToProject = (tag) => ({
    id: tag.id,
    title: tag.title,
    iconKey: tag.iconKey || 'notebook',
    iconColor: tag.iconColor || '#9CA3AF',
});

export const createPkbMemoryAdapter = () => {
    const subscribers = new Set();
    const notify = () => subscribers.forEach((fn) => fn());

    // Set up a liveQuery that fires on any PKB document change
    const subscription = liveQuery(() => pkbDb.docs.toArray()).subscribe({
        next: () => notify(),
        error: (err) => console.error('PKB liveQuery error:', err),
    });

    return {
        subscribe(callback) {
            subscribers.add(callback);
            return () => subscribers.delete(callback);
        },

        async listSessions() {
            const notes = await pkbDb.docs
                .where('kind')
                .equals('note')
                .and((n) => !n.deleted)
                .toArray();

            return notes
                .filter((note) => {
                    try {
                        const parsed = JSON.parse(note.content || '{}');
                        return parsed.schema === CHAT_SCHEMA;
                    } catch {
                        return false;
                    }
                })
                .map(noteToSession)
                .sort((a, b) =>
                    (b.updatedAt || '').localeCompare(a.updatedAt || '')
                );
        },

        async listTags() {
            const tags = await pkbDb.docs
                .where('kind')
                .equals('tag')
                .and((t) => !t.deleted)
                .toArray();
            return tags.map(tagToProject);
        },

        async getSessionMeta(sessionId) {
            const note = await pkbDb.docs.get(sessionId);
            if (!note || note.deleted) return null;
            return {
                id: note.id,
                title: note.title,
                tagIds: note.tagIds || [],
            };
        },

        async getMessages(sessionId) {
            const note = await pkbDb.docs.get(sessionId);
            if (!note || note.deleted) return [];
            return parseChatContent(note);
        },

        async createSession({ id, title, messages }) {
            const now = new Date().toISOString();
            const note = {
                id,
                kind: 'note',
                title: title || 'New Chat',
                content: JSON.stringify({
                    schema: CHAT_SCHEMA,
                    version: 1,
                    messages,
                }),
                contentFormat: 2,
                tagIds: [],
                resourceIds: [],
                created: now,
                modified: now,
                dirty: 1,
                deleted: 0,
            };
            await pkbDb.docs.put(note);
            notify();
            return id;
        },

        async updateSession(sessionId, { messages }) {
            const note = await pkbDb.docs.get(sessionId);
            if (!note) return;
            const now = new Date().toISOString();
            const parsed = JSON.parse(note.content || '{}');
            parsed.messages = messages;
            await pkbDb.docs.update(sessionId, {
                content: JSON.stringify(parsed),
                modified: now,
                dirty: 1,
            });
            notify();
        },

        async renameSession(sessionId, newTitle) {
            await pkbDb.docs.update(sessionId, {
                title: newTitle,
                modified: new Date().toISOString(),
                dirty: 1,
            });
            notify();
        },

        async deleteSession(sessionId) {
            await pkbDb.docs.update(sessionId, {
                deleted: 1,
                dirty: 1,
                modified: new Date().toISOString(),
            });
            notify();
        },

        async createTag(name) {
            const now = new Date().toISOString();
            const id = uid('tag');
            await pkbDb.docs.add({
                id,
                kind: 'tag',
                title: name,
                iconKey: 'notebook',
                iconColor: '#9CA3AF',
                created: now,
                modified: now,
                dirty: 1,
                deleted: 0,
            });
            notify();
            return id;
        },

        async assignTag(chatId, tagId) {
            const note = await pkbDb.docs.get(chatId);
            if (!note) return;
            const tagIds = new Set(note.tagIds || []);
            tagIds.add(tagId);
            await pkbDb.docs.update(chatId, {
                tagIds: [...tagIds],
                modified: new Date().toISOString(),
                dirty: 1,
            });
            notify();
        },

        async removeTag(chatId, tagId) {
            const note = await pkbDb.docs.get(chatId);
            if (!note) return;
            const tagIds = (note.tagIds || []).filter((id) => id !== tagId);
            await pkbDb.docs.update(chatId, {
                tagIds,
                modified: new Date().toISOString(),
                dirty: 1,
            });
            notify();
        },

        async updateTag(tagId, updates) {
            const allowed = {};
            if (updates.iconKey !== undefined) allowed.iconKey = updates.iconKey;
            if (updates.iconColor !== undefined) allowed.iconColor = updates.iconColor;
            if (updates.title !== undefined) allowed.title = updates.title;
            await pkbDb.docs.update(tagId, {
                ...allowed,
                modified: new Date().toISOString(),
                dirty: 1,
            });
            notify();
        },

        async deleteTag(tagId) {
            // Mark tag as deleted
            await pkbDb.docs.update(tagId, {
                deleted: 1,
                dirty: 1,
                modified: new Date().toISOString(),
            });
            // Remove tag from all notes
            const notes = await pkbDb.docs
                .where('kind')
                .equals('note')
                .and((n) => !n.deleted)
                .toArray();
            await Promise.all(
                notes.map(async (note) => {
                    if ((note.tagIds || []).includes(tagId)) {
                        const newTagIds = note.tagIds.filter((id) => id !== tagId);
                        await pkbDb.docs.update(note.id, {
                            tagIds: newTagIds,
                            dirty: 1,
                            modified: new Date().toISOString(),
                        });
                    }
                })
            );
            notify();
        },
    };
};