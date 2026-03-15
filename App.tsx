
import React from 'react';
import { User, UserRole } from './types';
import { authService } from './services/authService';
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import { dbService } from './services/dbService';
import { offlineService } from './services/offlineService';
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

import { SyncProvider, useSync } from './context/SyncContext';

const AppContent: React.FC = () => {
  const [user, setUser] = React.useState<User | null>(authService.getCurrentUser());
  const [activeScreen, setActiveScreen] = React.useState('dashboard');
  const [showRegister, setShowRegister] = React.useState(false);
  const { startSync } = useSync();

  // Listen for auth changes to update UI when session expires or refresh fails
  React.useEffect(() => {
    const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session) || (event === 'INITIAL_SESSION' && !session)) {
        setUser(null);
      }
    });

    // Handle Online/Offline Sync
    const handleOnline = () => {
      console.log('App is online, processing outbox and hydrating data...');
      dbService.processOutbox();
      startSync();
    };

    window.addEventListener('online', handleOnline);

    // Initial check
    if (navigator.onLine) {
      dbService.processOutbox();
      startSync();
    }

    // Storage Estimate Check
    offlineService.getStorageEstimate().then(estimate => {
      if (estimate) {
        console.log(`Storage usage: ${Math.round(estimate.usage! / 1024 / 1024)}MB / ${Math.round(estimate.quota! / 1024 / 1024)}MB`);
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
  };

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
    return <Login onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <Dashboard user={user} />;
      case 'inspections':
        return <Inspections user={user} />;
      case 'customers':
        return <Customers user={user} />;
      case 'certificates':
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.OFFICE) return <Dashboard user={user} />;
        return <Certificates user={user} />;
      case 'users':
        if (user.role !== UserRole.ADMIN) return <Dashboard user={user} />;
        return <Users onNavigateToSignup={() => setActiveScreen('signup')} />;
      case 'signup':
        return (
          <Register 
            onBackToLogin={() => setActiveScreen('users')} 
            onRegisterSuccess={() => setActiveScreen('users')} 
            backButtonText="חזור לניהול משתמשים"
          />
        );
      case 'form_builder':
        if (user.role !== UserRole.ADMIN) return <Dashboard user={user} />;
        return <FormBuilder />;
      case 'diagnostics':
        if (user.role !== UserRole.ADMIN) return <Dashboard user={user} />;
        return <Diagnostics />;
      case 'import':
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.OFFICE) return <Dashboard user={user} />;
        return <ImportExcel />;
      case 'db_manager':
        if (user.role !== UserRole.ADMIN) return <Dashboard user={user} />;
        return <DbManager />;
      case 'audit_logs':
        if (user.role !== UserRole.ADMIN) return <Dashboard user={user} />;
        return <AuditLogs user={user} />;
      case 'triggers':
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.OFFICE) return <Dashboard user={user} />;
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
  return (
    <SyncProvider>
      <AppContent />
    </SyncProvider>
  );
};

export default App;
