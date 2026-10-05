// src/components/ChatList.jsx
import React, { useMemo } from 'react';
import NoteCard from './NoteCard';

const getStartOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
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

const ChatList = ({
    notes,
    tags,
    onOpenChat,
    selectionMode = false,
    selectedIds = new Set(),
    onToggleSelect = () => {},
    onEnterSelection = () => {},
    expandedMatches = new Set(),
    onToggleMatches = () => {},
    query = '',
    matchesMap = {},
    maxItems,
    onShowMore,
    showMoreLabel = 'Show more',
    isLoading = false,
    emptyMessage = 'No chats found.',
}) => {
    const hasQuery = Boolean(query.trim());

    // Convert tags prop to a Map if it's not already
    const tagMap = useMemo(() => {
        if (tags instanceof Map) return tags;
        const map = new Map();
        if (Array.isArray(tags)) {
            tags.forEach((tag) => map.set(tag.id, tag));
        } else if (tags && typeof tags === 'object') {
            Object.values(tags).forEach((tag) => map.set(tag.id, tag));
        }
        return map;
    }, [tags]);

    // Group notes by date
    const groupedNotes = useMemo(() => {
        const groups = [];
        const indexByLabel = {};
        for (const note of notes) {
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
    }, [notes]);

    // Apply maxItems limit if provided
    const displayedGroups = useMemo(() => {
        if (!maxItems) return groupedNotes;
        let shown = 0;
        const result = [];
        for (const group of groupedNotes) {
            if (shown >= maxItems) break;
            const remaining = maxItems - shown;
            const visible = group.notes.slice(0, remaining);
            if (visible.length) {
                result.push({ ...group, notes: visible, total: group.notes.length });
                shown += visible.length;
            }
        }
        return result;
    }, [groupedNotes, maxItems]);

    const totalNotes = notes.length;
    const displayedCount = displayedGroups.reduce((sum, g) => sum + g.notes.length, 0);
    const hasMore = maxItems && totalNotes > displayedCount;

    if (isLoading) {
        return (
            <div className="text-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-aida-pink border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm text-aida-text-muted">Loading...</p>
            </div>
        );
    }

    if (notes.length === 0) {
        return (
            <div className="text-center py-8">
                <p className="text-sm text-aida-text-muted">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {displayedGroups.map((group) => (
                <div key={group.label}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-aida-text-muted mb-3 px-1">
                        {group.label} <span className="ml-2 font-normal normal-case text-aida-text-muted/50">({group.total || group.notes.length})</span>
                    </h3>
                    <div className="space-y-2">
                        {group.notes.map((note) => (
                            <NoteCard
                                key={note.id}
                                note={note}
                                tags={(note.tagIds || []).map((id) => tagMap.get(id)).filter(Boolean)}
                                matches={matchesMap[note.id] || []}
                                hasQuery={hasQuery}
                                query={query}
                                selectionMode={selectionMode}
                                isSelected={selectedIds.has(note.id)}
                                isExpanded={expandedMatches.has(note.id)}
                                onToggleSelected={onToggleSelect}
                                onEnterSelection={onEnterSelection}
                                onToggleMatches={onToggleMatches}
                                onOpenChat={onOpenChat}
                            />
                        ))}
                    </div>
                </div>
            ))}
            {hasMore && (
                <div className="flex justify-center pt-2">
                    <button
                        type="button"
                        onClick={onShowMore}
                        className="px-4 py-2 text-sm font-medium text-aida-pink hover:underline"
                    >
                        {showMoreLabel} ({totalNotes - displayedCount} more)
                    </button>
                </div>
            )}
        </div>
    );
};

// Helper needed for noteLastActivity (imported from NoteCard)
import { noteLastActivity } from './NoteCard';

export default ChatList;