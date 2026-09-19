// src/pages/PkbPage.jsx
import React, { useState, useEffect } from 'react';
import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    FiPlus,
    FiTag,
    FiFile,
    FiTrash2,
    FiUpload,
    FiLock,
} from 'react-icons/fi';

// Local only PKB database.
// Later, sync metadata can be added without changing the page structure.
const getDb = () => {
    if (!window.__pkbDb) {
        const db = new Dexie('pkb-local');

        db.version(1).stores({
            docs: 'id, kind, title, modified, *tagIds, *resourceIds',
            meta: 'key',
        });

        window.__pkbDb = db;
    }

    return window.__pkbDb;
};

const db = getDb();

const uid = (prefix) => {
    return `${prefix}_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;
};

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    if (!bytes) return '';

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let index = 0;

    while (value >= 1024 && index < units.length - 1) {
        value = value / 1024;
        index += 1;
    }

    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const AttachmentPreview = ({ attachment, onOpen }) => {
    const [url, setUrl] = useState('');

    useEffect(() => {
        if (!attachment?.blob) return;

        const objectUrl = URL.createObjectURL(attachment.blob);
        setUrl(objectUrl);

        return () => {
            setUrl('');
            URL.revokeObjectURL(objectUrl);
        };
    }, [attachment?.id, attachment?.blob]);

    if (!attachment?.mimeType?.startsWith('image/') || !url) {
        return null;
    }

    return (
        <img
            src={url}
            alt={attachment.title}
            onClick={onOpen}
            className="h-24 w-24 cursor-pointer rounded-lg border border-aida-border object-cover"
        />
    );
};

const PkbPage = () => {
    const [selectedTagId, setSelectedTagId] = useState('all');
    const [selectedNoteId, setSelectedNoteId] = useState('');
    const [newTagName, setNewTagName] = useState('');

    const tags =
        useLiveQuery(() => {
            return db.docs.where('kind').equals('tag').sortBy('title');
        }, []) || [];

    const notes =
        useLiveQuery(async () => {
            const rows = await db.docs.where('kind').equals('note').toArray();

            const filtered =
                selectedTagId === 'all'
                    ? rows
                    : rows.filter((note) =>
                          (note.tagIds || []).includes(selectedTagId)
                      );

            return filtered.sort((a, b) =>
                (b.modified || '').localeCompare(a.modified || '')
            );
        }, [selectedTagId]) || [];

    const note = useLiveQuery(async () => {
        if (!selectedNoteId) return undefined;
        return db.docs.get(selectedNoteId);
    }, [selectedNoteId]);

    const resourceIdsKey = (note?.resourceIds || []).join(',');

    const attachments =
        useLiveQuery(async () => {
            if (!resourceIdsKey) return [];

            const ids = resourceIdsKey.split(',');
            return db.docs.where('id').anyOf(ids).toArray();
        }, [resourceIdsKey]) || [];

    const createNote = async () => {
        const now = new Date().toISOString();
        const id = uid('note');

        await db.docs.add({
            id,
            kind: 'note',
            title: 'Untitled note',
            content: '',
            tagIds: selectedTagId === 'all' ? [] : [selectedTagId],
            resourceIds: [],
            created: now,
            modified: now,
        });

        setSelectedNoteId(id);
    };

    const createTag = async () => {
        const title = newTagName.trim();

        if (!title) return;

        const existing = tags.find(
            (tag) => tag.title.toLowerCase() === title.toLowerCase()
        );

        if (existing) {
            setSelectedTagId(existing.id);
            setNewTagName('');
            return;
        }

        const now = new Date().toISOString();
        const id = uid('tag');

        await db.docs.add({
            id,
            kind: 'tag',
            title,
            created: now,
            modified: now,
        });

        setSelectedTagId(id);
        setNewTagName('');
    };

    const updateNote = async (changes) => {
        if (!note) return;

        await db.docs.update(note.id, {
            ...changes,
            modified: new Date().toISOString(),
        });
    };

    const toggleTagOnNote = async (tagId) => {
        if (!note) return;

        const current = new Set(note.tagIds || []);

        if (current.has(tagId)) {
            current.delete(tagId);
        } else {
            current.add(tagId);
        }

        await updateNote({
            tagIds: Array.from(current),
        });
    };

    const deleteNote = async () => {
        if (!note) return;

        const confirmed = window.confirm(
            'Delete this note? Attached files will also be removed if they are not used by other notes.'
        );

        if (!confirmed) return;

        const resourceIds = note.resourceIds || [];

        const allNotes = await db.docs
            .where('kind')
            .equals('note')
            .toArray();

        const orphanResourceIds = resourceIds.filter((resourceId) => {
            return !allNotes.some((item) => {
                return (
                    item.id !== note.id &&
                    (item.resourceIds || []).includes(resourceId)
                );
            });
        });

        await db.docs.delete(note.id);

        if (orphanResourceIds.length) {
            await db.docs.bulkDelete(orphanResourceIds);
        }

        setSelectedNoteId('');
    };

    const attachFile = async (event) => {
        const file = event.target.files && event.target.files[0];

        if (!file || !note) return;

        const now = new Date().toISOString();
        const id = uid('res');

        await db.docs.add({
            id,
            kind: 'resource',
            title: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            blob: file,
            created: now,
            modified: now,
        });

        await updateNote({
            resourceIds: [...(note.resourceIds || []), id],
        });

        event.target.value = '';
    };

    const removeAttachment = async (resourceId) => {
        if (!note) return;

        const confirmed = window.confirm(
            'Remove this attachment? It will be deleted if no other note uses it.'
        );

        if (!confirmed) return;

        const remainingResourceIds = (note.resourceIds || []).filter(
            (id) => id !== resourceId
        );

        await updateNote({
            resourceIds: remainingResourceIds,
        });

        const allNotes = await db.docs
            .where('kind')
            .equals('note')
            .toArray();

        const stillUsed = allNotes.some((item) => {
            return (
                item.id !== note.id &&
                (item.resourceIds || []).includes(resourceId)
            );
        });

        if (!stillUsed) {
            await db.docs.delete(resourceId);
        }
    };

    const openAttachment = (attachment) => {
        if (!attachment?.blob) return;

        const url = URL.createObjectURL(attachment.blob);
        window.open(url, '_blank', 'noopener');

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 60000);
    };

    return (
        <div className="bg-aida-light min-h-screen">
            <div className="border-b border-aida-border bg-aida-card px-4 py-3">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
                    <div>
                        <h1 className="text-lg font-bold text-aida-dark">
                            PKB
                        </h1>
                        <p className="text-xs text-aida-text-muted">
                            Local browser notebook. Vault sync will be added
                            later.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-aida-border px-3 py-2 text-xs text-aida-text-muted">
                        <FiLock />
                        <span>Stored only in this browser</span>
                    </div>
                </div>
            </div>

            <div
                className="mx-auto flex max-w-7xl gap-4 p-4"
                style={{ height: 'calc(100vh - 130px)' }}
            >
                <aside className="w-64 flex-shrink-0 overflow-y-auto rounded-2xl border border-aida-border bg-aida-card p-4">
                    <button
                        onClick={createNote}
                        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-aida-pink px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                        <FiPlus />
                        New note
                    </button>

                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-aida-text-muted">
                        <FiTag />
                        Tags
                    </div>

                    <button
                        onClick={() => setSelectedTagId('all')}
                        className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm ${
                            selectedTagId === 'all'
                                ? 'bg-aida-pink/10 text-aida-pink'
                                : 'text-aida-text-muted hover:bg-aida-light'
                        }`}
                    >
                        All notes
                    </button>

                    {tags.map((tag) => (
                        <button
                            key={tag.id}
                            onClick={() => setSelectedTagId(tag.id)}
                            className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm ${
                                selectedTagId === tag.id
                                    ? 'bg-aida-pink/10 text-aida-pink'
                                    : 'text-aida-text-muted hover:bg-aida-light'
                            }`}
                        >
                            {tag.title}
                        </button>
                    ))}

                    <div className="mt-3 space-y-2">
                        <input
                            value={newTagName}
                            onChange={(event) =>
                                setNewTagName(event.target.value)
                            }
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    createTag();
                                }
                            }}
                            placeholder="New tag"
                            className="w-full rounded-lg border border-aida-border bg-transparent px-3 py-2 text-sm text-aida-dark"
                        />

                        <button
                            onClick={createTag}
                            className="w-full rounded-lg border border-aida-border px-3 py-2 text-sm text-aida-dark hover:bg-aida-light"
                        >
                            Add tag
                        </button>
                    </div>
                </aside>

                <section className="w-80 flex-shrink-0 overflow-y-auto rounded-2xl border border-aida-border bg-aida-card p-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-aida-text-muted">
                        Notes
                    </div>

                    {notes.length === 0 && (
                        <div className="text-sm text-aida-text-muted">
                            No notes yet. Create your first note.
                        </div>
                    )}

                    {notes.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setSelectedNoteId(item.id)}
                            className={`mb-2 w-full rounded-xl border px-4 py-3 text-left ${
                                selectedNoteId === item.id
                                    ? 'border-aida-pink/40 bg-aida-pink/10'
                                    : 'border-aida-border hover:bg-aida-light'
                            }`}
                        >
                            <div className="truncate text-sm font-semibold text-aida-dark">
                                {item.title || 'Untitled note'}
                            </div>

                            <div className="mt-1 truncate text-xs text-aida-text-muted">
                                {(item.content || '').slice(0, 90)}
                            </div>
                        </button>
                    ))}
                </section>

                <section className="flex-1 overflow-y-auto rounded-2xl border border-aida-border bg-aida-card p-4">
                    {!note ? (
                        <div className="flex h-full items-center justify-center text-sm text-aida-text-muted">
                            Select a note or create a new note.
                        </div>
                    ) : (
                        <div className="flex h-full flex-col">
                            <div className="mb-4 flex items-center justify-between gap-4">
                                <input
                                    value={note.title || ''}
                                    onChange={(event) =>
                                        updateNote({
                                            title: event.target.value,
                                        })
                                    }
                                    className="w-full rounded-lg border border-aida-border bg-transparent px-3 py-2 text-lg font-semibold text-aida-dark"
                                />

                                <button
                                    onClick={deleteNote}
                                    className="flex items-center gap-2 rounded-lg border border-red-400 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-400/10"
                                >
                                    <FiTrash2 />
                                    Delete
                                </button>
                            </div>

                            <div className="mb-4 flex flex-wrap gap-2">
                                {tags.length === 0 && (
                                    <div className="text-xs text-aida-text-muted">
                                        Create tags on the left to organize
                                        notes.
                                    </div>
                                )}

                                {tags.map((tag) => {
                                    const active = (
                                        note.tagIds || []
                                    ).includes(tag.id);

                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() =>
                                                toggleTagOnNote(tag.id)
                                            }
                                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                                active
                                                    ? 'border-aida-pink/40 bg-aida-pink/10 text-aida-pink'
                                                    : 'border-aida-border text-aida-text-muted hover:bg-aida-light'
                                            }`}
                                        >
                                            {tag.title}
                                        </button>
                                    );
                                })}
                            </div>

                            <textarea
                                value={note.content || ''}
                                onChange={(event) =>
                                    updateNote({
                                        content: event.target.value,
                                    })
                                }
                                placeholder="Write your note here..."
                                className="min-h-[280px] flex-1 resize-none rounded-xl border border-aida-border bg-transparent p-4 text-sm leading-6 text-aida-dark"
                            />

                            <div className="mt-4 rounded-xl border border-aida-border p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="text-sm font-semibold text-aida-dark">
                                        Attachments
                                    </div>

                                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-aida-border px-3 py-2 text-sm text-aida-dark hover:bg-aida-light">
                                        <FiUpload />
                                        Attach file
                                        <input
                                            type="file"
                                            onChange={attachFile}
                                            className="hidden"
                                        />
                                    </label>
                                </div>

                                {attachments.length === 0 ? (
                                    <div className="text-sm text-aida-text-muted">
                                        No attachments. Attach images, PDFs,
                                        or other files.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {attachments.map((attachment) => (
                                            <div
                                                key={attachment.id}
                                                className="rounded-lg border border-aida-border p-3"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <FiFile className="flex-shrink-0 text-aida-text-muted" />

                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-medium text-aida-dark">
                                                                {
                                                                    attachment.title
                                                                }
                                                            </div>

                                                            <div className="text-xs text-aida-text-muted">
                                                                {
                                                                    attachment.mimeType
                                                                }
                                                                {' • '}
                                                                {formatBytes(
                                                                    attachment.size
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-shrink-0 items-center gap-2">
                                                        <button
                                                            onClick={() =>
                                                                openAttachment(
                                                                    attachment
                                                                )
                                                            }
                                                            className="rounded-lg border border-aida-border px-3 py-1 text-xs text-aida-dark hover:bg-aida-light"
                                                        >
                                                            Open
                                                        </button>

                                                        <button
                                                            onClick={() =>
                                                                removeAttachment(
                                                                    attachment.id
                                                                )
                                                            }
                                                            className="rounded-lg border border-red-400 px-3 py-1 text-xs text-red-400 hover:bg-red-400/10"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="mt-3">
                                                    <AttachmentPreview
                                                        attachment={attachment}
                                                        onOpen={() =>
                                                            openAttachment(
                                                                attachment
                                                            )
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default PkbPage;