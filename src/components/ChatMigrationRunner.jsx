// src/components/ChatMigrationRunner.jsx
import { useEffect } from 'react';
import { migrateWidgetChatsToPkb } from '../services/migrateChatsToPkb';
import { usePkbSync } from '../contexts/PkbSyncContext';

const ChatMigrationRunner = () => {
  const { requestSync } = usePkbSync();

  useEffect(() => {
    let cancelled = false;

    const run = () =>
      migrateWidgetChatsToPkb()
        .then((result) => {
          if (cancelled) return;
          console.info('[chats-migration] result:', result);
          if (!result || result.skipped) return;
          // Trigger a sync so the newly created notes are uploaded
          requestSync(1000);
        })
        .catch((e) => console.error('[chats-migration] failed:', e));

    // Run immediately on mount
    run();

    // Run again every 60 seconds to catch any new chats
    const id = setInterval(run, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [requestSync]);

  return null; // no UI
};

export default ChatMigrationRunner;