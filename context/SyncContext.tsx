
import React, { createContext, useContext, useState, useCallback } from 'react';
import { dbService } from '../services/dbService';

interface SyncContextType {
  progress: number;
  isSyncing: boolean;
  startSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const startSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setProgress(0);

    try {
      await dbService.hydrateOfflineData((p: number) => {
        setProgress(p);
      });
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
      // Keep progress at 100 for a bit if it finished
    }
  }, [isSyncing]);

  return (
    <SyncContext.Provider value={{ progress, isSyncing, startSync }}>
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
