
import React from 'react';
import { dbService } from '../services/dbService';
import { AuditLog, User, UserRole } from '../types';
import { 
  History, 
  Search, 
  Clock, 
  User as UserIcon, 
  Activity, 
  Info, 
  AlertCircle,
  Loader2,
  ShieldAlert,
  Filter,
  RefreshCw
} from 'lucide-react';

interface AuditLogsProps {
  user: User;
}

const AuditLogs: React.FC<AuditLogsProps> = ({ user }) => {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showOnlyFailures, setShowOnlyFailures] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedErrorId, setExpandedErrorId] = React.useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dbService.getAuditLogs();
      setLogs(data);
    } catch (err: any) {
      setError('שגיאה בטעינת יומן פעילות. וודא שקיימת טבלת audit_logs ב-Supabase.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (user.role === UserRole.ADMIN) {
      fetchLogs();
    }
  }, [user]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = (log.user_name && log.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.action_type && log.action_type.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.description && log.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (showOnlyFailures) {
      return matchesSearch && log.status === 'FAILED';
    }
    return matchesSearch;
  });

  if (user.role !== UserRole.ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-6 text-center">
        <div className="w-24 h-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center shadow-inner">
          <ShieldAlert size={56} />
        </div>
        <div className="space-y-2">
          <h3 className="text-3xl font-black text-slate-800">גישה נדחתה</h3>
          <p className="text-slate-500 font-bold max-w-md mx-auto">
            אין לך הרשאות מתאימות לצפייה ביומן הפעילות של המערכת.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-8 rounded-[2.5rem] border shadow-sm gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-sm">
            <History size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">יומן פעילות (Audit Log)</h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">מעקב אחר פעולות משתמשים במערכת</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full lg:w-auto items-center justify-center lg:justify-end">
          <label className="flex items-center gap-3 cursor-pointer">
            <span className="text-sm font-black text-slate-600">רק שגיאות</span>
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={showOnlyFailures}
                onChange={(e) => setShowOnlyFailures(e.target.checked)}
              />
              <div className="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:bg-red-500 transition-all duration-300"></div>
              <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all duration-300 peer-checked:translate-x-6"></div>
            </div>
          </label>
          
          <div className="relative flex-1 min-w-[300px] max-w-md">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="חיפוש לפי משתמש, פעולה או תיאור..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-14 pl-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-full outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-base" 
            />
          </div>
          
          <button 
            onClick={fetchLogs}
            className="p-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl hover:bg-slate-50 hover:border-slate-200 transition-all shadow-sm active:scale-95"
            title="רענן נתונים"
          >
            <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-6 rounded-3xl border border-red-100 flex items-start gap-4 animate-in slide-in-from-top-2">
          <AlertCircle size={24} className="text-red-600 flex-shrink-0" />
          <div>
            <h4 className="font-black text-red-800">שגיאה</h4>
            <p className="text-red-600 font-bold text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-40 space-y-4">
            <Loader2 className="animate-spin text-blue-600" size={48} />
            <p className="text-slate-500 font-black">טוען יומן פעילות...</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto scrollbar-thin">
              <table className="w-full text-right text-base">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="p-6 font-black text-slate-400 uppercase tracking-wider text-xs">זמן</th>
                    <th className="p-6 font-black text-slate-400 uppercase tracking-wider text-xs">משתמש</th>
                    <th className="p-6 font-black text-slate-400 uppercase tracking-wider text-xs">סוג פעולה</th>
                    <th className="p-6 font-black text-slate-400 uppercase tracking-wider text-xs">תיאור</th>
                    <th className="p-6 font-black text-slate-400 uppercase tracking-wider text-xs text-center">סטטוס</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLogs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr 
                        className={`hover:bg-slate-50/80 transition-all group ${log.status === 'FAILED' ? 'cursor-pointer' : ''}`}
                        onClick={() => {
                          if (log.status === 'FAILED') {
                            setExpandedErrorId(expandedErrorId === log.id ? null : log.id);
                          }
                        }}
                      >
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-slate-100 text-slate-400 rounded-xl group-hover:bg-blue-100 group-hover:text-blue-600 transition-all shadow-sm">
                              <Clock size={18} />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-slate-800 text-lg leading-tight">
                                {new Date(log.created_at).toLocaleDateString('he-IL')}
                              </span>
                              <span className="text-xs text-slate-400 font-bold">
                                {new Date(log.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-black text-sm border-2 border-white shadow-sm">
                              {log.user_name ? log.user_name.charAt(0) : '?'}
                            </div>
                            <span className="font-black text-slate-700 text-lg">{log.user_name}</span>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <span className="font-black text-blue-700 bg-blue-50 px-4 py-2 rounded-xl text-xs uppercase tracking-widest border border-blue-100 shadow-sm">
                              {log.action_type}
                            </span>
                            <Activity size={18} className="text-blue-400 animate-pulse" />
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <Info size={18} className="text-slate-300" />
                            <span className="text-slate-600 font-bold text-base max-w-xl" title={log.description}>
                              {log.description}
                            </span>
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase shadow-sm border ${
                            log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                            log.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                            'bg-red-50 text-red-700 border-red-100'
                          }`}>
                            {log.status === 'SUCCESS' ? 'הצליח' : log.status === 'PENDING' ? 'ממתין' : 'נכשל'}
                          </span>
                        </td>
                      </tr>
                      {expandedErrorId === log.id && log.status === 'FAILED' && log.error_details && (
                        <tr className="bg-red-50/30">
                          <td colSpan={5} className="p-4 border-t border-red-100">
                            <div className="text-right">
                              <h4 className="text-sm font-bold text-red-800 mb-2">פרטי שגיאה:</h4>
                              <pre className="text-xs text-red-600 bg-white p-3 rounded-xl border border-red-100 overflow-x-auto text-left" dir="ltr">
                                {typeof log.error_details === 'string' ? log.error_details : JSON.stringify(log.error_details, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-20 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4 text-slate-400">
                          <Filter size={48} className="opacity-20" />
                          <p className="font-bold italic">לא נמצאו פעולות התואמות את החיפוש</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <div 
                  key={log.id} 
                  className={`p-4 space-y-3 ${log.status === 'FAILED' ? 'cursor-pointer hover:bg-slate-50/50' : ''}`}
                  onClick={() => {
                    if (log.status === 'FAILED') {
                      setExpandedErrorId(expandedErrorId === log.id ? null : log.id);
                    }
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs">
                        {log.user_name ? log.user_name.charAt(0) : '?'}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{log.user_name}</span>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock size={12} />
                          <span>{new Date(log.created_at).toLocaleDateString('he-IL')}</span>
                          <span>{new Date(log.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                      log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 
                      log.status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 
                      'bg-red-50 text-red-700'
                    }`}>
                      {log.status === 'SUCCESS' ? 'הצליח' : log.status === 'PENDING' ? 'ממתין' : 'נכשל'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Activity size={14} className="text-blue-400" />
                    <span className="font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg text-[10px] uppercase tracking-wider">
                      {log.action_type}
                    </span>
                  </div>
                  
                  <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl">
                    <Info size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-600 text-sm font-medium">
                      {log.description}
                    </span>
                  </div>

                  {expandedErrorId === log.id && log.status === 'FAILED' && log.error_details && (
                    <div className="mt-3 bg-red-50 p-3 rounded-xl border border-red-100">
                      <h4 className="text-sm font-bold text-red-800 mb-2">פרטי שגיאה:</h4>
                      <pre className="text-xs text-red-600 bg-white p-3 rounded-xl border border-red-100 overflow-x-auto text-left" dir="ltr">
                        {typeof log.error_details === 'string' ? log.error_details : JSON.stringify(log.error_details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
              {filteredLogs.length === 0 && (
                <div className="p-10 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4 text-slate-400">
                    <Filter size={48} className="opacity-20" />
                    <p className="font-bold italic">לא נמצאו פעולות התואמות את החיפוש</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
