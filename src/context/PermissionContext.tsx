
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Permission, User, UserRole } from '../../types';
import { dbService } from '../../services/dbService';

interface PermissionContextType {
  permissions: Permission[];
  loading: boolean;
  isRefreshing: boolean;
  hasPermission: (screenKey: string, action: keyof Omit<Permission, 'id' | 'userId' | 'screenKey'>) => boolean;
  refreshPermissions: (silent?: boolean) => Promise<Permission[]>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode; user: User | null }> = ({ children, user }) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshPermissions = React.useCallback(async (silent = false): Promise<Permission[]> => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      setIsRefreshing(false);
      return [];
    }

    try {
      if (!silent) setLoading(true);
      setIsRefreshing(true);
      const data = await dbService.getPermissions(user.id);
      setPermissions(data);
      return data;
    } catch (error) {
      console.error('Error fetching permissions:', error);
      return [];
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshPermissions();
  }, [user?.id]);

  const hasPermission = (screenKey: string, action: keyof Omit<Permission, 'id' | 'userId' | 'screenKey'>): boolean => {
    // Safety check for the main admin email to prevent lockout from the users management page
    // This is the only "code-level" permission left to ensure the system remains manageable
    if (user?.email === 'orz7178@gmail.com' && screenKey === 'users') return true;

    const perm = permissions.find(p => p.screenKey === screenKey);
    if (!perm) {
      // Default fallback if no permission record exists
      return false;
    }

    return !!perm[action];
  };

  return (
    <PermissionContext.Provider value={{ permissions, loading, isRefreshing, hasPermission, refreshPermissions }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};
