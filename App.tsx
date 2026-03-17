
import React from 'react';
import { User, UserRole } from './types';
import { authService } from './services/authService';
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inspections from './pages/Inspections';
import Users from './pages/Users';
import FormBuilder from './pages/FormBuilder';
import DbManager from './pages/DbManager';
import Customers from './pages/Customers';
import Diagnostics from './pages/Diagnostics';
import ImportExcel from './pages/ImportExcel';
import Certificates from './pages/Certificates';
import AuditLogs from './pages/AuditLogs';
import TriggersPage from './pages/TriggersPage';
import UpdateTables from './pages/UpdateTables';

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="bg-white p-8 rounded-xl border shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
    <h2 className="text-2xl font-bold mb-4">{title}</h2>
    <p className="text-gray-600">מסך זה נמצא בפיתוח ויכלול את כל הנתונים הרלוונטיים עבור {title}.</p>
  </div>
);

import { PermissionProvider, usePermissions } from './src/context/PermissionContext';
import { SyncProvider } from './src/context/SyncContext';

import { AlertCircle, Loader2 } from 'lucide-react';

import { APP_SCREENS } from './src/constants/screens';

const AppContent: React.FC<{ user: User | null, setUser: (u: User | null) => void }> = ({ user, setUser }) => {
  const [activeScreen, setActiveScreen] = React.useState('dashboard');
  const [showRegister, setShowRegister] = React.useState(false);
  const [permissionError, setPermissionError] = React.useState<string | null>(null);
  const { hasPermission, loading, refreshPermissions } = usePermissions();

  // Refresh permissions on every screen change to ensure real-time enforcement
  React.useEffect(() => {
    const checkPermissions = async () => {
      if (user) {
        // Perform background check without blocking UI
        const freshPermissions = await refreshPermissions(true);
        
        // After refresh, verify if the user still has access to the current screen
        const screenKey = activeScreen === 'signup' ? 'users' : activeScreen;
        
        // Admin always has access
        if (user.role === UserRole.ADMIN) return;

        const perm = freshPermissions.find(p => p.screenKey === screenKey);
        const canView = perm ? !!perm.canView : false;
        
        // If access is lost
        if (!canView) {
          setPermissionError("הגישה נדחתה. הינך מועבר לעמוד אחר שיש לך הרשאה.");
          
          // Wait a bit to show the message then redirect
          setTimeout(() => {
            setPermissionError(null);
            
            // Find first available screen from fresh data using central config
            const firstAvailable = APP_SCREENS.find(s => {
              if (s.key === 'dashboard') return true;
              const p = freshPermissions.find(p => p.screenKey === s.key);
              return p ? !!p.canView : false;
            })?.key;
            
            if (firstAvailable && firstAvailable !== activeScreen) {
              setActiveScreen(firstAvailable);
            } else if (!firstAvailable) {
              setActiveScreen('dashboard');
            }
          }, 3000);
        }
      }
    };
    
    checkPermissions();
  }, [activeScreen, user?.id]);

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
  };

  if (!user) {
    if (showRegister) {
      return (
        <Register 
          onBackToLogin={() => setShowRegister(false)} 
          onRegisterSuccess={() => setShowRegister(false)} 
        />
      );
    }
    return <Login onLogin={(u) => setUser(u)} />;
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-bold">טוען הרשאות...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeScreen) {
      case 'dashboard':
        if (!hasPermission('dashboard', 'canView')) {
          // If no dashboard permission, try to find the first available screen from central config
          const firstAvailable = APP_SCREENS.find(s => hasPermission(s.key, 'canView'))?.key;
          
          if (firstAvailable && firstAvailable !== activeScreen) {
            setActiveScreen(firstAvailable);
            return null; // Will re-render with new screen
          }
        }
        return <Dashboard user={user} />;
      case 'inspections':
        if (!hasPermission('inspections', 'canView')) return <Dashboard user={user} />;
        return <Inspections user={user} />;
      case 'customers':
        if (!hasPermission('customers', 'canView')) return <Dashboard user={user} />;
        return <Customers user={user} />;
      case 'certificates':
        if (!hasPermission('certificates', 'canView')) return <Dashboard user={user} />;
        return <Certificates user={user} />;
      case 'users':
        if (!hasPermission('users', 'canView')) return <Dashboard user={user} />;
        return <Users onNavigateToSignup={() => setActiveScreen('signup')} />;
      case 'signup':
        if (!hasPermission('users', 'canCreate')) return <Dashboard user={user} />;
        return (
          <Register 
            onBackToLogin={() => setActiveScreen('users')} 
            onRegisterSuccess={() => setActiveScreen('users')} 
            backButtonText="חזור לניהול משתמשים"
          />
        );
      case 'form_builder':
        if (!hasPermission('form_builder', 'canView')) return <Dashboard user={user} />;
        return <FormBuilder />;
      case 'diagnostics':
        if (!hasPermission('diagnostics', 'canView')) return <Dashboard user={user} />;
        return <Diagnostics />;
      case 'import':
        if (!hasPermission('import', 'canView')) return <Dashboard user={user} />;
        return <ImportExcel />;
      case 'db_manager':
        if (!hasPermission('db_manager', 'canView')) return <Dashboard user={user} />;
        return <DbManager />;
      case 'audit_logs':
        if (!hasPermission('audit_logs', 'canView')) return <Dashboard user={user} />;
        return <AuditLogs user={user} />;
      case 'triggers':
        if (!hasPermission('triggers', 'canView')) return <Dashboard user={user} />;
        return <TriggersPage user={user} />;
      case 'update_tables':
        if (!hasPermission('update_tables', 'canView')) return <Dashboard user={user} />;
        return <UpdateTables user={user} />;
      default:
        return <Dashboard user={user} />;
    }
  };

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout} 
      activeScreen={activeScreen} 
      setActiveScreen={setActiveScreen}
    >
      {permissionError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4">
          <div className="bg-red-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-red-500">
            <AlertCircle size={20} />
            <span className="font-bold">{permissionError}</span>
          </div>
        </div>
      )}
      {renderContent()}
    </Layout>
  );
};

const App: React.FC = () => {
  const [user, setUser] = React.useState<User | null>(authService.getCurrentUser());

  // Listen for auth changes to update UI when session expires or refresh fails
  React.useEffect(() => {
    const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SyncProvider>
      <PermissionProvider user={user}>
        <AppContent user={user} setUser={setUser} />
      </PermissionProvider>
    </SyncProvider>
  );
};

export default App;
