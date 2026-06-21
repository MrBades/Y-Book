import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  Download, 
  Trash2, 
  RefreshCw, 
  FileCheck, 
  AlertTriangle, 
  UploadCloud, 
  CheckCircle, 
  Calendar,
  Layers,
  Sparkles,
  Search,
  HardDrive
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface BackupEntry {
  filename: string;
  size?: number;
  createdAt: string;
  source: 'browser' | 'server';
  localId?: string;
}

interface BackupManagerProps {
  userEmail: string;
  isAuthenticated: boolean;
  customers: any[];
  products: any[];
  restockLogs: any[];
  userBusiness: any;
  subscriptionPlan?: string;
  onRestoreBackup: (restoredData: { customers: any[], products: any[], restockLogs?: any[] }) => void;
  triggerBackupNow: () => Promise<any>;
}

export default function BackupManager({
  userEmail,
  isAuthenticated,
  customers,
  products,
  restockLogs,
  userBusiness,
  subscriptionPlan,
  onRestoreBackup,
  triggerBackupNow
}: BackupManagerProps) {
  const [serverBackups, setServerBackups] = useState<BackupEntry[]>([]);
  const [localBackups, setLocalBackups] = useState<BackupEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [syncTime, setSyncTime] = useState('18:00');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load user settings
  useEffect(() => {
    const savedAutoSync = localStorage.getItem(`auto_sync_enabled_${userEmail}`);
    const savedSyncTime = localStorage.getItem(`sync_time_${userEmail}`);
    if (savedAutoSync !== null) setAutoSyncEnabled(JSON.parse(savedAutoSync));
    if (savedSyncTime !== null) setSyncTime(savedSyncTime);
  }, [userEmail]);

  // Save user settings
  useEffect(() => {
    localStorage.setItem(`auto_sync_enabled_${userEmail}`, JSON.stringify(autoSyncEnabled));
    localStorage.setItem(`sync_time_${userEmail}`, syncTime);
  }, [autoSyncEnabled, syncTime, userEmail]);

  // Load backups timeline
  const fetchServerBackups = async () => {
    if (!isAuthenticated) return;
    try {
      const token = localStorage.getItem('session_id') || '';
      const response = await apiFetch('/api/backup/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-session-id': token
        }
      });
      if (response.ok) {
        const data = await response.json();
        const formatted: BackupEntry[] = data.map((item: any) => ({
          filename: item.filename,
          size: item.size,
          createdAt: item.createdAt,
          source: 'server'
        }));
        setServerBackups(formatted);
      }
    } catch (err) {
      console.error('Failed to fetch server backups list:', err);
    }
  };

  const loadLocalBrowserBackups = () => {
    const localKey = `yeedem_local_backups_${userEmail}`;
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        const formatted: BackupEntry[] = parsed.map((item: any) => ({
          filename: item.filename || `backup_local_${new Date(item.createdAt).getTime()}.json`,
          createdAt: item.createdAt,
          size: JSON.stringify(item.data).length, // approximate size in bytes
          source: 'browser',
          localId: item.id
        }));
        setLocalBackups(formatted);
      } else {
        setLocalBackups([]);
      }
    } catch (e) {
      console.error('Failed to parse local backups list:', e);
      setLocalBackups([]);
    }
  };

  const refreshTimeline = async () => {
    setIsLoading(true);
    setActionStatus(null);
    await Promise.all([fetchServerBackups(), loadLocalBrowserBackups()]);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && userEmail) {
      refreshTimeline();
    }
  }, [userEmail, isAuthenticated]);

  // Combine both lists and sort by date descending
  const combinedBackups = [...serverBackups, ...localBackups].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filteredBackups = combinedBackups.filter(b => 
    b.filename.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.source.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleManualBackupTrigger = async () => {
    setIsLoading(true);
    setActionStatus({ type: 'info', message: 'Creating automated ledger data archive...' });
    try {
      await triggerBackupNow();
      setActionStatus({ type: 'success', message: 'Ledger data exported successfully to server and local storage.' });
      fetchServerBackups();
      loadLocalBrowserBackups();
    } catch (err: any) {
      setActionStatus({ type: 'error', message: err.message || 'Error occurred while executing manual backup.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (backup: BackupEntry) => {
    try {
      if (backup.source === 'server') {
        const token = localStorage.getItem('session_id') || '';
        const response = await apiFetch(`/api/backup/download/${backup.filename}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-session-id': token
          }
        });
        if (!response.ok) throw new Error('Could not download server file.');
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = backup.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Download browser backup from local storage
        const localKey = `yeedem_local_backups_${userEmail}`;
        const stored = localStorage.getItem(localKey);
        if (!stored) throw new Error('Local backup not found.');
        
        const parsed = JSON.parse(stored);
        const entry = parsed.find((item: any) => item.id === backup.localId || item.filename === backup.filename);
        if (!entry) throw new Error('Local backup entry not found.');

        const blob = new Blob([JSON.stringify(entry.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = backup.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      setActionStatus({ type: 'error', message: err.message || 'Failed to download JSON backup file.' });
    }
  };

  const handleRestore = async (backup: BackupEntry) => {
    const isConfirmed = window.confirm(
      '☢️ CRITICAL OPERATION: Restore Ledger Data\n\nAre you sure you want to restore the ledger to this state? This will completely overwrite your current list of customers, product catalog, and transaction records. This action cannot be undone!'
    );
    if (!isConfirmed) return;

    setIsLoading(true);
    setActionStatus({ type: 'info', message: 'Retrieving backup payload...' });
    
    try {
      let payload: any = null;
      if (backup.source === 'server') {
        const token = localStorage.getItem('session_id') || '';
        const response = await apiFetch(`/api/backup/download/${backup.filename}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-session-id': token
          }
        });
        if (!response.ok) throw new Error('Failed to retrieve backup file from server disk');
        payload = await response.json();
      } else {
        const localKey = `yeedem_local_backups_${userEmail}`;
        const stored = localStorage.getItem(localKey);
        if (!stored) throw new Error('Browser backup inventory damaged.');
        const parsed = JSON.parse(stored);
        const entry = parsed.find((item: any) => item.id === backup.localId || item.filename === backup.filename);
        if (!entry) throw new Error('Requested browser local snapshot was not found.');
        payload = entry.data;
      }

      if (!payload || !payload.data) {
        throw new Error('Invalid JSON backup file schema.');
      }

      const { customers: restCust, products: restProd, restockLogs: restLogs } = payload.data;
      onRestoreBackup({
        customers: restCust || [],
        products: restProd || [],
        restockLogs: restLogs || []
      });

      setActionStatus({ 
        type: 'success', 
        message: '🎉 Ledger records successfully restored! Your workspace has been updated with the backup file data.' 
      });
      refreshTimeline();
    } catch (err: any) {
      setActionStatus({ type: 'error', message: `Restore failed: ${err.message || 'Malformed schema.'}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (backup: BackupEntry) => {
    const isConfirmed = window.confirm('Are you sure you want to delete this backup file?');
    if (!isConfirmed) return;

    setIsLoading(true);
    try {
      if (backup.source === 'server') {
        const token = localStorage.getItem('session_id') || '';
        const response = await apiFetch(`/api/backup/${backup.filename}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-session-id': token
          }
        });
        if (!response.ok) throw new Error('Could not delete from server disk.');
      } else {
        const localKey = `yeedem_local_backups_${userEmail}`;
        const stored = localStorage.getItem(localKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          const filtered = parsed.filter((item: any) => item.id !== backup.localId && item.filename !== backup.filename);
          localStorage.setItem(localKey, JSON.stringify(filtered));
        }
      }

      setActionStatus({ type: 'success', message: 'Backup file deleted successfully.' });
      fetchServerBackups();
      loadLocalBrowserBackups();
    } catch (err: any) {
      setActionStatus({ type: 'error', message: err.message || 'Failed to delete backup.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Drag and drop custom backup restore
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processSelectedJSONFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processSelectedJSONFile(files[0]);
    }
  };

  const processSelectedJSONFile = (file: File) => {
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setActionStatus({ type: 'error', message: 'Error: Imported file must be a valid .json ledger backup!' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        if (!parsed.backupVersion || !parsed.data || (!parsed.data.customers && !parsed.data.products)) {
          throw new Error('This file does not appear to be a valid Yeedem Ledger Backup file.');
        }

        const isConfirmed = window.confirm(
          `📂 CUSTOM LEDGER RESTORE\n\nUploaded file: ${file.name}\nExported At: ${parsed.exportedAt || 'Unknown'}\nAccount Owner: ${parsed.email || 'Unknown'}\n\nDo you want to confirm the restoration? Your current ledger records and catalog will be entirely replaced.`
        );

        if (!isConfirmed) return;

        onRestoreBackup({
          customers: parsed.data.customers || [],
          products: parsed.data.products || [],
          restockLogs: parsed.data.restockLogs || []
        });

        setActionStatus({ 
          type: 'success', 
          message: '🎉 Custom ledger JSON file imported and restored successfully!' 
        });
        refreshTimeline();
      } catch (err: any) {
        setActionStatus({ type: 'error', message: `Import error: ${err.message || 'Invalid JSON format.'}` });
      }
    };
    reader.readAsText(file);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const lastBackupDateStr = localStorage.getItem(`last_daily_backup_date_${userEmail}`);

  return (
    <div id="backup-manager-section" className="bg-white rounded-[24px] p-6 shadow-sm space-y-6">
      
      {/* Header and Automated Backup State */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b">
        <div className="space-y-1">
          <h2 className="text-lg font-display font-extrabold text-gray-900 flex items-center gap-2">
            <Database className="w-5.2 h-5.2 text-[#00A6FF]" />
            Ledger Daily Backups & Disaster Recovery
          </h2>
          {subscriptionPlan && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Plan: {subscriptionPlan}</span>}
          <p className="text-xs text-gray-400">
            Automated daily snapshots safeguard your microlending records and catalogs on local storage arrays and client cookies.
          </p>
        </div>
        
        <button
          onClick={handleManualBackupTrigger}
          disabled={isLoading}
          className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-[#00A6FF] to-blue-600 font-bold text-xs text-white rounded-xl shadow-md hover:brightness-110 flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Run Backup Now
        </button>
      </div>

      {/* Daily schedule indicator banner */}
      <div className="bg-blue-50/50 p-4 rounded-2xl flex items-center gap-3 border border-blue-100">
        <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
          <Calendar className="w-4 h-4 text-[#00A6FF]" />
        </div>
        <div className="flex-1">
          <h4 className="text-xs font-bold text-[#0E1338]">Automated Daily Export Background Task</h4>
          <p className="text-[11px] text-gray-500">
            {lastBackupDateStr 
              ? `Active scheduler validated today's automated snapshot. Last automated sync: ${lastBackupDateStr}` 
              : 'Active scheduler is checking. A cloud and local storage backup will complete automatically on daily mount!'}
          </p>
        </div>
        <div className="hidden sm:block">
          <span className={`px-2.5 py-1 ${autoSyncEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500'} border ${autoSyncEnabled ? 'border-emerald-100' : 'border-gray-200'} rounded-full font-bold text-[10px] uppercase tracking-wider flex items-center gap-1`}>
            <span className={`w-1.5 h-1.5 rounded-full ${autoSyncEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
            {autoSyncEnabled ? 'Active' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Sync Settings */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className={`w-10 h-5 rounded-full p-0.5 transition ${autoSyncEnabled ? 'bg-[#00A6FF]' : 'bg-gray-200'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition ${autoSyncEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
          </div>
          <input 
            type="checkbox" 
            className="hidden" 
            checked={autoSyncEnabled} 
            onChange={(e) => setAutoSyncEnabled(e.target.checked)} 
          />
          <span className="text-xs font-bold text-gray-700">Automated Daily Sync</span>
        </label>
        
        {autoSyncEnabled && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500">Sync Time:</span>
            <input 
              type="time" 
              value={syncTime}
              onChange={(e) => setSyncTime(e.target.value)}
              className="text-xs font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:border-[#00A6FF] outline-none"
            />
          </div>
        )}
      </div>

      {actionStatus && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
          actionStatus.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
            : actionStatus.type === 'error' 
              ? 'bg-rose-50 text-rose-800 border-rose-100' 
              : 'bg-indigo-50 text-indigo-800 border-indigo-100'
        }`}>
          {actionStatus.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
          {actionStatus.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-650 shrink-0" />}
          {actionStatus.type === 'info' && <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />}
          <span className="font-semibold leading-relaxed">{actionStatus.message}</span>
        </div>
      )}

      {/* Timeline core panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        
        {/* Left Side: Drag and drop manual restore */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Manual Restore & Upload</h3>
          
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropFile}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-[20px] p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 p-8 ${
              isDragging 
                ? 'border-[#00A6FF] bg-blue-50/20 scale-[0.99]' 
                : 'border-gray-200 hover:border-[#00A6FF] hover:bg-gray-50/50'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileInputChange} 
              accept=".json" 
              className="hidden" 
            />
            
            <div className="p-3 bg-[#00A6FF]/10 rounded-full text-[#00A6FF]">
              <UploadCloud className="w-6 h-6" />
            </div>
            
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-800">Drag & drop JSON ledger backup file</p>
              <p className="text-[10px] text-gray-400">or click to browse local files</p>
            </div>
            
            <div className="px-3 py-1 bg-gray-100 text-gray-400 rounded-lg text-[9px] font-mono leading-none">
              Schema v1 Validated
            </div>
          </div>
          
          <div className="rounded-xl p-3 bg-amber-50/60 border border-amber-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[9.5px] text-amber-800 leading-relaxed">
              <strong>Caution before restoring:</strong> Restoring database states overwrites current ledger lists. Download a backup of your active ledger session first if you have unexported records!
            </p>
          </div>
        </div>

        {/* Right Side: Backups timeline list */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-500" />
              Rolling Storage Backups History ({filteredBackups.length})
            </h3>
            
            {/* Search filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search backup timeline..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 w-full sm:w-48 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-[#00A6FF]"
              />
            </div>
          </div>

          <div className="border border-gray-100 rounded-[20px] overflow-hidden max-h-[350px] overflow-y-auto bg-gray-50/30">
            {filteredBackups.length === 0 ? (
              <div className="p-12 text-center text-gray-400 space-y-2">
                <Database className="w-8 h-8 mx-auto stroke-1" />
                <p className="text-xs font-bold">No backups found</p>
                <p className="text-[10px]">Your automated daily backup runs safely on mount. Try clicking &apos;Run Backup Now&apos; above!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredBackups.map((entry) => {
                  const date = new Date(entry.createdAt);
                  return (
                    <div 
                      key={entry.filename} 
                      className="p-4 hover:bg-white flex items-center justify-between gap-4 transition duration-150 animate-fadeIn"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider ${
                            entry.source === 'server' 
                              ? 'bg-[#00A6FF]/10 text-[#00A6FF]' 
                              : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {entry.source === 'server' ? 'Server Disk' : 'Browser Storage'}
                          </span>
                          <span className="font-mono text-[10px] font-medium text-gray-400">
                            {formatSize(entry.size)}
                          </span>
                        </div>
                        
                        <p className="font-mono text-xs text-gray-800 font-semibold truncate leading-none">
                          {entry.filename}
                        </p>
                        
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                          <HardDrive className="w-3 h-3" />
                          <span>Saved {date.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      {/* Action items */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleDownload(entry)}
                          title="Download Backup JSON"
                          className="p-2 text-gray-500 hover:text-emerald-650 hover:bg-emerald-50 rounded-lg transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          onClick={() => handleRestore(entry)}
                          disabled={isLoading}
                          title="Restore Ledger here"
                          className="px-2.5 py-1 text-[10px] font-bold text-[#0E1338] bg-gray-100 hover:bg-[#00A6FF] hover:text-white rounded-lg transition disabled:opacity-50"
                        >
                          Restore
                        </button>
                        
                        <button
                          onClick={() => handleDelete(entry)}
                          disabled={isLoading}
                          title="Delete Backup File"
                          className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
