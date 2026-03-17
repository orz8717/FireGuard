
import React from 'react';
import { User, UserRole } from './types';
import { authService } from './services/authService';
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/Layout';
import { PermissionProvider, usePermissions } from './src/context/PermissionContext';
import { SyncProvider } from './src/context/SyncContext';
import { AlertCircle } from 'lucide-react';
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
    // Special case for signup (registration of new users by admin)
    if (activeScreen === 'signup') {
      if (!hasPermission('users', 'canCreate')) {
        const Dashboard = APP_SCREENS.find(s => s.key === 'dashboard')?.component;
        return Dashboard ? <Dashboard user={user} /> : null;
      }
      return (
        <Register 
          onBackToLogin={() => setActiveScreen('users')} 
          onRegisterSuccess={() => setActiveScreen('users')} 
          backButtonText="חזור לניהול משתמשים"
        />
      );
    }

    // Find screen by id or key from central config
    const screen = APP_SCREENS.find(s => (s.id || s.key) === activeScreen);
    
    if (!screen || !screen.component) {
      // Fallback to dashboard
      const Dashboard = APP_SCREENS.find(s => s.key === 'dashboard')?.component;
      return Dashboard ? <Dashboard user={user} /> : null;
    }

    // Check permission for the screen (unless it's dashboard)
    if (activeScreen !== 'dashboard' && !hasPermission(screen.key, 'canView')) {
      const Dashboard = APP_SCREENS.find(s => s.key === 'dashboard')?.component;
      return Dashboard ? <Dashboard user={user} /> : null;
    }

    const Component = screen.component;
    
    // Most components accept user as a prop
    return <Component user={user} onNavigateToSignup={() => setActiveScreen('signup')} />;
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
