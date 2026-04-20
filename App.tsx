
import React from 'react';
import { User, UserRole } from './types';
import { authService } from './services/authService';
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/Layout';
import { PermissionProvider, usePermissions } from './src/context/PermissionContext';
import { SyncProvider, useSync } from './src/context/SyncContext';
import { dbService } from './services/dbService';
import { pullService } from './services/pullService';
import { syncEngine } from './services/syncEngine';
import { AlertCircle, Wifi, WifiOff, RefreshCw, CloudSync } from 'lucide-react';
import { APP_SCREENS } from './src/constants/screens';
import { useBotRealtime } from './hooks/useBotRealtime';

const AppContent: React.FC<{ user: User | null, setUser: (u: User | null) => void }> = ({ user, setUser }) => {
  useBotRealtime();
  const [activeScreen, setActiveScreen] = React.useState('dashboard');
  const [showRegister, setShowRegister] = React.useState(false);
  const [permissionError, setPermissionError] = React.useState<string | null>(null);
  const { hasPermission, loading, refreshPermissions } = usePermissions();

  // Check permissions on every screen change to ensure real-time enforcement
  React.useEffect(() => {
    const checkPermissions = async () => {
      if (user) {
        const screenKey = activeScreen === 'signup' ? 'users' : activeScreen;
        
        // Dashboard is always accessible
        if (screenKey === 'dashboard') return;

        // ADMIN role always has access to all screens
        if (user.role === UserRole.ADMIN) return;

        // Use local check for immediate offline support
        const canView = await dbService.checkPermissionLocally(user.id, screenKey, 'can_view');
        
        // If access is lost
        if (!canView) {
          setPermissionError("הגישה נדחתה. הינך מועבר לעמוד אחר שיש לך הרשאה.");
          
          // Wait a bit to show the message then redirect
          setTimeout(async () => {
            setPermissionError(null);
            
            // Find first available screen from local permissions
            let firstAvailable = 'dashboard';
            for (const s of APP_SCREENS) {
              if (s.key === 'dashboard') continue;
              const hasAccess = await dbService.checkPermissionLocally(user.id, s.key, 'can_view');
              if (hasAccess) {
                firstAvailable = s.key;
                break;
              }
            }
            
            if (firstAvailable !== activeScreen) {
              setActiveScreen(firstAvailable);
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

    return (
      <React.Suspense fallback={
        <div className="h-full flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <Component user={user} onNavigateToSignup={() => setActiveScreen('signup')} />
      </React.Suspense>
    );
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

  // Listen for auth changes to update UI and manage sync services
  React.useEffect(() => {
    let isSyncInitialized = false;

    const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
      console.log(`[Auth] State change: ${event}`);
      
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        setUser(null);
        isSyncInitialized = false;
        syncEngine.stop();
        pullService.stopPeriodicSync();
      } else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        if (isSyncInitialized) return;
        isSyncInitialized = true;
        
        console.log('[Auth] Initializing sync services...');
        
        // Start everything here and ONLY here
        syncEngine.start();
        pullService.startPeriodicSync();
        
        // Fetch user profile and start hydration
        authService.getUserProfile(session.user.id).then(u => {
          if (u) {
            setUser(u);
            dbService.hydrateMetadata(u.name);
            dbService.syncPermissions(u.id);
          }
        });
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
