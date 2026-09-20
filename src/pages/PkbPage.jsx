// src/pages/PkbPage.jsx
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    FiPlus,
    FiTag,
    FiFile,
    FiTrash2,
    FiUpload,
    FiLock,
    FiRefreshCw,
    FiDownload,
    FiKey,
    FiX,
} from 'react-icons/fi';

import { useAuth } from '../contexts/AuthContext';
import { migrateWidgetChatsToPkb , getChatsMigrationStatus} from '../services/migrateChatsToPkb';

import {
    db,
    uid,
    getPkbVaultStatus,
    createPkbVault,
    unlockPkbVault,
    resetPasswordWithRecovery,
    startPkbSync,
    stopPkbSync,
    requestPkbSync,
    syncNow,
} from '../services/pkbSync';

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

const chatPreview = (content) => {
    if (!content) return '';

    try {
        const parsed = JSON.parse(content);

        if (!parsed || parsed.schema !== 'aida/chat' || !Array.isArray(parsed.messages)) {
            return content.slice(0, 90);
        }

        const messages = parsed.messages;
        const firstUser = messages.find(
            (message) => message.sender === 'user' && (message.text || '').trim()
        );

        const base = firstUser ? firstUser.text.trim() : 'Chat transcript';
        const label = base.length > 70 ? `${base.slice(0, 67)}...` : base;

        return `${label} (${messages.length} messages)`;
    } catch {
        return content.slice(0, 90);
    }
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
    const { user, apiToken, isAuthenticated } = useAuth();

    const [selectedTagId, setSelectedTagId] = useState('all');
    const [selectedNoteId, setSelectedNoteId] = useState('');
    const [newTagName, setNewTagName] = useState('');

    const [vaultExists, setVaultExists] = useState(false);
    const [dek, setDek] = useState(null);

    const [syncStatus, setSyncStatus] = useState('');
    const [syncError, setSyncError] = useState('');
    const [busy, setBusy] = useState(false);

    const [showSyncSetup, setShowSyncSetup] = useState(false);
    const [showRecoveryKey, setShowRecoveryKey] = useState(false);

    const [mode, setMode] = useState('create');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [recoveryInput, setRecoveryInput] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');

    const [recoveryKey, setRecoveryKey] = useState('');
    const [recoverySaved, setRecoverySaved] = useState(false);

    // Clean up old vault-id localStorage keys (migration)
    useEffect(() => {
        Object.keys(localStorage)
            .filter((key) => key.startsWith('pkbVaultId:'))
            .forEach((key) => {
                localStorage.removeItem(key);
            });
    }, []);

    // Check if a PKB vault exists for this user
    useEffect(() => {
        if (!isAuthenticated || !apiToken) {
            setVaultExists(false);
            setDek(null);
            return;
        }

        getPkbVaultStatus(apiToken)
            .then((exists) => {
                setVaultExists(exists);
            })
            .catch((error) => {
                console.error('PKB vault status check failed:', error);
                setVaultExists(false);
            });
    }, [isAuthenticated, apiToken]);

    useEffect(() => {
        window.migrateWidgetChatsToPkb = migrateWidgetChatsToPkb;
        window.getChatsMigrationStatus = getChatsMigrationStatus;
        window.pkbDb = db;

        let cancelled = false;

        const run = () =>
            migrateWidgetChatsToPkb()
                .then((result) => {
                    if (cancelled) return;
                    console.info('[chats-migration] result:', result);
                    if (!result || result.skipped) return;

                    setSyncStatus(
                        `Migrated ${result.chats} chat(s): ` +
                        `${result.resourcesCreated} new attachment(s), ` +
                        `${result.resourcesReused} reused.`
                    );

                    requestPkbSync(1000);
                })
                .catch((error) => {
                    console.error('[chats-migration] failed:', error);
                });

        run();
        const id = setInterval(run, 60000);

        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, []);

    // Start / stop sync engine when dek is available
    useEffect(() => {
        if (!isAuthenticated || !apiToken || !dek) {
            return;
        }

        startPkbSync({
            token: apiToken,
            dek,
            onStatus: setSyncStatus,
        });

        return () => {
            stopPkbSync();
        };
    }, [isAuthenticated, apiToken, dek]);

    const tags =
        useLiveQuery(() => {
            return db.docs
                .where('kind')
                .equals('tag')
                .and((tag) => !tag.deleted)
                .sortBy('title');
        }, []) || [];

    const notes =
        useLiveQuery(async () => {
            const rows = await db.docs
                .where('kind')
                .equals('note')
                .and((note) => !note.deleted)
                .toArray();

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

    useEffect(() => {
        if (note?.deleted) {
            setSelectedNoteId('');
        }
    }, [note?.deleted]);

    const resourceIdsKey = (note?.resourceIds || []).join(',');

    const attachments =
        useLiveQuery(async () => {
            if (!resourceIdsKey) return [];

            const ids = resourceIdsKey.split(',');
            const rows = await db.docs.where('id').anyOf(ids).toArray();

            return rows.filter((row) => !row.deleted);
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
            dirty: 1,
            deleted: 0,
        });

        setSelectedNoteId(id);
        requestPkbSync(500);
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
            dirty: 1,
            deleted: 0,
        });

        setSelectedTagId(id);
        setNewTagName('');
        requestPkbSync(500);
    };

    const updateNote = async (changes) => {
        if (!note) return;

        await db.docs.update(note.id, {
            ...changes,
            modified: new Date().toISOString(),
            dirty: 1,
            pkbEdited: 1,
        });

        requestPkbSync(2000);
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

        const now = new Date().toISOString();

        await db.docs.update(note.id, {
            deleted: 1,
            dirty: 1,
            modified: now,
        });

        const allNotes = await db.docs
            .where('kind')
            .equals('note')
            .toArray();

        const orphanResourceIds = (note.resourceIds || []).filter(
            (resourceId) => {
                return !allNotes.some((item) => {
                    return (
                        item.id !== note.id &&
                        !item.deleted &&
                        (item.resourceIds || []).includes(resourceId)
                    );
                });
            }
        );

        for (const resourceId of orphanResourceIds) {
            await db.docs.update(resourceId, {
                deleted: 1,
                dirty: 1,
                modified: now,
            });
        }

        setSelectedNoteId('');
        requestPkbSync(500);
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
            dirty: 1,
            deleted: 0,
            blobDirty: 1,
        });

        await updateNote({
            resourceIds: [...(note.resourceIds || []), id],
        });

        event.target.value = '';
        requestPkbSync(500);
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
                !item.deleted &&
                (item.resourceIds || []).includes(resourceId)
            );
        });

        if (!stillUsed) {
            await db.docs.update(resourceId, {
                deleted: 1,
                dirty: 1,
                modified: new Date().toISOString(),
            });
        }

        requestPkbSync(500);
    };

    const openAttachment = (attachment) => {
        if (!attachment?.blob) return;

        const url = URL.createObjectURL(attachment.blob);
        window.open(url, '_blank', 'noopener');

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 60000);
    };

    const openSyncSetup = () => {
        setSyncError('');
        setPassword('');
        setConfirmPassword('');
        setRecoveryInput('');
        setNewPassword('');
        setConfirmNewPassword('');
        setMode(vaultExists ? 'unlock' : 'create');
        setShowSyncSetup(true);
    };

    const handleCreateVault = async () => {
        setSyncError('');

        if (password.length < 8) {
            setSyncError('Password must be at least 8 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setSyncError('Passwords do not match.');
            return;
        }

        setBusy(true);

        try {
            const result = await createPkbVault(apiToken, password);

            setDek(result.dek);
            setVaultExists(true);
            setRecoveryKey(result.recoveryKey);

            setShowSyncSetup(false);
            setShowRecoveryKey(true);
        } catch (error) {
            setSyncError(error.message);
        } finally {
            setBusy(false);
        }
    };

    const handleUnlock = async () => {
        setSyncError('');

        if (!password) {
            setSyncError('Please enter your password.');
            return;
        }

        setBusy(true);

        try {
            const result = await unlockPkbVault(apiToken, password);

            setDek(result.dek);

            setPassword('');
            setShowSyncSetup(false);
        } catch (error) {
            setSyncError(error.message);
        } finally {
            setBusy(false);
        }
    };

    const handleRecoveryReset = async () => {
        setSyncError('');

        if (!recoveryInput.trim()) {
            setSyncError('Please enter your recovery key.');
            return;
        }

        if (newPassword.length < 8) {
            setSyncError('New password must be at least 8 characters.');
            return;
        }

        if (newPassword !== confirmNewPassword) {
            setSyncError('New passwords do not match.');
            return;
        }

        setBusy(true);

        try {
            const result = await resetPasswordWithRecovery(
                apiToken,
                recoveryInput,
                newPassword
            );

            setDek(result.dek);

            setRecoveryInput('');
            setNewPassword('');
            setConfirmNewPassword('');
            setShowSyncSetup(false);

            setSyncStatus('Password reset complete. Sync unlocked.');
        } catch (error) {
            setSyncError(error.message);
        } finally {
            setBusy(false);
        }
    };

    const copyRecoveryKey = async () => {
        try {
            await navigator.clipboard.writeText(recoveryKey);
        } catch (error) {
            console.error('Could not copy recovery key:', error);
        }
    };

    const downloadRecoveryKey = () => {
        const content = [
            'PKB recovery key',
            '',
            'Keep this key somewhere safe. It can reset your PKB sync password if you forget it.',
            '',
            recoveryKey,
            '',
        ].join('\n');

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'pkb-recovery-key.txt';
        anchor.click();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 5000);
    };

    const lockSync = () => {
        stopPkbSync();
        setDek(null);
        setSyncStatus('Sync locked.');
    };

    return (
        <div className="bg-aida-light min-h-screen">
            <div className="border-b border-aida-border bg-aida-card px-4 py-3">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-lg font-bold text-aida-dark">
                            PKB
                        </h1>
                        <p className="text-xs text-aida-text-muted">
                            Notes, tags, and attachments. Encrypted sync can be
                            enabled with your password.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {syncStatus && (
                            <span className="rounded-lg border border-aida-border px-3 py-2 text-xs text-aida-text-muted">
                                {syncStatus}
                            </span>
                        )}

                        {!isAuthenticated && (
                            <div className="flex items-center gap-2 rounded-lg border border-aida-border px-3 py-2 text-xs text-aida-text-muted">
                                <FiLock />
                                <span>Log in to enable encrypted sync</span>
                            </div>
                        )}

                        {isAuthenticated && !vaultExists && (
                            <button
                                onClick={openSyncSetup}
                                className="flex items-center gap-2 rounded-lg bg-aida-pink px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                            >
                                <FiKey />
                                Enable encrypted sync
                            </button>
                        )}

                        {isAuthenticated && vaultExists && !dek && (
                            <button
                                onClick={openSyncSetup}
                                className="flex items-center gap-2 rounded-lg bg-aida-pink px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                            >
                                <FiLock />
                                Unlock sync
                            </button>
                        )}

                        {dek && (
                            <>
                                <button
                                    onClick={() => syncNow()}
                                    className="flex items-center gap-2 rounded-lg border border-aida-border px-4 py-2 text-sm font-medium text-aida-dark hover:bg-aida-light"
                                >
                                    <FiRefreshCw />
                                    Sync now
                                </button>

                                <button
                                    onClick={lockSync}
                                    className="flex items-center gap-2 rounded-lg border border-aida-border px-4 py-2 text-sm font-medium text-aida-dark hover:bg-aida-light"
                                >
                                    <FiLock />
                                    Lock
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {syncError && (
                <div className="mx-auto max-w-7xl px-4 pt-4">
                    <div className="rounded-lg border border-red-400 bg-red-400/10 px-4 py-3 text-sm text-red-400">
                        {syncError}
                    </div>
                </div>
            )}

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
                                {chatPreview(item.content)}
                            </div>
                        </button>
                    ))}
                </section>

                <section className="flex-1 overflow-y-auto rounded-2xl border border-aida-border bg-aida-card p-4">
                    {!note || note.deleted ? (
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

            {showSyncSetup && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-aida-border bg-aida-card p-6 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-aida-dark">
                                {mode === 'create' && 'Enable encrypted sync'}
                                {mode === 'unlock' && 'Unlock PKB sync'}
                                {mode === 'recovery' && 'Recover PKB sync'}
                            </h2>

                            <button
                                onClick={() => setShowSyncSetup(false)}
                                className="rounded-lg border border-aida-border p-2 text-aida-text-muted hover:bg-aida-light"
                            >
                                <FiX />
                            </button>
                        </div>

                        {syncError && (
                            <div className="mb-4 rounded-lg border border-red-400 bg-red-400/10 px-4 py-3 text-sm text-red-400">
                                {syncError}
                            </div>
                        )}

                        {mode === 'create' && (
                            <div className="space-y-4">
                                <p className="text-sm text-aida-text-muted">
                                    Choose a sync password. This password is
                                    used to encrypt your PKB data before it is
                                    uploaded. It is not stored on the server.
                                </p>

                                <input
                                    type="password"
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    placeholder="Sync password"
                                    className="w-full rounded-lg border border-aida-border bg-transparent px-3 py-2 text-sm text-aida-dark"
                                />

                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(event) =>
                                        setConfirmPassword(event.target.value)
                                    }
                                    placeholder="Confirm sync password"
                                    className="w-full rounded-lg border border-aida-border bg-transparent px-3 py-2 text-sm text-aida-dark"
                                />

                                <button
                                    onClick={handleCreateVault}
                                    disabled={busy}
                                    className="w-full rounded-lg bg-aida-pink px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                                >
                                    {busy ? 'Creating vault...' : 'Create encrypted vault'}
                                </button>
                            </div>
                        )}

                        {mode === 'unlock' && (
                            <div className="space-y-4">
                                <p className="text-sm text-aida-text-muted">
                                    Enter your PKB sync password to unlock
                                    encrypted sync.
                                </p>

                                <input
                                    type="password"
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    placeholder="Sync password"
                                    className="w-full rounded-lg border border-aida-border bg-transparent px-3 py-2 text-sm text-aida-dark"
                                />

                                <button
                                    onClick={handleUnlock}
                                    disabled={busy}
                                    className="w-full rounded-lg bg-aida-pink px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                                >
                                    {busy ? 'Unlocking...' : 'Unlock sync'}
                                </button>

                                <button
                                    onClick={() => setMode('recovery')}
                                    className="w-full rounded-lg border border-aida-border px-4 py-2 text-sm text-aida-dark hover:bg-aida-light"
                                >
                                    Forgot password? Use recovery key
                                </button>
                            </div>
                        )}

                        {mode === 'recovery' && (
                            <div className="space-y-4">
                                <p className="text-sm text-aida-text-muted">
                                    Enter your recovery key and choose a new
                                    sync password.
                                </p>

                                <textarea
                                    value={recoveryInput}
                                    onChange={(event) =>
                                        setRecoveryInput(event.target.value)
                                    }
                                    placeholder="Recovery key"
                                    rows={3}
                                    className="w-full rounded-lg border border-aida-border bg-transparent px-3 py-2 text-sm text-aida-dark"
                                />

                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(event) =>
                                        setNewPassword(event.target.value)
                                    }
                                    placeholder="New sync password"
                                    className="w-full rounded-lg border border-aida-border bg-transparent px-3 py-2 text-sm text-aida-dark"
                                />

                                <input
                                    type="password"
                                    value={confirmNewPassword}
                                    onChange={(event) =>
                                        setConfirmNewPassword(
                                            event.target.value
                                        )
                                    }
                                    placeholder="Confirm new sync password"
                                    className="w-full rounded-lg border border-aida-border bg-transparent px-3 py-2 text-sm text-aida-dark"
                                />

                                <button
                                    onClick={handleRecoveryReset}
                                    disabled={busy}
                                    className="w-full rounded-lg bg-aida-pink px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                                >
                                    {busy ? 'Recovering...' : 'Reset password and unlock'}
                                </button>

                                <button
                                    onClick={() => setMode('unlock')}
                                    className="w-full rounded-lg border border-aida-border px-4 py-2 text-sm text-aida-dark hover:bg-aida-light"
                                >
                                    Back to password unlock
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showRecoveryKey && (
                <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-2xl rounded-2xl border border-aida-border bg-aida-card p-6 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-aida-dark">
                                Save your recovery key
                            </h2>

                            <button
                                onClick={() => setShowRecoveryKey(false)}
                                disabled={!recoverySaved}
                                className="rounded-lg border border-aida-border p-2 text-aida-text-muted hover:bg-aida-light disabled:opacity-40"
                            >
                                <FiX />
                            </button>
                        </div>

                        <p className="mb-4 text-sm text-aida-text-muted">
                            This recovery key can reset your PKB sync password
                            if you forget it. It is shown only once. Store it
                            somewhere safe.
                        </p>

                        <textarea
                            readOnly
                            value={recoveryKey}
                            rows={4}
                            className="mb-4 w-full rounded-lg border border-aida-border bg-transparent px-3 py-2 font-mono text-xs text-aida-dark"
                        />

                        <div className="mb-4 flex flex-wrap gap-2">
                            <button
                                onClick={copyRecoveryKey}
                                className="flex items-center gap-2 rounded-lg border border-aida-border px-4 py-2 text-sm text-aida-dark hover:bg-aida-light"
                            >
                                <FiKey />
                                Copy
                            </button>

                            <button
                                onClick={downloadRecoveryKey}
                                className="flex items-center gap-2 rounded-lg border border-aida-border px-4 py-2 text-sm text-aida-dark hover:bg-aida-light"
                            >
                                <FiDownload />
                                Download
                            </button>
                        </div>

                        <label className="mb-4 flex items-center gap-2 text-sm text-aida-text-muted">
                            <input
                                type="checkbox"
                                checked={recoverySaved}
                                onChange={(event) =>
                                    setRecoverySaved(event.target.checked)
                                }
                            />
                            I saved this recovery key somewhere safe.
                        </label>

                        <button
                            onClick={() => {
                                setShowRecoveryKey(false);
                                setRecoverySaved(false);
                            }}
                            disabled={!recoverySaved}
                            className="w-full rounded-lg bg-aida-pink px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                            Continue to PKB
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PkbPage;