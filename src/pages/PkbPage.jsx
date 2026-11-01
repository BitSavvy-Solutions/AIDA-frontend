// src/pages/PkbPage.jsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    FiSearch, FiCalendar, FiTag, FiX,
    FiMessageSquare, FiFilter, FiRefreshCw, FiChevronDown,
    FiCheckSquare, FiSquare, FiPlus, FiCheck, FiLoader,
    FiTrash2, FiLock, FiKey,
} from 'react-icons/fi';

import { useAuth } from '../contexts/AuthContext';
import { usePkbSync } from '../contexts/PkbSyncContext';
import {
    db as pkbDb,
    uid,
} from '../services/pkbSync';
import { isChatContent } from '../services/chatNote';
import ChatList from '../components/ChatList';
import { parseNoteContent, findMessageMatches } from '../components/NoteCard';

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

const PAGE_SIZE = 25;
const EMPTY_META = [];
const EMPTY_MATCHES_MAP = {};

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
    const { isAuthenticated } = useAuth();
    const {
        vaultExists, dek, syncStatus, syncNow, lockVault, requestSync,
    } = usePkbSync();

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

    // ───────────────────────────────────────────────────────────────────────────
    // Data layer
    //
    // Only lightweight metadata is retained for the full note set. Full
    // note documents (which contain entire chat transcripts) are loaded
    // exclusively for the currently visible page, and transiently while
    // a search query is active.
    // ───────────────────────────────────────────────────────────────────────────

    const notesMeta = useLiveQuery(async () => {
        const notes = await pkbDb.docs
            .where('kind')
            .equals('note')
            .and((n) => !n.deleted)
            .toArray();

        return notes.map((n) => ({
            id: n.id,
            title: n.title || '',
            tagIds: n.tagIds || [],
            resourceIds: n.resourceIds || [],
            modified: n.modified || '',
            created: n.created || '',
            ts: Date.parse(n.modified || n.created || '') || 0,
        }));
    }, []);

    const meta = notesMeta || EMPTY_META;
    const isLoading = notesMeta === undefined;

    const allTags = useLiveQuery(
        () => pkbDb.docs.where('kind').equals('tag').and((t) => !t.deleted).sortBy('title'),
        []
    ) || [];

    const tagById = useMemo(() => {
        const map = new Map();
        for (const tag of allTags) map.set(tag.id, tag);
        return map;
    }, [allTags]);

    const dateRange = useMemo(() => getDateRangeFromPreset(datePreset, customRange), [datePreset, customRange]);

    const hasQuery = Boolean(debouncedQuery.trim());

    // Full-content search scan. Runs ONLY while a query is active and
    // retains only the match snippets, never the note contents.
    //
    // note: `notesMeta` is deliberately NOT a dependency here. useLiveQuery
    // already watches the underlying Dexie table, so adding the metadata
    // array caused a re-scan of every note on every mutation.
    const searchData = useLiveQuery(async () => {
        const q = debouncedQuery.trim().toLowerCase();
        if (!q) return null;

        const notes = await pkbDb.docs
            .where('kind')
            .equals('note')
            .and((n) => !n.deleted)
            .toArray();

        const matchingIds = new Set();
        const matchesMap = {};

        for (const note of notes) {
            const titleHit = (note.title || '').toLowerCase().includes(q);
            let matches = null;

            if (isChatContent(note.content)) {
                const { messages } = parseNoteContent(note);
                const lowerMessages = messages.map((m) => (m.text || '').toLowerCase());
                const found = findMessageMatches(note, debouncedQuery, lowerMessages);
                if (found.length > 0) matches = found;
            }

            if (titleHit || matches) {
                matchingIds.add(note.id);
                if (matches) matchesMap[note.id] = matches;
            }
        }

        return { matchingIds, matchesMap };
    }, [debouncedQuery]);

    // Message counts are parsed only when the "Most messages" sort is active.
    // Same reasoning as above: no `notesMeta` dependency.
    const messageCounts = useLiveQuery(async () => {
        if (sort !== 'mostMessages') return null;

        const counts = {};
        const notes = await pkbDb.docs
            .where('kind')
            .equals('note')
            .and((n) => !n.deleted)
            .toArray();

        for (const note of notes) {
            if (!isChatContent(note.content)) {
                counts[note.id] = 0;
                continue;
            }
            try {
                const parsed = JSON.parse(note.content);
                counts[note.id] = Array.isArray(parsed.messages) ? parsed.messages.length : 0;
            } catch {
                counts[note.id] = 0;
            }
        }
        return counts;
    }, [sort]);

    const filteredMeta = useMemo(() => {
        let result = meta;

        if (dateRange.start !== null) {
            result = result.filter((n) => n.ts >= dateRange.start);
        }
        if (dateRange.end !== null) {
            result = result.filter((n) => n.ts <= dateRange.end);
        }

        if (selectedTagIds.size > 0) {
            result = result.filter((n) => [...selectedTagIds].every((id) => n.tagIds.includes(id)));
        }

        if (hasQuery) {
            if (!searchData) return [];
            result = result.filter((n) => searchData.matchingIds.has(n.id));
        }

        return [...result].sort((a, b) => {
            switch (sort) {
                case 'oldest': return (a.modified || '').localeCompare(b.modified || '');
                case 'mostMessages': return (messageCounts?.[b.id] || 0) - (messageCounts?.[a.id] || 0);
                default: return b.ts - a.ts;
            }
        });
    }, [meta, dateRange, selectedTagIds, hasQuery, searchData, sort, messageCounts]);

    // Full documents for the visible page only (max PAGE_SIZE * page records).
    const pageIds = useMemo(() => {
        const limit = page * PAGE_SIZE;
        const ids = [];
        for (let i = 0; i < filteredMeta.length && i < limit; i += 1) {
            ids.push(filteredMeta[i].id);
        }
        return ids;
    }, [filteredMeta, page]);

    const pageIdsKey = useMemo(() => pageIds.join('\n'), [pageIds]);

    const pageNotesRaw = useLiveQuery(async () => {
        if (pageIds.length === 0) return [];
        const docs = await pkbDb.docs.bulkGet(pageIds);
        return docs.filter(Boolean);
    }, [pageIdsKey]);

    const pageNotes = pageNotesRaw || [];

    const matchesMap = searchData?.matchesMap || EMPTY_MATCHES_MAP;

    // Prune selected ids that no longer exist
    useEffect(() => {
        setSelectedNoteIds((prev) => {
            if (prev.size === 0) return prev;
            const existing = new Set(meta.map((n) => n.id));
            const next = new Set([...prev].filter((id) => existing.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [meta]);

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

    const allFilteredSelected = filteredMeta.length > 0 && filteredMeta.every((n) => selectedNoteIds.has(n.id));

    const toggleSelectAll = useCallback(() => {
        setSelectedNoteIds((prev) => {
            if (allFilteredSelected) {
                const next = new Set(prev);
                filteredMeta.forEach((n) => next.delete(n.id));
                return next;
            }
            return new Set([...prev, ...filteredMeta.map((n) => n.id)]);
        });
    }, [allFilteredSelected, filteredMeta]);

    const handleApplyTags = useCallback(async (tagIds) => {
        const ids = [...selectedNoteIds];
        if (ids.length === 0 || tagIds.length === 0) return;
        await Promise.all(ids.map(async (noteId) => {
            const note = await pkbDb.docs.get(noteId);
            if (!note) return;
            const current = new Set(note.tagIds || []);
            tagIds.forEach((id) => current.add(id));
            await pkbDb.docs.update(noteId, { tagIds: [...current], dirty: 1 });
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
        const deleting = new Set(ids);
        const metaById = new Map(meta.map((n) => [n.id, n]));

        for (const id of ids) {
            const noteMeta = metaById.get(id);
            if (!noteMeta) continue;

            await pkbDb.docs.update(id, { deleted: 1, dirty: 1, modified: now });

            // A resource is orphaned when no surviving note references it.
            const orphanIds = (noteMeta.resourceIds || []).filter((resourceId) => {
                return !meta.some((item) =>
                    item.id !== id &&
                    !deleting.has(item.id) &&
                    (item.resourceIds || []).includes(resourceId)
                );
            });

            for (const rid of orphanIds) {
                await pkbDb.docs.update(rid, { deleted: 1, dirty: 1, modified: now });
            }
        }

        setToast(`Deleted ${ids.length} item${ids.length !== 1 ? 's' : ''}`);
        exitSelection();
        requestSync(500);
    }, [selectedNoteIds, exitSelection, requestSync, meta]);

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

    const hasMore = filteredMeta.length > page * PAGE_SIZE;
    const isSearching =
        searchQuery.trim() !== debouncedQuery.trim() ||
        (hasQuery && searchData === undefined);

    return (
        <div className="min-h-screen bg-aida-light">
            {/* Header */}
            <div className="border-b border-aida-border bg-aida-card px-4 py-3">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-lg font-bold text-aida-dark">Personal Knowledge Bank</h1>
                        <p className="text-xs text-aida-text-muted">
                            {filteredMeta.length} item{filteredMeta.length !== 1 ? 's' : ''}
                            {meta.length !== filteredMeta.length && ` of ${meta.length}`}
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
                ) : meta.length === 0 ? (
                    <div className="text-center py-20">
                        <FiMessageSquare className="mx-auto w-12 h-12 text-aida-text-muted mb-4 opacity-20" />
                        <h3 className="text-lg font-semibold text-aida-dark mb-2">No notes yet</h3>
                        <p className="text-sm text-aida-text-muted max-w-sm mx-auto">Chat history will appear here after migration.</p>
                    </div>
                ) : filteredMeta.length === 0 && !isSearching ? (
                    <div className="text-center py-20">
                        <FiSearch className="mx-auto w-12 h-12 text-aida-text-muted mb-4 opacity-20" />
                        <h3 className="text-lg font-semibold text-aida-dark mb-2">No matches found</h3>
                        <button onClick={clearAllFilters} className="inline-flex items-center gap-2 px-5 py-2.5 border border-aida-border text-aida-dark text-sm font-medium rounded-xl hover:bg-aida-card"><FiRefreshCw className="w-4 h-4" /> Reset filters</button>
                    </div>
                ) : (
                    <>
                        <ChatList
                            notes={pageNotes}
                            tags={tagById}
                            onOpenChat={(id) => window.dispatchEvent(new CustomEvent('aida-open-chat', { detail: { chatId: id } }))}
                            selectionMode={selectionMode}
                            selectedIds={selectedNoteIds}
                            onToggleSelect={toggleNoteSelected}
                            onEnterSelection={enterSelection}
                            expandedMatches={expandedMatches}
                            onToggleMatches={toggleMatchesExpanded}
                            query={debouncedQuery}
                            matchesMap={matchesMap}
                            isLoading={false}
                            emptyMessage=""
                        />
                        {hasMore && (
                            <div className="py-4 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => p + 1)}
                                    disabled={pageNotesRaw === undefined}
                                    className="px-4 py-2 text-sm font-medium text-aida-pink hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Load more ({filteredMeta.length - pageNotes.length} remaining)
                                </button>
                            </div>
                        )}
                    </>
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
                            {allFilteredSelected ? 'Deselect all' : `Select all ${filteredMeta.length}`}
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