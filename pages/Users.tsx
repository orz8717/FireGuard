
import React from 'react';
import { User, UserRole, Permission } from '../types';
import { dbService } from '../services/dbService';
import { authService } from '../services/authService';
import { Shield, UserPlus, Search, Edit2, Check, X, Loader2, Key, Lock, Eye, EyeOff } from 'lucide-react';
import { DatabaseFixModal } from '../components/DatabaseFixModal';

interface UsersProps {
  onNavigateToSignup?: () => void;
}

import { APP_SCREENS } from '../src/constants/screens';

const Users: React.FC<UsersProps> = ({ onNavigateToSignup }) => {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [newPassword, setNewPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [dbError, setDbError] = React.useState<string | null>(null);
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  // Filter unique screens by key for the permissions UI
  const screens = React.useMemo(() => {
    const uniqueKeys = new Set();
    return APP_SCREENS.filter(screen => {
      if (uniqueKeys.has(screen.key)) return false;
      uniqueKeys.add(screen.key);
      return true;
    });
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await dbService.getUsers();
      setUsers(data);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadUsers();
  }, []);

  const handleEditPermissions = async (user: User) => {
    setEditingUser(user);
    setNewPassword('');
    setShowPassword(false);
    const userPerms = await dbService.getPermissions(user.id);
    
    // Define default permissions based on role if no record exists
    const getDefaultPerms = (screenKey: string, role: UserRole) => {
      const isAdmin = role === UserRole.ADMIN;
      const isOffice = role === UserRole.OFFICE;
      
      // Admin has everything
      if (isAdmin) return true;
      
      // Office has specific screens
      if (isOffice) {
        const officeScreens = ['dashboard', 'customers', 'inspections', 'certificates', 'import', 'triggers', 'update_tables'];
        if (officeScreens.includes(screenKey)) return true;
      }
      
      // Regular user has basic screens
      const userScreens = ['dashboard', 'customers', 'inspections', 'update_tables'];
      if (userScreens.includes(screenKey)) return true;
      
      return false;
    };

    // Initialize default perms for screens not present
    const fullPerms = screens.map(s => {
      const existing = userPerms.find(p => p.screenKey === s.key);
      const isAdmin = user.role === UserRole.ADMIN;

      // If it's an admin, we force all permissions to true for the UI
      if (isAdmin) {
        return {
          id: existing?.id || '', 
          userId: user.id, 
          screenKey: s.key,
          canView: true, 
          canCreate: true, 
          canEdit: true, 
          canDelete: true,
          canExport: true, 
          canApprove: true, 
          canGenerateCertificates: true, 
          canImportExcel: true
        };
      }

      if (existing) return existing;
      
      const defaultVal = getDefaultPerms(s.key, user.role);
      return {
        id: '', 
        userId: user.id, 
        screenKey: s.key,
        canView: defaultVal, 
        canCreate: defaultVal, 
        canEdit: defaultVal, 
        canDelete: defaultVal,
        canExport: defaultVal, 
        canApprove: defaultVal, 
        canGenerateCertificates: defaultVal, 
        canImportExcel: defaultVal
      };
    });
    setPermissions(fullPerms as Permission[]);
  };

  const togglePermission = (screenKey: string, field: keyof Permission) => {
    setPermissions(prev => prev.map(p => 
      p.screenKey === screenKey ? { ...p, [field]: !p[field] } : p
    ));
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await dbService.savePermissions(editingUser.id, permissions);
      
      const updatePayload: Partial<User> = { 
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role, 
        isActive: editingUser.isActive,
        phone: editingUser.phone
      };

      await dbService.updateUser(editingUser.id, updatePayload);
      
      // Update password if provided
      if (newPassword.trim()) {
        if (newPassword.length < 6) {
          alert('הסיסמא חייבת להיות לפחות 6 תווים');
          setSaving(false);
          return;
        }
        const { error: pwdError } = await authService.updateUserPassword(editingUser.id, newPassword);
        if (pwdError) {
          console.error('Password update error:', pwdError);
          alert('שגיאה בעדכון הסיסמא: ' + (pwdError.message || pwdError));
        } else {
          // Log password change
          const currentUser = authService.getCurrentUser();
          if (currentUser) {
            await dbService.logActivity(
              currentUser.name,
              'UPDATE_PASSWORD',
              `שונתה סיסמא עבור המשתמש: ${editingUser.name}`
            );
          }
        }
      }
      
      // Log activity
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        await dbService.logActivity(
          currentUser.name,
          'UPDATE_USER',
          `עודכנו הרשאות/פרטים עבור המשתמש: ${editingUser.name}`
        );
      }
      
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      console.error('Save error:', err);
      alert('שגיאה בשמירת נתונים: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name && u.name.includes(searchTerm)) || 
    (u.email && u.email.includes(searchTerm)) || 
    (u.phone && u.phone.includes(searchTerm))
  );

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="חיפוש משתמש..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10 pl-4 py-2 border rounded-lg outline-none w-full sm:w-64 focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {isAdmin && (
          <button 
            onClick={onNavigateToSignup}
            className="flex items-center justify-center w-full sm:w-auto px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-all min-h-[44px]"
          >
            <UserPlus size={18} className="ml-2" />
            משתמש חדש
          </button>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4">שם המשתמש</th>
              <th className="p-4">אימייל</th>
              <th className="p-4">טלפון</th>
              <th className="p-4">תפקיד</th>
              <th className="p-4 text-center">סטטוס</th>
              <th className="p-4">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(u => (
              <tr key={u.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="p-4 font-bold text-gray-800">{u.name}</td>
                <td className="p-4 text-gray-600">{u.email}</td>
                <td className="p-4 text-gray-600">{u.phone || '---'}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                    u.role === UserRole.ADMIN ? 'bg-red-100 text-red-700' : 
                    u.role === UserRole.OFFICE ? 'bg-purple-100 text-purple-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="p-4 text-center">
                  {u.isActive ? 
                    <span className="text-green-600 flex items-center justify-center gap-1 font-medium"><Check size={16}/> פעיל</span> : 
                    <span className="text-red-600 flex items-center justify-center gap-1 font-medium"><X size={16}/> מושבת</span>
                  }
                </td>
                <td className="p-4">
                  {isAdmin && (
                    <button 
                      onClick={() => handleEditPermissions(u)}
                      className="flex items-center justify-center gap-1 text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors border border-blue-100 min-h-[44px]"
                    >
                      <Key size={16} /> הגדרות והרשאות
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-gray-400">לא נמצאו משתמשים</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredUsers.map(u => (
          <div key={u.id} className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">{u.name}</h3>
                <p className="text-gray-600 text-sm">{u.email}</p>
                <p className="text-gray-500 text-xs">{u.phone || 'אין טלפון'}</p>
              </div>
              <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                u.role === UserRole.ADMIN ? 'bg-red-100 text-red-700' : 
                u.role === UserRole.OFFICE ? 'bg-purple-100 text-purple-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {u.role}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <div className="text-sm">
                {u.isActive ? 
                  <span className="text-green-600 flex items-center gap-1 font-medium"><Check size={16}/> פעיל</span> : 
                  <span className="text-red-600 flex items-center gap-1 font-medium"><X size={16}/> מושבת</span>
                }
              </div>
              {isAdmin && (
                <button 
                  onClick={() => handleEditPermissions(u)}
                  className="flex items-center justify-center gap-1 text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors border border-blue-100 min-h-[44px]"
                >
                  <Key size={16} /> הגדרות
                </button>
              )}
            </div>
          </div>
        ))}
        {filteredUsers.length === 0 && (
          <div className="p-10 text-center text-gray-400 bg-white rounded-xl border">לא נמצאו משתמשים</div>
        )}
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800">עריכת משתמש והרשאות: {editingUser.name}</h2>
                <p className="text-sm text-slate-500">{editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Profile & Security Section */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <label className="block text-sm font-bold text-gray-700 mb-2">תפקיד במערכת</label>
                  <select 
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                    className="w-full p-2 border rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.values(UserRole).map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <label className="block text-sm font-bold text-gray-700 mb-2">מספר טלפון</label>
                  <input 
                    type="text"
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                    className="w-full p-2 border rounded-lg outline-none bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-center">
                  <label className="flex items-center cursor-pointer gap-3 font-bold text-gray-700">
                    <input 
                      type="checkbox" 
                      checked={editingUser.isActive}
                      onChange={(e) => setEditingUser({...editingUser, isActive: e.target.checked})}
                      className="w-6 h-6 rounded text-blue-600 focus:ring-blue-500"
                    />
                    משתמש פעיל במערכת
                  </label>
                </div>

                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <Lock size={16} className="text-amber-600" /> סיסמא חדשה
                  </label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      placeholder="השאר ריק כדי לא לשנות"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full p-2 border rounded-lg outline-none bg-white focus:ring-2 focus:ring-amber-500 pr-10 pl-10"
                    />
                    <Key className="absolute right-3 top-2.5 text-amber-400" size={18} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-2.5 text-gray-400 hover:text-amber-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Permissions Section */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  <Shield size={18} className="text-blue-600" /> ניהול הרשאות גישה למסכים
                </h3>
                <div className="overflow-x-auto border rounded-xl shadow-inner bg-white">
                  <table className="w-full text-right text-sm min-w-[800px]">
                    <thead className="bg-slate-800 text-white sticky top-0 z-10">
                      <tr>
                        <th className="p-3 whitespace-nowrap">מסך / מודול</th>
                        <th className="p-3 text-center whitespace-nowrap">צפייה</th>
                        <th className="p-3 text-center whitespace-nowrap">יצירה</th>
                        <th className="p-3 text-center whitespace-nowrap">עריכה</th>
                        <th className="p-3 text-center whitespace-nowrap">מחיקה</th>
                        <th className="p-3 text-center whitespace-nowrap">ייצוא</th>
                        <th className="p-3 text-center whitespace-nowrap">אישור</th>
                        <th className="p-3 text-center whitespace-nowrap">הנפקת תעודות</th>
                        <th className="p-3 text-center whitespace-nowrap">ייבוא אקסל</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {permissions.map(p => (
                        <tr key={p.screenKey} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-700 bg-slate-50">{screens.find(s => s.key === p.screenKey)?.label}</td>
                          <td className="p-3 text-center"><input type="checkbox" checked={p.canView} onChange={() => togglePermission(p.screenKey, 'canView')} className="w-5 h-5 cursor-pointer accent-blue-600" /></td>
                          <td className="p-3 text-center"><input type="checkbox" checked={p.canCreate} onChange={() => togglePermission(p.screenKey, 'canCreate')} className="w-5 h-5 cursor-pointer accent-blue-600" /></td>
                          <td className="p-3 text-center"><input type="checkbox" checked={p.canEdit} onChange={() => togglePermission(p.screenKey, 'canEdit')} className="w-5 h-5 cursor-pointer accent-blue-600" /></td>
                          <td className="p-3 text-center"><input type="checkbox" checked={p.canDelete} onChange={() => togglePermission(p.screenKey, 'canDelete')} className="w-5 h-5 cursor-pointer accent-blue-600" /></td>
                          <td className="p-3 text-center"><input type="checkbox" checked={p.canExport} onChange={() => togglePermission(p.screenKey, 'canExport')} className="w-5 h-5 cursor-pointer accent-blue-600" /></td>
                          <td className="p-3 text-center"><input type="checkbox" checked={p.canApprove} onChange={() => togglePermission(p.screenKey, 'canApprove')} className="w-5 h-5 cursor-pointer accent-blue-600" /></td>
                          <td className="p-3 text-center"><input type="checkbox" checked={p.canGenerateCertificates} onChange={() => togglePermission(p.screenKey, 'canGenerateCertificates')} className="w-5 h-5 cursor-pointer accent-blue-600" /></td>
                          <td className="p-3 text-center"><input type="checkbox" checked={p.canImportExcel} onChange={() => togglePermission(p.screenKey, 'canImportExcel')} className="w-5 h-5 cursor-pointer accent-blue-600" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-6 border-t flex flex-col sm:flex-row justify-end gap-3 bg-slate-50">
              <button 
                onClick={() => setEditingUser(null)}
                className="w-full sm:w-auto px-6 py-3 sm:py-2 border border-gray-300 rounded-lg font-bold text-gray-600 hover:bg-white transition-colors min-h-[44px]"
              >
                ביטול
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto px-10 py-3 sm:py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 min-h-[44px]"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : 'שמור שינויים'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DatabaseFixModal 
        isOpen={!!dbError} 
        onClose={() => setDbError(null)} 
        error={dbError || ''} 
      />
    </div>
  );
};

export default Users;
