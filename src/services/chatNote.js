// src/services/chatNote.js
//
// Shared helpers for identifying AIDA chat notes stored in the PKB
// database WITHOUT parsing their full JSON content.
//
// Chat content is always JSON whose first key is "schema": "aida/chat".
// It is written in two layouts:
//   compact: {"schema":"aida/chat","version":1,...}        (adapter, quick start)
//   pretty:  {\n  "schema": "aida/chat",\n  ...            (migration, sync merge)
// Checking the first characters avoids JSON.parse on potentially
// megabyte-sized documents just to classify them.

export const CHAT_SCHEMA = 'aida/chat';

const MARKER_COMPACT = '"schema":"aida/chat"';
const MARKER_PRETTY = '"schema": "aida/chat"';
const HEAD_LENGTH = 120;

export const isChatContent = (content) => {
    if (typeof content !== 'string' || content.length === 0) return false;
    const head = content.length > HEAD_LENGTH ? content.slice(0, HEAD_LENGTH) : content;
    return head.includes(MARKER_COMPACT) || head.includes(MARKER_PRETTY);
};