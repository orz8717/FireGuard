import { useState, useEffect, useCallback } from 'react';

export type ConnectionStatus = 'connected' | 'disconnected' | 'checking' | 'supabase-error';

export interface ConnectionState {
  internet: boolean;
  supabase: boolean;
  status: ConnectionStatus;
  lastChecked: Date | null;
  check: () => Promise<void>;
}

const checkInternet = async (): Promise<boolean> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch('https://www.google.com/favicon.ico', {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return res.type === 'opaque';
  } catch {
    return false;
  } finally {
    clearTimeout(id);
  }
};

const checkDatabase = async (): Promise<boolean> => {
  try {
    const token = localStorage.getItem('fireguard_token');
    if (!token) return true;
    const res = await fetch('/api/admin-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'from', table: 'users', method: 'select', columns: 'id', limit: 1 }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const useConnectionStatus = (): ConnectionState => {
  const [internet, setInternet] = useState<boolean>(true);
  const [supabaseConn, setSupabaseConn] = useState<boolean>(true);
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const check = useCallback(async () => {
    setStatus('checking');
    const [internetRes, dbRes] = await Promise.all([
      checkInternet(),
      checkDatabase(),
    ]);

    setInternet(internetRes);
    setSupabaseConn(dbRes);
    setLastChecked(new Date());

    if (!internetRes) {
      setStatus('disconnected');
    } else if (!dbRes) {
      setStatus('supabase-error');
    } else {
      setStatus('connected');
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 30_000);
    window.addEventListener('online', check);
    window.addEventListener('offline', check);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', check);
      window.removeEventListener('offline', check);
    };
  }, [check]);

  return { internet, supabase: supabaseConn, status, lastChecked, check };
};
