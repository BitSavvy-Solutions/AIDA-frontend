// src/components/ChatMigrationRunner.jsx
import { useEffect } from 'react';
import { migrateWidgetChatsToPkb } from '../services/migrateChatsToPkb';
import { usePkbSync } from '../contexts/PkbSyncContext';

const ChatMigrationRunner = () => {
    const { requestSync } = usePkbSync();

    useEffect(() => {
        let cancelled = false;

        migrateWidgetChatsToPkb()
            .then((result) => {
                if (cancelled) return;
                console.info('[chats-migration] result:', result);

                // Only sync when the migration actually imported
                // something. Skipped runs do not trigger a sync.
                if (!result || result.skipped) return;
                if (
                    (result.chats || 0) > 0 ||
                    (result.tagsCreated || 0) > 0 ||
                    (result.resourcesCreated || 0) > 0 ||
                    (result.resourcesFilled || 0) > 0
                ) {
                    requestSync(1000);
                }
            })
            .catch((e) => console.error('[chats-migration] failed:', e));

        return () => {
            cancelled = true;
        };
    }, [requestSync]);

    return null;
};

export default ChatMigrationRunner;