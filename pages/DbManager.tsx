
import React from 'react';
import { dbService } from '../services/dbService';
import { authService } from '../services/authService';
import { UserRole } from '../types';
import { 
  Database, 
  Search, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  Table as TableIcon,
  ChevronLeft,
  AlertTriangle,
  FileJson,
  AlertCircle,
  Zap,
  Info,
  Copy
} from 'lucide-react';

import { usePermissions } from '../src/context/PermissionContext';

const DbManager: React.FC = () => {
  const { hasPermission } = usePermissions();
  const canDelete = hasPermission('db_manager', 'canDelete');
  const canView = hasPermission('db_manager', 'canView');

  const [tables, setTables] = React.useState<{ id: string; label: string }[]>([]);
  const [selectedTable, setSelectedTable] = React.useState<{ id: string; label: string } | null>(null);
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sidebarLoading, setSidebarLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [deletingId, setDeletingId] = React.useState<string | number | null>(null);
  const [confirmConfig, setConfirmConfig] = React.useState<{ id: string | number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchTables = async (forceReload = false) => {
    setSidebarLoading(true);
    setError(null);
    try {
      if (forceReload) {
        await dbService.reloadSchemaCache();
        // Wait a bit for Supabase to actually perform the reload
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      const list = await dbService.getTablesList();
      setTables(list);
      
      // Auto-select logic
      if (!selectedTable && list.length > 0) {
        setSelectedTable(list[0]);
      } else if (selectedTable && !list.find(t => t.id === selectedTable.id)) {
        setSelectedTable(list.length > 0 ? list[0] : null);
      }
    } catch (err: any) {
      setError('שגיאת תקשורת: וודא שהרצת את קוד ה-SQL ב-Supabase');
    } finally {
      setSidebarLoading(false);
    }
  };

  React.useEffect(() => {
    fetchTables(true);
  }, []);

  React.useEffect(() => {
    if (selectedTable) {
      fetchData();
    } else {
      setData([]);
    }
  }, [selectedTable]);

  const fetchData = async () => {
    if (!selectedTable) return;
    setLoading(true);
    try {
      const result = await dbService.getRawTableData(selectedTable.id);
      setData(result);
    } catch (err) {
      setError('שגיאה בטעינת נתונים מהטבלה');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmConfig || !selectedTable) return;
    const { id } = confirmConfig;
    setDeletingId(id);
    setConfirmConfig(null);
    try {
      await dbService.deleteRecord(selectedTable.id, id);
      setData(prev => prev.filter(item => (item.ROWID || item.id) !== id));
    } catch (err) {
      alert('שגיאה במחיקת הרשומה. ייתכן שיש לה קשרים לטבלאות אחרות.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredData = data.filter(item => {
    const vals = Object.values(item).join(' ').toLowerCase();
    return vals ? vals.includes(searchTerm.toLowerCase()) : false;
  });

  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  const SQL_HELPER = `-- SQL לתיקון שגיאת "Database error creating new user" (הרץ ב-SQL Editor):

-- 1. ביטול הטריגר הקיים שגורם לשגיאה
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. יצירת פונקציה חדשה ובטוחה יותר לטיפול במשתמשים חדשים
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, is_active)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', ''), 
    COALESCE(new.raw_user_meta_data->>'role', 'USER'), 
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. הפעלה מחדש של הטריגר
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. פונקציות עזר לאבחון וניהול סכמה (חובה עבור Diagnostics)
CREATE OR REPLACE FUNCTION get_schema_metadata()
RETURNS TABLE(table_name text, column_name text, data_type text) 
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT table_name::text, column_name::text, data_type::text
  FROM information_schema.columns
  WHERE table_schema = 'public';
$$;

CREATE OR REPLACE FUNCTION get_triggers()
RETURNS TABLE(table_name text, trigger_name text) 
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT event_object_table::text, trigger_name::text
  FROM information_schema.triggers
  WHERE trigger_schema = 'public';
$$;

CREATE OR REPLACE FUNCTION add_column_to_table(p_table_name TEXT, p_column_name TEXT, p_column_type TEXT)
RETURNS void AS $$
BEGIN
    EXECUTE 'ALTER TABLE ' || quote_ident(p_table_name) || ' ADD COLUMN IF NOT EXISTS ' || quote_ident(p_column_name) || ' ' || 
            CASE 
                WHEN p_column_type = 'NUMERIC' THEN 'NUMERIC' 
                WHEN p_column_type = 'BOOLEAN' THEN 'BOOLEAN' 
                WHEN p_column_type = 'JSONB' THEN 'JSONB'
                WHEN p_column_type = 'UUID' THEN 'UUID'
                ELSE 'TEXT' 
            END;
    NOTIFY pgrst, 'reload schema';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. תשתית לשמירה אטומית (Atomic Parent-Child Sync)
CREATE OR REPLACE FUNCTION process_child_data_on_save()
RETURNS TRIGGER AS $$
DECLARE
    child_table TEXT; child_config JSONB; fk_col TEXT; records JSONB; record_item JSONB; pk_val TEXT; pk_col TEXT;
BEGIN
    pk_col := COALESCE(TG_ARGV[0], 'id');
    pk_val := (to_jsonb(NEW) ->> pk_col);
    IF pk_val IS NULL THEN RETURN NEW; END IF;
    IF NEW.temp_child_data IS NULL OR NEW.temp_child_data = '{}'::jsonb THEN RETURN NEW; END IF;
    FOR child_table, child_config IN SELECT * FROM jsonb_each(NEW.temp_child_data) LOOP
        fk_col := child_config ->> 'fk_column';
        records := child_config -> 'records';
        EXECUTE format('DELETE FROM %I WHERE %I = $1', child_table, fk_col) USING pk_val;
        IF records IS NOT NULL AND jsonb_array_length(records) > 0 THEN
            FOR record_item IN SELECT * FROM jsonb_array_elements(records) LOOP
                record_item := record_item || jsonb_build_object(fk_col, pk_val);
                EXECUTE format('INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, $1)', child_table, child_table) USING record_item;
            END LOOP;
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION attach_child_sync_trigger(p_table_name TEXT, p_pk_col TEXT DEFAULT 'id')
RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS temp_child_data JSONB DEFAULT ''{}''::jsonb', p_table_name);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_sync_children_%I ON %I', p_table_name, p_table_name);
    EXECUTE format(
        'CREATE TRIGGER trg_sync_children_%I 
         AFTER INSERT OR UPDATE ON %I 
         FOR EACH ROW EXECUTE FUNCTION process_child_data_on_save(%L)',
        p_table_name, p_table_name, p_pk_col
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. רענון סכמה
NOTIFY pgrst, 'reload schema';`;

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-6 text-center">
        <div className="w-24 h-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center shadow-inner">
          <AlertTriangle size={56} />
        </div>
        <div className="space-y-2">
          <h3 className="text-3xl font-black text-slate-800">גישה נדחתה</h3>
          <p className="text-slate-500 font-bold max-w-md mx-auto">
            אין לך הרשאות מתאימות לצפייה בניהול מסד הנתונים.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-80px)] md:h-[calc(100vh-120px)] gap-4 md:gap-6" dir="rtl">
      {/* Sidebar - Dynamic Table List */}
      <div className="w-full md:w-72 bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden transition-all duration-300 h-1/3 md:h-full shrink-0">
        <div className="p-4 md:p-5 bg-slate-800 text-white font-black flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database size={20} className="text-blue-400" /> 
            <span>טבלאות מערכת</span>
          </div>
          <button 
            onClick={() => fetchTables(true)}
            disabled={sidebarLoading}
            title="רענן רשימה וסכמה"
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={sidebarLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
          {sidebarLoading && tables.length === 0 ? (
             <div className="space-y-2 p-2">
               {[1,2,3,4,5].map(n => <div key={n} className="h-10 bg-slate-50 rounded-lg animate-pulse" />)}
             </div>
          ) : tables.length > 0 ? (
            tables.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTable(t)}
                className={`w-full text-right p-3.5 rounded-xl transition-all flex items-center justify-between group ${
                  selectedTable?.id === t.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 font-black' 
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <TableIcon size={16} className={selectedTable?.id === t.id ? 'text-blue-200' : 'text-slate-400 group-hover:text-blue-500'} />
                  <span className="truncate max-w-[160px] text-sm">{t.label}</span>
                </div>
                {selectedTable?.id === t.id && <ChevronLeft size={16} className="animate-in slide-in-from-right-1" />}
              </button>
            ))
          ) : (
            <div className="p-10 text-center text-slate-400">
               <Info size={32} className="mx-auto mb-2 opacity-20" />
               <p className="text-xs font-bold leading-relaxed">לא נמצאו טבלאות. וודא שהרצת את פונקציות ה-RPC.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden relative">
        {selectedTable ? (
          <>
            <div className="p-4 md:p-5 border-b flex flex-col md:flex-row justify-between items-start md:items-center bg-white sticky top-0 z-10 gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-blue-50 rounded-xl md:rounded-2xl">
                    <TableIcon className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <h2 className="text-base md:text-xl font-black text-slate-800">{selectedTable.label}</h2>
                    <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">מקור נתונים: Public Schema</p>
                  </div>
                </div>
                <div className="relative w-full sm:w-auto mt-2 sm:mt-0">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="חיפוש חופשי בשורות..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-xs sm:w-64 focus:ring-2 focus:ring-blue-500 transition-all font-bold min-h-[44px]"
                  />
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto justify-end mt-2 md:mt-0">
                <div className="bg-orange-50 text-orange-700 px-2 md:px-3 py-1.5 rounded-lg md:rounded-xl border border-orange-100 text-[9px] md:text-[10px] font-black flex items-center gap-1.5">
                  <AlertTriangle size={12} className="md:w-3.5 md:h-3.5" /> גישת ARCHITECT
                </div>
                <button 
                  onClick={fetchData}
                  disabled={loading}
                  className="p-2 md:p-2.5 bg-slate-900 text-white rounded-lg md:rounded-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 min-h-[36px] md:min-h-[44px] min-w-[36px] md:min-w-[44px] flex items-center justify-center"
                  title="רענן נתונים"
                >
                  <RefreshCw size={16} className={`md:w-5 md:h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-50/30">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
                  <p className="text-slate-500 font-black text-sm">טוען רשומות מהשרת...</p>
                </div>
              ) : data.length > 0 ? (
                <div className="relative">
                  <table className="w-full text-right text-[11px] border-collapse">
                    <thead className="bg-slate-800 text-white sticky top-0 z-10">
                      <tr>
                        {canDelete && <th className="p-4 text-center w-14 border-l border-white/5">פעולות</th>}
                        {headers.map(h => (
                          <th key={h} className="p-4 font-black whitespace-nowrap border-l border-white/5 uppercase tracking-tighter">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredData.map((item, idx) => (
                        <tr key={item.ROWID || item.id || idx} className="hover:bg-blue-50/50 transition-colors group">
                          {canDelete && (
                            <td className="p-4 text-center border-l border-slate-50">
                              <button 
                                onClick={() => setConfirmConfig({ id: item.ROWID || item.id })}
                                disabled={deletingId === (item.ROWID || item.id)}
                                className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              >
                                {deletingId === (item.ROWID || item.id) ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </td>
                          )}
                          {headers.map(h => {
                            const val = item[h];
                            const isJson = typeof val === 'object' && val !== null;
                            return (
                              <td key={h} className="p-4 text-slate-600 max-w-xs truncate font-bold border-l border-slate-50">
                                {isJson ? (
                                  <div className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-lg text-[9px] text-slate-500 w-fit">
                                    <FileJson size={12} /> JSON DATA
                                  </div>
                                ) : val === null ? (
                                  <span className="text-slate-300 italic">null</span>
                                ) : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4">
                  <div className="p-8 bg-white rounded-full shadow-inner border border-slate-50">
                    <TableIcon size={64} className="opacity-10" />
                  </div>
                  <p className="font-black text-lg">הטבלה קיימת אך ריקה מנתונים</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-20 text-center space-y-6 md:space-y-10 animate-in fade-in duration-500">
             <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-50 rounded-[2rem] md:rounded-[3rem] flex items-center justify-center shadow-inner relative group">
                <div className="absolute inset-0 bg-blue-50 rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-all blur-2xl" />
                <Database size={40} className="md:w-14 md:h-14 text-slate-200 group-hover:text-blue-300 transition-colors relative" />
             </div>
             <div className="space-y-3 md:space-y-4 max-w-sm md:max-w-md">
                <h3 className="text-2xl md:text-3xl font-black text-slate-800">ניהול סכמה דינמי</h3>
                <p className="text-sm md:text-base text-slate-500 font-bold leading-relaxed">
                  בחר טבלה מהתפריט הצדדי כדי לצפות בנתונים גולמיים, לנהל רשומות או לבצע פעולות תחזוקה. 
                  במידה וביצעת ייבוא חדש, השתמש בכפתור ה-Refresh בראש הרשימה.
                </p>
                {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-bold text-sm animate-bounce">{error}</div>}
             </div>
             
             {/* SQL Setup Helper in empty state */}
             <div className="w-full max-w-2xl bg-slate-900 rounded-2xl md:rounded-3xl p-5 md:p-8 text-right border border-white/5 shadow-2xl">
                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                   <div className="p-1.5 md:p-2 bg-blue-600 rounded-lg md:rounded-xl"><Zap size={16} className="md:w-5 md:h-5 text-white" /></div>
                   <h4 className="font-black text-white text-sm md:text-base">תחזוקת תשתית (Architect Helper)</h4>
                </div>
                <p className="text-slate-400 text-xs font-bold mb-4">
                   אם רשימת הטבלאות אינה מופיעה, ייתכן שחסרות פונקציות ה-RPC הבאות ב-SQL Editor:
                </p>
                <div className="relative group">
                  <pre className="p-4 bg-black/40 text-emerald-400 rounded-xl font-mono text-[9px] overflow-x-auto text-left leading-relaxed max-h-40 scrollbar-thin border border-white/10" dir="ltr">
                    {SQL_HELPER}
                  </pre>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(SQL_HELPER);
                      alert("הקוד הועתק!");
                    }}
                    className="absolute top-2 right-2 p-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all shadow-xl"
                  >
                    <Copy size={12} />
                  </button>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmConfig && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[200] p-4 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 animate-in zoom-in duration-300 text-right border border-white/20">
            <div className="flex items-center gap-4 text-red-600 mb-6">
              <div className="p-3 bg-red-50 rounded-2xl shadow-sm"><AlertCircle size={32} /></div>
              <div>
                <h3 className="text-2xl font-black text-slate-800">מחיקת רשומה</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">פעולה קריטית (Destructive)</p>
              </div>
            </div>
            <p className="text-slate-600 mb-10 leading-relaxed font-bold">
              האם אתה בטוח שברצונך למחוק רשומה זו מטבלת <span className="text-blue-600 font-black">"{selectedTable?.label}"</span>? 
              פעולה זו תמחק את המידע לצמיתות משרתי Supabase.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmConfig(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all active:scale-95">ביטול</button>
              <button onClick={confirmDelete} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-red-100 hover:bg-red-700 transition-all active:scale-95">מחק לצמיתות</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DbManager;
