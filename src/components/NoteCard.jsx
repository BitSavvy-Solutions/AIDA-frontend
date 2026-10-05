// src/components/NoteCard.jsx
import React from 'react';
import { FiChevronRight, FiClock, FiCheckSquare, FiSquare } from 'react-icons/fi';

const CONTEXT_WORDS = 6;
const MAX_VISIBLE_MATCHES = 3;
const MAX_MATCHES_PER_NOTE = 20;

// Helpers
export const parseNoteContent = (note) => {
    try {
        const parsed = JSON.parse(note.content || '{}');
        if (parsed.schema === 'aida/chat' && Array.isArray(parsed.messages)) {
            return { kind: 'chat', messages: parsed.messages };
        }
    } catch { /* not JSON */ }
    return { kind: 'note', messages: [] };
};

export const noteLastActivity = (note) => {
    if (note.kind === 'note') {
        const { messages } = parseNoteContent(note);
        let ts = 0;
        for (const m of messages) {
            const t = new Date(m.timestamp || m.createdAt || m.time || 0).getTime();
            if (Number.isFinite(t)) ts = Math.max(ts, t);
        }
        return ts || new Date(note.created || 0).getTime();
    }
    return new Date(note.modified || note.created || 0).getTime();
};

export const formatRelativeTime = (ts) => {
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

export const findMessageMatches = (note, query, lowerMessages) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
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
    onOpenChat,
}) {
    const { kind, messages } = parseNoteContent(note);
    const isChat = kind === 'chat';
    const firstUser = isChat
        ? messages.find((m) => m.sender === 'user' && (m.text || '').trim())
        : null;
    const preview = firstUser?.text?.slice(0, 150) || (note.content || '').slice(0, 150);
    const msgCount = messages.length;
    const visibleMatches = isExpanded ? matches : matches.slice(0, MAX_VISIBLE_MATCHES);
    const capped = matches.length >= MAX_MATCHES_PER_NOTE;

    const handleClick = () => {
        if (selectionMode) {
            onToggleSelected(note.id);
        } else {
            onOpenChat(note.id);
        }
    };

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter') handleClick();
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
                <span className="flex items-center gap-1"><FiClock className="w-3 h-3" /> {formatRelativeTime(noteLastActivity(note))}</span>
                {isChat && <span>{msgCount} message{msgCount !== 1 ? 's' : ''}</span>}
                {!isChat && note.resourceIds?.length > 0 && <span>{note.resourceIds.length} attachment{note.resourceIds.length !== 1 ? 's' : ''}</span>}
                {hasQuery && matches.length > 0 && (
                    <span className="text-aida-pink font-medium">{matches.length}{capped ? '+' : ''} match{matches.length !== 1 ? 'es' : ''}</span>
                )}
            </div>
        </div>
    );
});

export default NoteCard;