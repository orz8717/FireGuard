
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Permission, User, UserRole } from '../../types';
import { dbService } from '../../services/dbService';

interface PermissionContextType {
  permissions: Permission[];
  loading: boolean;
  hasPermission: (screenKey: string, action: keyof Omit<Permission, 'id' | 'userId' | 'screenKey'>) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode; user: User | null }> = ({ children, user }) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshPermissions = React.useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await dbService.getPermissions(user.id);
      setPermissions(data);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshPermissions();
  }, [user?.id]);

  const hasPermission = (screenKey: string, action: keyof Omit<Permission, 'id' | 'userId' | 'screenKey'>): boolean => {
    // Admin always has permission
    if (user?.role === UserRole.ADMIN) return true;

    const perm = permissions.find(p => p.screenKey === screenKey);
    if (!perm) {
      // Default fallback if no permission record exists
      // For non-admins, we might want to be strict or allow basic view
      return false;
    }

    return !!perm[action];
  };

  return (
    <PermissionContext.Provider value={{ permissions, loading, hasPermission, refreshPermissions }}>
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
