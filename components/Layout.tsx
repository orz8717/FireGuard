
import React from 'react';
import { ConnectionBadge } from '../src/components/ConnectionBadge';
import { 
  LayoutDashboard, 
  Users, 
  ClipboardCheck, 
  FileText, 
  Settings, 
  Database, 
  LogOut, 
  Upload,
  Trello,
  Activity,
  History,
  Menu,
  X,
  Zap,
  Info,
  Wifi,
  WifiOff,
  RefreshCw,
  CloudSync
} from 'lucide-react';
import { User, UserRole } from '../types';
import { usePermissions } from '../src/context/PermissionContext';
import { useSync } from '../src/context/SyncContext';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  activeScreen: string;
  setActiveScreen: (screen: string) => void;
}

import { APP_SCREENS } from '../src/constants/screens';

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, activeScreen, setActiveScreen }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { hasPermission } = usePermissions();

  const menuItems = APP_SCREENS
    .filter(screen => screen.showInMenu)
    .map(screen => ({
      id: screen.id || screen.key,
      label: screen.label,
      icon: screen.icon,
      screenKey: screen.key
    }));

  const visibleMenuItems = menuItems.filter(item => {
    return hasPermission(item.screenKey, 'canView');
  });

  const handleNavigation = (id: string) => {
    setActiveScreen(id);
    setIsMobileMenuOpen(false);
  };

  const SidebarContent = () => {
  const { isOnline: syncOnline, pendingCount, isSyncing, isRetrying, triggerSync, lastSyncTime } = useSync();
  
  // הוספת Listener מקומי כדי להבטיח תגובה מיידית ב-UI
  const [localOnline, setLocalOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleStatus = () => setLocalOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  // אנחנו נשתמש ב-AND לוגי: גם שהדפדפן מדווח אונליין וגם שהסינכרון מדווח אונליין
  const isOnline = localOnline && syncOnline;

  const getStatusMessage = () => {
    if (isSyncing) return 'מסנכרן...';
    return isOnline ? 'מחובר' : 'לא מחובר';
  };

  return (
    
      <div className="flex flex-col h-full bg-slate-900 text-white">
        <div className="p-6 text-center border-b border-slate-800">
          <div className="flex items-center justify-between md:justify-center mb-4">
            <div>
              <h1 className="text-3xl font-black text-blue-500 tracking-tighter">FireGuard</h1>
              <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-widest">מערכת ניהול גילוי אש</p>
            </div>
            <button className="md:hidden text-slate-300" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={24} />
            </button>
          </div>

          {/* Sync Status at the top */}
          <div className="flex flex-col gap-2">
            <ConnectionBadge />
            {lastSyncTime && (
              <div className="text-[9px] text-slate-500 text-center">
                סנכרון אחרון: {lastSyncTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}

            {isRetrying && (
              <div className="bg-rose-500/10 text-rose-500 px-3 py-2 rounded-lg flex items-center gap-2 animate-pulse border border-rose-500/20">
                <RefreshCw size={14} className="animate-spin" />
                <span className="text-[10px] font-medium">מנסה שוב... (שגיאת רשת)</span>
              </div>
            )}

            {!isRetrying && pendingCount > 0 && (
              <div className="bg-amber-500/10 text-amber-500 px-3 py-2 rounded-lg flex items-center gap-2 animate-pulse border border-amber-500/20">
                <CloudSync size={14} />
                <span className="text-[10px] font-medium">{pendingCount} שינויים ממתינים</span>
              </div>
            )}
          </div>
        </div>
        
        <nav className="flex-1 mt-4 overflow-y-auto scrollbar-none">
          {visibleMenuItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={`w-full flex items-center px-8 py-4 transition-all duration-200 group ${
                activeScreen === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className={`transition-transform duration-200 ${activeScreen === item.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                {item.icon}
              </div>
              <span className={`mr-4 font-bold text-sm transition-all ${activeScreen === item.id ? 'translate-x-1' : ''}`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Logout button back at the bottom */}
        <div className="p-6 border-t border-slate-800/50">
          <button
            onClick={onLogout}
            className="w-full flex items-center px-6 py-4 text-slate-400 hover:bg-red-500/10 hover:text-red-500 rounded-2xl transition-all font-bold group"
          >
            <LogOut size={20} className="ml-4 transition-transform group-hover:-translate-x-1" />
            <span>יציאה</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden" dir="rtl">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[100] md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar (Drawer) */}
      <aside className={`fixed inset-y-0 right-0 w-72 z-[101] transform transition-transform duration-300 md:hidden ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Responsive Header */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-8 shadow-sm flex-shrink-0 z-40">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h2 className="text-base md:text-xl font-semibold text-gray-800 truncate max-w-[150px] sm:max-w-xs md:max-w-md">
              {menuItems.find(i => i.id === activeScreen)?.label || 'דף הבית'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-bold text-gray-700">{user.name}</p>
              <p className="text-[10px] md:text-xs text-gray-500">
                {user.role === UserRole.ADMIN ? 'מנהל מערכת' : 'משתמש'}
              </p>
            </div>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border border-blue-200 shrink-0">
              {user.name ? user.name.charAt(0) : '?'}
            </div>
          </div>
        </header>

        {/* Dynamic Screen Content */}
        <main className="flex-1 overflow-auto p-2 sm:p-4 md:p-8 bg-slate-50 scrollbar-thin">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
