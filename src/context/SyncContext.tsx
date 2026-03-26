import React, { createContext, useContext, useEffect, useState } from 'react';
import { dbService } from '../../services/dbService';
import { syncEngine } from '../../services/syncEngine';

interface SyncContextType {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  isRetrying: boolean;
  lastSyncTime: Date | null;
  triggerSync: () => Promise<void>;
  syncData: (userName: string, parentTableName?: string, childTableName?: string) => Promise<Record<string, any[]>>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(async () => {
      const count = await syncEngine.getPendingCount();
      const retryingCount = await syncEngine.getRetryingCount();
      setPendingCount(count);
      setIsRetrying(retryingCount > 0);
    }, 5000); // Update UI every 5 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const triggerSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      await syncEngine.processQueue();
      setLastSyncTime(new Date());
    } finally {
      setIsSyncing(false);
    }
  };

  const syncData = async (userName: string, parentTableName?: string, childTableName?: string) => {
    if (!isOnline || isSyncing) return {};
    setIsSyncing(true);
    try {
      const result = await dbService.syncData(userName, parentTableName, childTableName);
      setLastSyncTime(new Date());
      return result;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, isSyncing, isRetrying, lastSyncTime, triggerSync, syncData }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};
