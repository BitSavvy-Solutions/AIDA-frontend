// src/pages/PkbPage.jsx
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    FiSearch, FiChevronRight, FiCalendar, FiTag, FiX,
    FiMessageSquare, FiClock, FiFilter, FiRefreshCw, FiChevronDown,
    FiCheckSquare, FiSquare, FiPlus, FiCheck, FiLoader,
    FiTrash2, FiLock, FiKey,
} from 'react-icons/fi';

import { useAuth } from '../contexts/AuthContext';
import { usePkbSync } from '../contexts/PkbSyncContext';
import { migrateWidgetChatsToPkb, getChatsMigrationStatus } from '../services/migrateChatsToPkb';
import {
    db as pkbDb,
    uid,
} from '../services/pkbSync';

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

const PAGE_SIZE = 25;
const EMPTY_TAGS = [];
const EMPTY_MATCHES = [];
const CONTEXT_WORDS = 6;
const MAX_VISIBLE_MATCHES = 3;
const MAX_MATCHES_PER_NOTE = 20;

const getStartOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const getEndOfDay = (date) => getStartOfDay(date) + 86400000;

const getDateRangeFromPreset = (preset, customRange) => {
    const now = new Date();
    const todayStart = getStartOfDay(now);
    switch (preset) {
        case 'today': return { start: todayStart, end: getEndOfDay(now) };
        case 'yesterday': return { start: todayStart - 86400000, end: todayStart };
        case 'last7': return { start: todayStart - 7 * 86400000, end: getEndOfDay(now) };
        case 'last30': return { start: todayStart - 30 * 86400000, end: getEndOfDay(now) };
        case 'thisMonth': return { start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), end: getEndOfDay(now) };
        case 'custom': return {
            start: customRange.start ? getStartOfDay(new Date(customRange.start)) : null,
            end: customRange.end ? getEndOfDay(new Date(customRange.end)) : null,
        };
        default: return { start: null, end: null };
    }
};

const getRelativeDateGroup = (timestampMs) => {
    const now = new Date();
    const todayStart = getStartOfDay(now);
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 7 * 86400000;

    if (timestampMs >= todayStart) return 'Today';
    if (timestampMs >= yesterdayStart) return 'Yesterday';
    if (timestampMs >= weekStart) return 'Past Week';

    return new Date(timestampMs).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
    });
};

const formatRelativeTime = (ts) => {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days <= 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
        value = value / 1024;
        index += 1;
    }
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const parseNoteContent = (note) => {
    try {
        const parsed = JSON.parse(note.content || '{}');
        if (parsed.schema === 'aida/chat' && Array.isArray(parsed.messages)) {
            return { kind: 'chat', messages: parsed.messages };
        }
    } catch { /* not JSON */ }
    return { kind: 'note', messages: [] };
};

