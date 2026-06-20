import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface SyncNotificationChipProps {
  userEmail: string;
  onSync: () => Promise<void>;
}

export function SyncNotificationChip({ userEmail, onSync }: SyncNotificationChipProps) {
  const [needsSync, setNeedsSync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const checkSyncStatus = () => {
      const lastBackupDateStr = localStorage.getItem(`last_daily_backup_date_${userEmail}`);
      if (!lastBackupDateStr) {
        setNeedsSync(true);
        return;
      }
      
      const lastBackup = new Date(lastBackupDateStr);
      const now = new Date();
      const diffHours = (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60);
      
      if (diffHours > 24) {
        setNeedsSync(true);
      } else {
        setNeedsSync(false);
      }
    };

    checkSyncStatus();
    // Re-check periodically
    const interval = setInterval(checkSyncStatus, 60000);
    return () => clearInterval(interval);
  }, [userEmail]);

  if (!needsSync) return null;

  const handleSync = async () => {
    setIsSyncing(true);
    await onSync();
    setIsSyncing(false);
    setNeedsSync(false); // Assume successful sync
  };

  return (
    <div className="fixed top-20 right-4 z-50 animate-bounce">
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold hover:bg-rose-700 transition"
      >
        {isSyncing ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <AlertCircle className="w-4 h-4" />
        )}
        <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
      </button>
    </div>
  );
}
