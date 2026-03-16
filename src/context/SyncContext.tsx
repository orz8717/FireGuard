
import React, { createContext, useContext, useState, useCallback } from 'react';
import { dbService } from '../../services/dbService';

interface SyncContextType {
  isSyncing: boolean;
  lastSync: string | null;
  syncData: (userName: string, parentTable?: string, childTable?: string) => Promise<any>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const syncData = useCallback(async (userName: string, parentTable?: string, childTable?: string) => {
    setIsSyncing(true);
    try {
      const data = await dbService.syncData(userName, parentTable, childTable);
      setLastSync(new Date().toISOString());
      return data;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return (
    <SyncContext.Provider value={{ isSyncing, lastSync, syncData }}>
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