const noteLastActivity = (note) => {
    let ts = new Date(note.modified || note.created || 0).getTime();
    if (note.kind === 'note') {
        const { messages } = parseNoteContent(note);
        for (const m of messages) {
            const t = new Date(m.timestamp || m.createdAt || m.time || 0).getTime();
            if (Number.isFinite(t)) ts = Math.max(ts, t);
        }
    }
    return ts;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Search snippets
// ═══════════════════════════════════════════════════════════════════════════════

const buildSnippet = (text, matchStart, matchLength) => {
    const matchEnd = matchStart + matchLength;
    const n = text.length;
    let i = matchStart;
    let count = 0;
    while (i > 0 && count < CONTEXT_WORDS) {
        while (i > 0 && text[i - 1] <= ' ') i--;
        while (i > 0 && text[i - 1] > ' ') i--;
        count++;
    }
    const start = i;
    let j = matchEnd;
    count = 0;
    while (j < n && count < CONTEXT_WORDS) {
        while (j < n && text[j] <= ' ') j++;
        while (j < n && text[j] > ' ') j++;
        count++;
    }
    const end = j;
    return {
        text: text.slice(start, end),
        matchStart: matchStart - start,
        matchEnd: matchEnd - start,
        isStartTruncated: start > 0,
        isEndTruncated: end < n,
    };
};

const findMessageMatches = (note, query, lowerMessages) => {
    const q = query.trim().toLowerCase();
    if (!q) return EMPTY_MATCHES;
    const { messages } = parseNoteContent(note);
    const results = [];
    outer:
    for (let idx = 0; idx < messages.length; idx++) {
        const lower = lowerMessages[idx] || '';
        if (!lower) continue;
        const text = messages[idx].text || '';
        let i = lower.indexOf(q);
        while (i !== -1) {
            results.push({
                msgIndex: idx,
                sender: messages[idx].sender,
                snippet: buildSnippet(text, i, q.length),
            });
            if (results.length >= MAX_MATCHES_PER_NOTE) break outer;
            i = lower.indexOf(q, i + q.length);
        }
    }
    return results;
};

const HighlightedText = ({ text = '', query }) => {
    const q = (query || '').trim();
    if (!q) return text;
    const lower = text.toLowerCase();
    const lq = q.toLowerCase();
    const parts = [];
    let i = 0;
    let k = 0;
    while (i < text.length) {
        const idx = lower.indexOf(lq, i);
        if (idx === -1) { parts.push(text.slice(i)); break; }
        if (idx > i) parts.push(text.slice(i, idx));
        parts.push(
            <mark key={k++} className="bg-aida-pink/25 text-aida-pink rounded px-0.5">
                {text.slice(idx, idx + q.length)}
            </mark>
        );
        i = idx + q.length;
    }
    return parts;
};

const MatchSnippet = ({ match }) => {
    const { snippet, sender } = match;
    const before = snippet.text.slice(0, snippet.matchStart);
    const hit = snippet.text.slice(snippet.matchStart, snippet.matchEnd);
    const after = snippet.text.slice(snippet.matchEnd);
    return (
        <div className="flex items-start gap-2">
            <span className={`flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${sender === 'user' ? 'bg-aida-pink/10 text-aida-pink' : 'bg-blue-500/10 text-blue-400'}`}>
                {sender === 'user' ? 'You' : 'AIDA'}
            </span>
            <p className="text-xs text-aida-text-muted leading-relaxed min-w-0 break-words">
                {snippet.isStartTruncated && <span className="text-aida-text-muted/50">... </span>}
                {before}
                <mark className="bg-aida-pink/25 text-aida-pink rounded px-0.5 font-medium">{hit}</mark>
                {after}
                {snippet.isEndTruncated && <span className="text-aida-text-muted/50"> ...</span>}
            </p>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Note card
// ═══════════════════════════════════════════════════════════════════════════════

const NoteCard = React.memo(function NoteCard({
    note,
    tags,
    matches,
    hasQuery,
    query,
    selectionMode,
    isSelected,
    isExpanded,
    onToggleSelected,
    onEnterSelection,
    onToggleMatches,
}) {
    const { kind, messages } = parseNoteContent(note);
    const isChat = kind === 'chat';
    const firstUser = isChat ? messages.find((m) => m.sender === 'user') : null;
    const preview = firstUser?.text?.slice(0, 150) || (note.content || '').slice(0, 150);
    const msgCount = messages.length;
    const visibleMatches = isExpanded ? matches : matches.slice(0, MAX_VISIBLE_MATCHES);
    const capped = matches.length >= MAX_MATCHES_PER_NOTE;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => {
                if (selectionMode) {
                    onToggleSelected(note.id);
                } else {
                    window.dispatchEvent(new CustomEvent('aida-open-chat', { detail: { chatId: note.id } }));
                }
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    if (selectionMode) {
                        onToggleSelected(note.id);
                    } else {
                        window.dispatchEvent(new CustomEvent('aida-open-chat', { detail: { chatId: note.id } }));
                    }
                }
            }}
            className={`w-full text-left p-4 rounded-xl border transition-all group cursor-pointer ${isSelected ? 'border-aida-pink/60 bg-aida-pink/5 shadow-sm' : 'border-aida-border bg-aida-card hover:border-aida-pink/30 hover:shadow-sm'}`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            selectionMode ? onToggleSelected(note.id) : onEnterSelection(note.id);
                        }}
                        className="flex-shrink-0 mt-0.5 text-aida-text-muted hover:text-aida-pink transition-opacity opacity-100"
                        aria-label={isSelected ? 'Deselect note' : 'Select note'}
                    >
                        {isSelected ? <FiCheckSquare className="w-4 h-4 text-aida-pink" /> : <FiSquare className="w-4 h-4" />}
                    </button>

                    <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-aida-dark truncate">
                            <HighlightedText text={note.title || 'Untitled'} query={query} />
                        </h4>
                        {!hasQuery && preview && (
                            <p className="text-xs text-aida-text-muted mt-1.5 line-clamp-2 leading-relaxed">
                                {preview}
                            </p>
                        )}

                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {tags.map((tag) => (
                                    <span
                                        key={tag.id}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-aida-light border border-aida-border text-aida-text-muted"
                                    >
                                        {tag.title}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <FiChevronRight className="w-4 h-4 text-aida-text-muted group-hover:text-aida-pink transition-colors flex-shrink-0 mt-1" />
            </div>

            {hasQuery && matches.length > 0 && (
                <div className="mt-3 pl-3 border-l-2 border-aida-pink/30 space-y-2">
                    {visibleMatches.map((m, i) => (
                        <MatchSnippet key={`${m.msgIndex}-${i}`} match={m} />
                    ))}
                    {matches.length > MAX_VISIBLE_MATCHES && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onToggleMatches(note.id); }}
                            className="text-[11px] font-medium text-aida-pink hover:underline"
                        >
                            {isExpanded ? 'Show fewer' : `Show all ${matches.length}${capped ? '+' : ''} matches`}
                        </button>
                    )}
                </div>
            )}

            {hasQuery && matches.length === 0 && isChat && (
                <p className="mt-2 text-[11px] italic text-aida-text-muted/70">Keyword found in the title</p>
            )}

            <div className="flex items-center gap-4 mt-3 text-[11px] text-aida-text-muted/60">
                <span className="flex items-center gap-1"><FiClock className="w-3 h-3" /> {formatRelativeTime(note.modified || note.created)}</span>
                {isChat && <span>{msgCount} message{msgCount !== 1 ? 's' : ''}</span>}
                {!isChat && note.resourceIds?.length > 0 && <span>{note.resourceIds.length} attachment{note.resourceIds.length !== 1 ? 's' : ''}</span>}
                {hasQuery && matches.length > 0 && (
                    <span className="text-aida-pink font-medium">{matches.length}{capped ? '+' : ''} match{matches.length !== 1 ? 'es' : ''}</span>
                )}
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Bulk tag modal
// ═══════════════════════════════════════════════════════════════════════════════

const BulkTagModal = ({ isOpen, onClose, tags, selectedNoteIds, onApply, onCreate }) => {
    const [checked, setChecked] = useState(() => new Set());
    const [newName, setNewName] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (isOpen) { setChecked(new Set()); setNewName(''); setBusy(false); }
    }, [isOpen]);

    if (!isOpen) return null;

    const toggle = (id) => {
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleApply = async () => {
        if (checked.size === 0 || busy) return;
        setBusy(true);
        try { await onApply([...checked]); onClose(); } finally { setBusy(false); }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const name = newName.trim();
        if (!name || busy) return;
        setBusy(true);
        try {
            const id = await onCreate(name);
            setChecked((prev) => new Set(prev).add(id));
            setNewName('');
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-aida-card rounded-xl shadow-2xl w-full max-w-sm border border-aida-border max-h-[90vh] overflow-y-auto my-auto">
                <div className="flex items-center justify-between p-4 border-b border-aida-border">
                    <h2 className="text-lg font-bold text-aida-dark flex items-center gap-2"><FiTag className="w-5 h-5 text-aida-pink" /> Add Tags</h2>
                    <button onClick={onClose} className="text-aida-text-muted hover:text-aida-dark"><FiX className="w-5 h-5" /></button>
                </div>
                <div className="p-4 space-y-4">
                    <p className="text-xs text-aida-text-muted">
                        Tag {selectedNoteIds.size} selected item{selectedNoteIds.size !== 1 ? 's' : ''}.
                    </p>
                    <form onSubmit={handleCreate} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Create a new tag..."
                            className="flex-1 px-3 py-2 rounded-lg border border-aida-border bg-aida-light text-aida-dark text-sm placeholder:text-aida-text-muted/50"
                        />
                        <button type="submit" disabled={!newName.trim() || busy} className="p-2 rounded-lg bg-aida-pink text-white hover:opacity-90 disabled:opacity-40">
                            <FiPlus className="w-4 h-4" />
                        </button>
                    </form>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                        {tags.length === 0 && <p className="text-xs text-aida-text-muted text-center py-4">No tags yet. Create your first one above.</p>}
                        {tags.map((tag) => {
                            const isChecked = checked.has(tag.id);
                            return (
                                <button key={tag.id} type="button" onClick={() => toggle(tag.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-all ${isChecked ? 'border-aida-pink/50 bg-aida-pink/5' : 'border-aida-border hover:border-aida-text-muted/30 hover:bg-aida-light'}`}>
                                    {isChecked ? <FiCheckSquare className="w-4 h-4 text-aida-pink flex-shrink-0" /> : <FiSquare className="w-4 h-4 text-aida-text-muted flex-shrink-0" />}
                                    <span className="flex-1 text-left text-aida-dark truncate">{tag.title}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex gap-3 pt-1">
                        <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-aida-border rounded-lg text-aida-dark text-sm font-medium hover:bg-aida-light">Cancel</button>
                        <button onClick={handleApply} disabled={checked.size === 0 || busy} className="flex-1 px-4 py-2.5 bg-aida-pink text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                            {busy ? 'Applying...' : `Apply${checked.size > 0 ? ` (${checked.size})` : ''}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════════════

const PkbPage = () => {
    const { user, isAuthenticated } = useAuth();
    const {
        vaultExists, dek, syncStatus, syncNow, lockVault, requestSync,
    } = usePkbSync();

    const [migrationStatus, setMigrationStatus] = useState('');

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [selectedTagIds, setSelectedTagIds] = useState(() => new Set());
    const [datePreset, setDatePreset] = useState('all');
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [sort, setSort] = useState('newest');
    const [showFilters, setShowFilters] = useState(false);

    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedNoteIds, setSelectedNoteIds] = useState(() => new Set());
    const [expandedMatches, setExpandedMatches] = useState(() => new Set());
    const [tagModalOpen, setTagModalOpen] = useState(false);
    const [toast, setToast] = useState(null);

    const [page, setPage] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const sentinelRef = useRef(null);

    // Clean up any legacy localStorage keys left by earlier implementations.
    useEffect(() => {
        Object.keys(localStorage).filter((k) => k.startsWith('pkbVaultId:')).forEach((k) => localStorage.removeItem(k));
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(searchQuery), 200);
        return () => clearTimeout(t);
    }, [searchQuery]);

    useEffect(() => { setPage(1); }, [debouncedQuery, selectedTagIds, datePreset, customRange, sort]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(t);
    }, [toast]);

    useEffect(() => {
        setExpandedMatches(new Set());
    }, [debouncedQuery]);

    // Open the global sync setup modal in the header.
    const openSyncSetup = () => {
        window.dispatchEvent(new CustomEvent('aida:open-enable-sync'));
    };

    // Data
    const rawNotes = useLiveQuery(() => pkbDb.docs.where('kind').equals('note').and((n) => !n.deleted).reverse().sortBy('modified'), []) || [];
    const allTags = useLiveQuery(() => pkbDb.docs.where('kind').equals('tag').and((t) => !t.deleted).sortBy('title'), []) || [];

    const tagById = useMemo(() => {
        const map = new Map();
        for (const tag of allTags) map.set(tag.id, tag);
        return map;
    }, [allTags]);

    const searchIndex = useMemo(() => {
        const map = {};
        for (const note of rawNotes) {
            const { kind, messages } = parseNoteContent(note);
            const lowerMessages = kind === 'chat' ? messages.map((m) => (m.text || '').toLowerCase()) : [];
            map[note.id] = {
                lowerTitle: (note.title || '').toLowerCase(),
                lowerMessages,
                haystack: lowerMessages.join('\n'),
            };
        }
        return map;
    }, [rawNotes]);

    const dateRange = useMemo(() => getDateRangeFromPreset(datePreset, customRange), [datePreset, customRange]);

    const filteredNotes = useMemo(() => {
        let result = [...rawNotes];

        if (dateRange.start !== null) {
            result = result.filter((n) => noteLastActivity(n) >= dateRange.start);
        }
        if (dateRange.end !== null) {
            result = result.filter((n) => noteLastActivity(n) <= dateRange.end);
        }

        if (selectedTagIds.size > 0) {
            result = result.filter((n) => [...selectedTagIds].every((id) => (n.tagIds || []).includes(id)));
        }

        const q = debouncedQuery.trim().toLowerCase();
        if (q) {
            result = result.filter((n) => {
                const idx = searchIndex[n.id];
                if (!idx) return false;
                return idx.lowerTitle.includes(q) || idx.haystack.includes(q);
            });
        }

        return result.sort((a, b) => {
            switch (sort) {
                case 'oldest': return (a.modified || '').localeCompare(b.modified || '');
                case 'mostMessages': {
                    const ma = parseNoteContent(a).messages.length;
                    const mb = parseNoteContent(b).messages.length;
                    return mb - ma;
                }
                default: return (b.modified || '').localeCompare(a.modified || '');
            }
        });
    }, [rawNotes, dateRange, selectedTagIds, debouncedQuery, sort, searchIndex]);

    const hasQuery = Boolean(debouncedQuery.trim());

    const groupedNotes = useMemo(() => {
        const groups = [];
        const indexByLabel = {};
        for (const note of filteredNotes) {
            const label = getRelativeDateGroup(noteLastActivity(note));
            let idx = indexByLabel[label];
            if (idx === undefined) {
                idx = groups.length;
                indexByLabel[label] = idx;
                groups.push({ label, notes: [] });
            }
            groups[idx].notes.push(note);
        }
        return groups;
    }, [filteredNotes]);

    const paginatedGroups = useMemo(() => {
        const maxNotes = page * PAGE_SIZE;
        let shown = 0;
        const result = [];
        for (const group of groupedNotes) {
            if (shown >= maxNotes) break;
            const remaining = maxNotes - shown;
            const visible = group.notes.slice(0, remaining);
            if (visible.length) {
                result.push({ ...group, notes: visible, total: group.notes.length });
                shown += visible.length;
            }
        }
        return result;
    }, [groupedNotes, page]);

    useEffect(() => { setIsLoadingMore(false); }, [paginatedGroups]);

    const hasMore = filteredNotes.length > page * PAGE_SIZE;
    const isSearching = searchQuery.trim() !== debouncedQuery.trim();
    const isLoading = rawNotes === undefined;

    useEffect(() => {
        if (!hasMore || isLoadingMore) return;
        const node = sentinelRef.current;
        if (!node) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) { setIsLoadingMore(true); setPage((p) => p + 1); }
        }, { rootMargin: '400px' });
        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMore, isLoadingMore]);

    const visibleNoteIds = useMemo(() => {
        const ids = new Set();
        paginatedGroups.forEach((g) => g.notes.forEach((n) => ids.add(n.id)));
        return ids;
    }, [paginatedGroups]);

    const matchesMap = useMemo(() => {
        if (!hasQuery) return {};
        const map = {};
        for (const note of filteredNotes) {
            if (!visibleNoteIds.has(note.id)) continue;
            map[note.id] = findMessageMatches(note, debouncedQuery, searchIndex[note.id]?.lowerMessages || EMPTY_MATCHES);
        }
        return map;
    }, [filteredNotes, debouncedQuery, hasQuery, searchIndex, visibleNoteIds]);

    // Prune selected ids that no longer exist
    useEffect(() => {
        setSelectedNoteIds((prev) => {
            if (prev.size === 0) return prev;
            const existing = new Set(rawNotes.map((n) => n.id));
            const next = new Set([...prev].filter((id) => existing.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [rawNotes]);

    // Escape exits selection
    useEffect(() => {
        if (!selectionMode) return;
        const handler = (e) => { if (e.key === 'Escape') exitSelection(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [selectionMode]);

    const toggleTag = useCallback((tagId) => {
        setSelectedTagIds((prev) => {
            const next = new Set(prev);
            if (next.has(tagId)) next.delete(tagId); else next.add(tagId);
            return next;
        });
    }, []);

    const clearAllFilters = useCallback(() => {
        setSearchQuery('');
        setDebouncedQuery('');
        setSelectedTagIds(new Set());
        setDatePreset('all');
        setCustomRange({ start: '', end: '' });
        setSort('newest');
    }, []);

    const toggleNoteSelected = useCallback((id) => {
        setSelectedNoteIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const enterSelection = useCallback((id) => {
        setSelectionMode(true);
        setSelectedNoteIds(new Set([id]));
    }, []);

    const exitSelection = useCallback(() => {
        setSelectionMode(false);
        setSelectedNoteIds(new Set());
    }, []);

    const allFilteredSelected = filteredNotes.length > 0 && filteredNotes.every((n) => selectedNoteIds.has(n.id));

    const toggleSelectAll = useCallback(() => {
        setSelectedNoteIds((prev) => {
            if (allFilteredSelected) {
                const next = new Set(prev);
                filteredNotes.forEach((n) => next.delete(n.id));
                return next;
            }
            return new Set([...prev, ...filteredNotes.map((n) => n.id)]);
        });
    }, [allFilteredSelected, filteredNotes]);

    const handleApplyTags = useCallback(async (tagIds) => {
        const ids = [...selectedNoteIds];
        if (ids.length === 0 || tagIds.length === 0) return;
        const now = new Date().toISOString();
        await Promise.all(ids.map(async (noteId) => {
            const note = await pkbDb.docs.get(noteId);
            if (!note) return;
            const current = new Set(note.tagIds || []);
            tagIds.forEach((id) => current.add(id));
            await pkbDb.docs.update(noteId, { tagIds: [...current], modified: now, dirty: 1 });
        }));
        setToast(`Added ${tagIds.length} tag${tagIds.length !== 1 ? 's' : ''} to ${ids.length} item${ids.length !== 1 ? 's' : ''}`);
        exitSelection();
        requestSync(500);
    }, [selectedNoteIds, exitSelection, requestSync]);

    const handleCreateTag = useCallback(async (name) => {
        const id = uid('tag');
        const now = new Date().toISOString();
        await pkbDb.docs.add({
            id,
            kind: 'tag',
            title: name,
            created: now,
            modified: now,
            dirty: 1,
            deleted: 0,
        });
        requestSync(500);
        return id;
    }, [requestSync]);

    const handleDeleteSelected = useCallback(async () => {
        const ids = [...selectedNoteIds];
        if (ids.length === 0) return;
        const confirmed = window.confirm(`Delete ${ids.length} selected item${ids.length !== 1 ? 's' : ''}? Attached files will be removed if unused.`);
        if (!confirmed) return;

        const now = new Date().toISOString();
        const allNotes = await pkbDb.docs.where('kind').equals('note').toArray();

        for (const id of ids) {
            const note = await pkbDb.docs.get(id);
            if (!note) continue;

            await pkbDb.docs.update(id, { deleted: 1, dirty: 1, modified: now });

            const orphanIds = (note.resourceIds || []).filter((resourceId) => {
                return !allNotes.some((item) => item.id !== id && !item.deleted && (item.resourceIds || []).includes(resourceId));
            });

            for (const rid of orphanIds) {
                await pkbDb.docs.update(rid, { deleted: 1, dirty: 1, modified: now });
            }
        }

        setToast(`Deleted ${ids.length} item${ids.length !== 1 ? 's' : ''}`);
        exitSelection();
        requestSync(500);
    }, [selectedNoteIds, exitSelection, requestSync]);

    const toggleMatchesExpanded = useCallback((id) => {
        setExpandedMatches((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const hasActiveFilters = searchQuery || selectedTagIds.size > 0 || datePreset !== 'all';

    const datePresets = [
        { value: 'all', label: 'All time' }, { value: 'today', label: 'Today' },
        { value: 'yesterday', label: 'Yesterday' }, { value: 'last7', label: 'Last 7 days' },
        { value: 'last30', label: 'Last 30 days' }, { value: 'thisMonth', label: 'This month' },
        { value: 'custom', label: 'Custom range' },
    ];

    const sortOptions = [
        { value: 'newest', label: 'Newest first' },
        { value: 'oldest', label: 'Oldest first' },
        { value: 'mostMessages', label: 'Most messages' },
    ];

    const statusMessage = syncStatus;

    return (
        <div className="min-h-screen bg-aida-light">
            {/* Header */}
            <div className="border-b border-aida-border bg-aida-card px-4 py-3">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-lg font-bold text-aida-dark">Personal Knowledge Base</h1>
                        <p className="text-xs text-aida-text-muted">
                            {filteredNotes.length} item{filteredNotes.length !== 1 ? 's' : ''}
                            {rawNotes.length !== filteredNotes.length && ` of ${rawNotes.length}`}
                            {isAuthenticated && ' • encrypted sync available'}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {statusMessage && (
                            <span className="rounded-lg border border-aida-border px-3 py-2 text-xs text-aida-text-muted">
                                {statusMessage}
                            </span>
                        )}
                        {!isAuthenticated && (
                            <div className="flex items-center gap-2 rounded-lg border border-aida-border px-3 py-2 text-xs text-aida-text-muted">
                                <FiLock /><span>Log in to enable encrypted sync</span>
                            </div>
                        )}
                        {isAuthenticated && !vaultExists && (
                            <button onClick={openSyncSetup} className="flex items-center gap-2 rounded-lg bg-aida-pink px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                                <FiKey /> Enable encrypted sync
                            </button>
                        )}
                        {isAuthenticated && vaultExists && !dek && (
                            <button onClick={openSyncSetup} className="flex items-center gap-2 rounded-lg bg-aida-pink px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                                <FiLock /> Unlock sync
                            </button>
                        )}
                        {dek && (
                            <>
                                <button onClick={() => syncNow()} className="flex items-center gap-2 rounded-lg border border-aida-border px-4 py-2 text-sm font-medium text-aida-dark hover:bg-aida-light">
                                    <FiRefreshCw /> Sync now
                                </button>
                                <button onClick={lockVault} className="flex items-center gap-2 rounded-lg border border-aida-border px-4 py-2 text-sm font-medium text-aida-dark hover:bg-aida-light">
                                    <FiLock /> Lock
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* Search & controls */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aida-text-muted" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search notes and chat history..."
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-aida-border bg-aida-card text-aida-dark text-sm focus:ring-2 focus:ring-aida-pink/30 focus:border-aida-pink/50 placeholder:text-aida-text-muted/50"
                        />
                        {isSearching ? (
                            <FiLoader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aida-pink animate-spin" />
                        ) : searchQuery ? (
                            <button onClick={() => { setSearchQuery(''); setDebouncedQuery(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-aida-text-muted hover:text-aida-dark"><FiX className="w-4 h-4" /></button>
                        ) : null}
                    </div>

                    <div className="relative">
                        <select value={sort} onChange={(e) => setSort(e.target.value)} className="appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-aida-border bg-aida-card text-aida-dark text-sm cursor-pointer focus:ring-2 focus:ring-aida-pink/30">
                            {sortOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-aida-text-muted pointer-events-none" />
                    </div>

                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${showFilters || hasActiveFilters ? 'border-aida-pink/50 bg-aida-pink/10 text-aida-pink' : 'border-aida-border bg-aida-card text-aida-text-muted hover:text-aida-dark'}`}
                    >
                        <FiFilter className="w-4 h-4" />
                        <span className="hidden sm:inline">Filters</span>
                        {hasActiveFilters && <span className="w-5 h-5 rounded-full bg-aida-pink text-white text-xs flex items-center justify-center">{selectedTagIds.size + (datePreset !== 'all' ? 1 : 0) + (searchQuery ? 1 : 0)}</span>}
                    </button>

                    <button
                        onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${selectionMode ? 'border-aida-pink/50 bg-aida-pink/10 text-aida-pink' : 'border-aida-border bg-aida-card text-aida-text-muted hover:text-aida-dark'}`}
                    >
                        <FiCheckSquare className="w-4 h-4" />
                        <span className="hidden sm:inline">{selectionMode ? 'Done' : 'Select'}</span>
                    </button>
                </div>

                {/* Filter panel */}
                {showFilters && (
                    <div className="p-4 rounded-xl border border-aida-border bg-aida-card space-y-4">
                        <div>
                            <div className="flex items-center gap-2 mb-3"><FiCalendar className="w-4 h-4 text-aida-text-muted" /><span className="text-sm font-semibold text-aida-dark">Date Range</span></div>
                            <div className="flex flex-wrap gap-2">
                                {datePresets.map((preset) => (
                                    <button key={preset.value} onClick={() => setDatePreset(preset.value)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${datePreset === preset.value ? 'border-aida-pink/50 bg-aida-pink/10 text-aida-pink' : 'border-aida-border text-aida-text-muted hover:text-aida-dark hover:border-aida-text-muted/30'}`}>
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                            {datePreset === 'custom' && (
                                <div className="flex items-center gap-2 mt-3">
                                    <input type="date" value={customRange.start} onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))} className="px-3 py-1.5 rounded-lg border border-aida-border bg-aida-light text-aida-dark text-xs dark:[color-scheme:dark]" />
                                    <span className="text-aida-text-muted text-xs">to</span>
                                    <input type="date" value={customRange.end} onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))} className="px-3 py-1.5 rounded-lg border border-aida-border bg-aida-light text-aida-dark text-xs dark:[color-scheme:dark]" />
                                </div>
                            )}
                        </div>

                        {allTags.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3"><FiTag className="w-4 h-4 text-aida-text-muted" /><span className="text-sm font-semibold text-aida-dark">Tags</span></div>
                                <div className="flex flex-wrap gap-2">
                                    {allTags.map((tag) => {
                                        const selected = selectedTagIds.has(tag.id);
                                        return (
                                            <button key={tag.id} onClick={() => toggleTag(tag.id)}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selected ? 'border-aida-pink/50 bg-aida-pink/10 text-aida-pink' : 'border-aida-border text-aida-text-muted hover:text-aida-dark hover:border-aida-text-muted/30'}`}>
                                                {tag.title}
                                                {selected && <FiX className="w-3 h-3" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {hasActiveFilters && (
                            <button onClick={clearAllFilters} className="flex items-center gap-1.5 text-xs text-aida-text-muted hover:text-aida-pink transition-colors">
                                <FiRefreshCw className="w-3 h-3" /> Clear all filters
                            </button>
                        )}
                    </div>
                )}

                {/* Active chips */}
                {!showFilters && hasActiveFilters && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {datePreset !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-aida-pink/10 border border-aida-pink/20 text-aida-pink text-xs font-medium">
                                <FiCalendar className="w-3 h-3" /> {datePresets.find((p) => p.value === datePreset)?.label}
                                <button onClick={() => setDatePreset('all')}><FiX className="w-3 h-3" /></button>
                            </span>
                        )}
                        {[...selectedTagIds].map((tagId) => {
                            const tag = tagById.get(tagId);
                            if (!tag) return null;
                            return (
                                <span key={tagId} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-aida-border bg-aida-light text-aida-text-muted">
                                    {tag.title}
                                    <button onClick={() => toggleTag(tagId)}><FiX className="w-3 h-3" /></button>
                                </span>
                            );
                        })}
                        <button onClick={clearAllFilters} className="text-xs text-aida-text-muted hover:text-aida-pink transition-colors ml-1">Clear all</button>
                    </div>
                )}

                {/* List */}
                {isLoading ? (
                    <div className="text-center py-20">
                        <FiLoader className="mx-auto w-12 h-12 text-aida-pink animate-spin mb-4" />
                        <h3 className="text-lg font-semibold text-aida-dark">Loading...</h3>
                    </div>
                ) : rawNotes.length === 0 ? (
                    <div className="text-center py-20">
                        <FiMessageSquare className="mx-auto w-12 h-12 text-aida-text-muted mb-4 opacity-20" />
                        <h3 className="text-lg font-semibold text-aida-dark mb-2">No notes yet</h3>
                        <p className="text-sm text-aida-text-muted max-w-sm mx-auto">Chat history will appear here after migration.</p>
                    </div>
                ) : filteredNotes.length === 0 && !isSearching ? (
                    <div className="text-center py-20">
                        <FiSearch className="mx-auto w-12 h-12 text-aida-text-muted mb-4 opacity-20" />
                        <h3 className="text-lg font-semibold text-aida-dark mb-2">No matches found</h3>
                        <button onClick={clearAllFilters} className="inline-flex items-center gap-2 px-5 py-2.5 border border-aida-border text-aida-dark text-sm font-medium rounded-xl hover:bg-aida-card"><FiRefreshCw className="w-4 h-4" /> Reset filters</button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {paginatedGroups.map((group) => (
                            <div key={group.label}>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-aida-text-muted mb-3 px-1">
                                    {group.label} <span className="ml-2 font-normal normal-case text-aida-text-muted/50">({group.total})</span>
                                </h3>
                                <div className="space-y-2">
                                    {group.notes.map((note) => (
                                        <NoteCard
                                            key={note.id}
                                            note={note}
                                            tags={(note.tagIds || []).map((id) => tagById.get(id)).filter(Boolean)}
                                            matches={matchesMap[note.id] || EMPTY_MATCHES}
                                            hasQuery={hasQuery}
                                            query={debouncedQuery}
                                            selectionMode={selectionMode}
                                            isSelected={selectedNoteIds.has(note.id)}
                                            isExpanded={expandedMatches.has(note.id)}
                                            onToggleSelected={toggleNoteSelected}
                                            onEnterSelection={enterSelection}
                                            onToggleMatches={toggleMatchesExpanded}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                        {hasMore && (
                            <div ref={sentinelRef} className="py-4 flex justify-center">
                                <div className="flex items-center gap-2 text-sm text-aida-text-muted"><FiLoader className="w-4 h-4 animate-spin text-aida-pink" /> Loading more...</div>
                            </div>
                        )}
                    </div>
                )}

                <div className={selectionMode ? 'h-24' : 'h-8'} />
            </div>

            {/* Modals */}
            <BulkTagModal
                isOpen={tagModalOpen}
                onClose={() => setTagModalOpen(false)}
                tags={allTags}
                selectedNoteIds={selectedNoteIds}
                onApply={handleApplyTags}
                onCreate={handleCreateTag}
            />

            {selectionMode && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1500] w-max max-w-[calc(100vw-2rem)]">
                    <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-aida-card border border-aida-border shadow-2xl">
                        <span className="text-sm font-semibold text-aida-dark px-1">{selectedNoteIds.size} selected</span>
                        <div className="hidden sm:block w-px h-5 bg-aida-border" />
                        <button onClick={toggleSelectAll} className="px-3 py-1.5 text-xs font-medium text-aida-text-muted hover:text-aida-dark rounded-lg hover:bg-aida-light">
                            {allFilteredSelected ? 'Deselect all' : `Select all ${filteredNotes.length}`}
                        </button>
                        <button onClick={() => setTagModalOpen(true)} disabled={selectedNoteIds.size === 0} className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-aida-pink text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40">
                            <FiTag className="w-3.5 h-3.5" /> Add tags
                        </button>
                        <button onClick={handleDeleteSelected} disabled={selectedNoteIds.size === 0} className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-red-400 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-400/10 disabled:opacity-40">
                            <FiTrash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                        <button onClick={exitSelection} className="p-1.5 text-aida-text-muted hover:text-aida-dark rounded-lg hover:bg-aida-light" title="Exit selection"><FiX className="w-4 h-4" /></button>
                    </div>
                </div>
            )}

            {toast && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[2500]">
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-aida-dark text-aida-light text-sm font-medium shadow-2xl">
                        <FiCheck className="w-4 h-4 text-green-400" /> {toast}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PkbPage;