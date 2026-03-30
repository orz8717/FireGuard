import React from 'react';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { Wifi, WifiOff, Database, RefreshCw, AlertTriangle } from 'lucide-react';

export const ConnectionBadge: React.FC = () => {
  const { internet, supabase, status, lastChecked, check } = useConnectionStatus();

  const config = {
    connected: {
      label: 'מחובר',
      color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    },
    disconnected: {
      label: 'אין אינטרנט',
      color: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    },
    'supabase-error': {
      label: 'שגיאת מסד נתונים',
      color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    },
    checking: {
      label: 'בודק...',
      color: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    },
  };

  const current = config[status];

  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${current.color}`}>
      <div className="flex items-center gap-2">
        {status !== 'checking' && (
          <>
            {internet ? <Wifi size={13} /> : <WifiOff size={13} />}
            <Database size={13} className={!supabase ? 'opacity-40' : ''} />
            {status === 'supabase-error' && <AlertTriangle size={13} />}
          </>
        )}
        <span className="text-[10px] font-bold uppercase tracking-wider">{current.label}</span>
      </div>

      <button
        onClick={() => check()}
        disabled={status === 'checking'}
        className={`p-1 hover:bg-current/10 rounded-full transition-transform ${status === 'checking' ? 'animate-spin' : ''}`}
        title={lastChecked ? lastChecked.toLocaleTimeString('he-IL') : ''}
      >
        <RefreshCw size={12} />
      </button>
    </div>
  );
};
