
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

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="bg-white p-8 rounded-xl border shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
    <h2 className="text-2xl font-bold mb-4">{title}</h2>
    <p className="text-gray-600">מסך זה נמצא בפיתוח ויכלול את כל הנתונים הרלוונטיים עבור {title}.</p>
  </div>
);

import { PermissionProvider, usePermissions } from './src/context/PermissionContext';
import { SyncProvider } from './src/context/SyncContext';

const AppContent: React.FC<{ user: User | null, setUser: (u: User | null) => void }> = ({ user, setUser }) => {
  const [activeScreen, setActiveScreen] = React.useState('dashboard');
  const [showRegister, setShowRegister] = React.useState(false);
  const { hasPermission, loading, refreshPermissions } = usePermissions();

  // Refresh permissions on every screen change to ensure real-time enforcement
  React.useEffect(() => {
    if (user) {
      refreshPermissions();
    }
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
          // If no dashboard permission, try to find the first available screen
          const firstAvailable = [
            'customers', 'inspections', 'certificates', 'users', 'form_builder', 
            'diagnostics', 'import', 'db_manager', 'audit_logs', 'triggers'
          ].find(s => hasPermission(s, 'canView'));
          
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
