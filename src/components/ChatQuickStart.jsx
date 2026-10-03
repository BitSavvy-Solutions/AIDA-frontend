// src/components/ChatQuickStart.jsx
import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db as pkbDb } from '../services/pkbSync';
import { FiPlus, FiBook, FiArrowRight } from 'react-icons/fi';

const MAX_TAGS = 10;

const parseChat = (note) => {
    try {
        const parsed = JSON.parse(note.content || '{}');
        return parsed.schema === 'aida/chat' && Array.isArray(parsed.messages);
    } catch {
        return false;
    }
};

/**
 * Compact quick-start strip for the homepage.
 * - Pick tags to organize (multi-select) to pre-tag a new chat.
 * - Start a New Chat creates an empty chat with the selected tags.
 * - View your Personal Knowledge Bank navigates to /pkb and shows chat count.
 */
const ChatQuickStart = () => {
    const navigate = useNavigate();
    const [selectedTags, setSelectedTags] = useState(() => new Set());
    const [starting, setStarting] = useState(false);

    const tags = useLiveQuery(
        () => pkbDb.docs.where('kind').equals('tag').and((t) => !t.deleted).toArray(),
        []
    ) || [];

    const notes = useLiveQuery(
        () => pkbDb.docs.where('kind').equals('note').and((n) => !n.deleted).toArray(),
        []
    ) || [];

    const recentTags = useMemo(
        () =>
            [...tags]
                .sort((a, b) => (b.modified || '').localeCompare(a.modified || ''))
                .slice(0, MAX_TAGS),
        [tags]
    );

    const chatCount = useMemo(
        () => notes.filter((note) => parseChat(note)).length,
        [notes]
    );

    const toggleTag = useCallback((tagId) => {
        setSelectedTags((prev) => {
            const next = new Set(prev);
            if (next.has(tagId)) {
                next.delete(tagId);
            } else {
                next.add(tagId);
            }
            return next;
        });
    }, []);

    const startNewChat = useCallback(async () => {
        if (starting) return;
        setStarting(true);

        const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const nowIso = new Date().toISOString();

        await pkbDb.docs.put({
            id,
            kind: 'note',
            content: JSON.stringify({
                schema: 'aida/chat',
                version: 1,
                messages: [],
            }),
            contentFormat: 2,
            tagIds: [...selectedTags],
            resourceIds: [],
            created: nowIso,
            modified: nowIso,
            dirty: 1,
            deleted: 0,
        });

        window.AidaWidget?.openChat?.(id);

        setSelectedTags(new Set());
        setStarting(false);
    }, [selectedTags, starting]);

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            <div className="rounded-2xl border border-aida-border bg-aida-card p-5 sm:p-6 shadow-sm">
                {/* Tags section */}
                <div>
                    <p className="text-sm font-semibold text-aida-text-muted mb-3">
                        Pick tags to organize
                    </p>

                    {recentTags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {recentTags.map((tag) => {
                                const color = tag.iconColor || '#9CA3AF';
                                const isSelected = selectedTags.has(tag.id);
                                return (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => toggleTag(tag.id)}
                                        disabled={starting}
                                        title={`${isSelected ? 'Remove' : 'Add'} tag "${tag.title}"`}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                            isSelected
                                                ? 'ring-2 ring-offset-1 ring-aida-pink/60'
                                                : 'hover:-translate-y-0.5 hover:shadow-sm'
                                        }`}
                                        style={{
                                            borderColor: `${color}66`,
                                            color: color,
                                            backgroundColor: isSelected ? `${color}33` : `${color}14`,
                                        }}
                                    >
                                        <span
                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: color }}
                                        />
                                        <span className="truncate max-w-[140px]">{tag.title}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-aida-text-muted">
                            No tags yet. You can create tags inside a chat.
                        </p>
                    )}
                </div>

                {/* Start chat button, now below the tags */}
                <div className="mt-5 flex justify-center">
                    <button
                        type="button"
                        onClick={startNewChat}
                        disabled={starting}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-aida-pink text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg"
                    >
                        <FiPlus className="w-5 h-5 mr-2" />
                        Start a New Chat
                    </button>
                </div>

                {/* PKB link */}
                <button
                    type="button"
                    onClick={() => navigate('/pkb')}
                    disabled={starting}
                    className="mt-5 w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-aida-light border border-aida-border hover:border-aida-pink/40 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="flex items-center gap-3 min-w-0">
                        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-aida-pink/10 border border-aida-pink/20 flex-shrink-0">
                            <FiBook className="w-5 h-5 text-aida-pink" />
                        </span>
                        <span className="text-sm text-aida-text-muted">
                            View your{' '}
                            <span className="font-bold bg-gradient-to-r from-aida-pink to-rose-400 bg-clip-text text-transparent">
                                Personal Knowledge Bank
                            </span>{' '}
                            <span className="text-aida-text-muted/70">
                                ({chatCount} chat{chatCount !== 1 ? 's' : ''})
                            </span>
                        </span>
                    </span>
                    <FiArrowRight className="w-5 h-5 text-aida-text-muted group-hover:text-aida-pink group-hover:translate-x-1 transition-all flex-shrink-0" />
                </button>
            </div>
        </section>
    );
};

export default ChatQuickStart;