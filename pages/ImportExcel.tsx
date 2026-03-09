import React from 'react';
import * as XLSX from 'xlsx';
import { dbService } from '../services/dbService';
import { authService } from '../services/authService';
import { 
  Upload, 
  FileSpreadsheet, 
  Table as TableIcon, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Database,
  ArrowRight,
  ChevronLeft,
  Settings,
  Info,
  ChevronRight,
  Eye,
  Settings2,
  Trash2,
  Plus,
  ArrowDownCircle,
  Hash,
  Type,
  ToggleLeft,
  History,
  ShieldCheck,
  Zap,
  Terminal,
  Copy,
  AlertTriangle,
  RefreshCw,
  FileCheck
} from 'lucide-react';

interface ColumnMapping {
  source: string;
  target: string;
  type: 'TEXT' | 'NUMERIC' | 'BOOLEAN';
}

const ImportExcel: React.FC = () => {
  const [step, setStep] = React.useState<1 | 2 | 3 | 4 | 5>(1);
  const [file, setFile] = React.useState<File | null>(null);
  const [workbook, setWorkbook] = React.useState<XLSX.WorkBook | null>(null);
  const [selectedSheet, setSelectedSheet] = React.useState<string>("");
  const [importedSheets, setImportedSheets] = React.useState<string[]>([]);
  const [previewData, setPreviewData] = React.useState<any[]>([]);
  const [mappings, setMappings] = React.useState<ColumnMapping[]>([]);
  const [tableName, setTableName] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [conflictType, setConflictType] = React.useState<'OVERWRITE' | 'APPEND' | null>(null);
  const [importSummary, setImportSummary] = React.useState<{ rows: number; table: string } | null>(null);
  const [importErrors, setImportErrors] = React.useState<any[]>([]);
  const [statusMessage, setStatusMessage] = React.useState<string>("");
  
  const [connTest, setConnTest] = React.useState<{ testing: boolean; result: { success: boolean; message: string; code?: string } | null }>({
    testing: false,
    result: null
  });

  const currentUser = authService.getCurrentUser();

  const handleTestConnection = async () => {
    setConnTest({ testing: true, result: null });
    const result = await dbService.testConnection();
    setConnTest({ testing: false, result });
  };

  const sanitizeName = (name: string) => {
    // Sanitizes name for SQL/URL safety: removes quotes/brackets and replaces spaces with underscores
    return name.trim().replace(/\s+/g, '_').replace(/['"\[\]]/g, '');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          setWorkbook(wb);
          const initialSheet = wb.SheetNames[0];
          setSelectedSheet(initialSheet);
          setTableName(sanitizeName(initialSheet));
          setImportedSheets([]); // Reset tracking for new file
          setStep(2);
        } catch (err) {
          setError('שגיאה בקריאת הקובץ. וודא שפורמט הקובץ תקין.');
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleFullReset = () => {
    setFile(null);
    setWorkbook(null);
    setSelectedSheet("");
    setImportedSheets([]);
    setTableName("");
    setMappings([]);
    setStep(1);
  };

  const handleImportAdditionalSheet = () => {
    // Return to Step 2, clear target table for fresh entry
    setTableName(""); 
    setMappings([]);
    setStep(2);
  };

  React.useEffect(() => {
    if (workbook && selectedSheet) {
      const sheet = workbook.Sheets[selectedSheet];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      setPreviewData(json.slice(0, 5));
      
      const headerRow = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[];
      if (headerRow && headerRow.length > 0) {
        const initialMappings = headerRow.filter(Boolean).map(key => ({
          source: key,
          target: sanitizeName(key),
          type: 'TEXT' as const
        }));
        setMappings(initialMappings);
      }
    }
  }, [workbook, selectedSheet]);

  const validateMapping = () => {
    if (!tableName.trim()) {
      setError("יש להזין שם טבלה תקין");
      return false;
    }
    const targets = mappings.map(m => m.target.toLowerCase());
    if (new Set(targets).size !== targets.length) {
      setError("קיימות עמודות יעד עם שמות זהים. כל עמודה חייבת להיות ייחודית.");
      return false;
    }
    return true;
  };

  const handleGoToConflictResolution = async () => {
    if (!validateMapping()) return;
    setError(null);
    setLoading(true);
    try {
      const exists = await dbService.tableExists(tableName);
      
      if (exists) {
        setStep(3);
      } else {
        setConflictType('OVERWRITE'); 
        setStep(4);
        executeImport('OVERWRITE');
      }
    } catch (e: any) {
      setError(`שגיאה בתקשורת עם בסיס הנתונים: ${e.message || 'וודא מפתח Service Role תקין'}`);
    } finally {
      setLoading(false);
    }
  };

  const executeImport = async (type: 'OVERWRITE' | 'APPEND') => {
    setLoading(true);
    setProgress(0);
    setError(null);
    setStatusMessage("מכין את בסיס הנתונים...");

    try {
      const sheet = workbook!.Sheets[selectedSheet];
      // Use header: 1 to get raw rows as arrays, ensuring we control the header mapping
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
      
      if (rows.length < 2) {
        throw new Error("הגיליון חייב להכיל כותרות ולפחות שורת נתונים אחת");
      }

      // Phase 1: Header-First Synchronization
      setStatusMessage("מסנכרן מבנה טבלה...");
      const rawHeaders = rows[0].map(h => String(h || "").trim()).filter(h => h !== "");
      
      // Ensure sanitized headers are unique to avoid duplicate keys in objects
      const seenHeaders = new Set<string>();
      const sanitizedHeaders = rawHeaders.map(h => {
        let base = h.toLowerCase().replace(/[^a-z0-9א-ת_]/g, '_');
        let sanitized = base;
        let counter = 1;
        while (seenHeaders.has(sanitized)) {
          sanitized = `${base}_${counter}`;
          counter++;
        }
        seenHeaders.add(sanitized);
        return sanitized;
      });
      
      // Call RPC to ensure schema matches
      await dbService.syncTableColumns(tableName, rawHeaders);
      
      // Phase 2: Batch Processing & Mapping
      const dataRows = rows.slice(1);
      const mappedRows = dataRows.map((row, idx) => {
        const newRow: any = {
          __excel_row__: idx + 2 // +1 for 0-based index, +1 for header row
        };
        rawHeaders.forEach((header, index) => {
          const targetKey = sanitizedHeaders[index];
          const rawValue = row[index];
          
          // Convert everything to TEXT (String)
          if (rawValue === "" || rawValue === null || rawValue === undefined) {
            newRow[targetKey] = null;
          } else {
            // Force everything to string as requested
            newRow[targetKey] = String(rawValue).trim();
          }
        });
        return newRow;
      }).filter(row => {
        const { __excel_row__, ...rest } = row;
        return Object.values(rest).some(v => v !== null);
      }); // Filter out completely empty rows

      setStatusMessage("מזרים נתונים בקבוצות (Batch)...");
      // bulkInsertIntoTable now handles batching of 100 and deduplication
      const result = await dbService.bulkInsertIntoTable(tableName, mappedRows, false, (p) => setProgress(p));
      setProgress(100);

      if (result.errors && result.errors.length > 0) {
        setImportErrors(result.errors);
      }

      if (currentUser) {
        await dbService.logImport(tableName, result.successCount, currentUser.id, result.errors.length > 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS');
        await dbService.logActivity(
          currentUser.name,
          'IMPORT_DATA',
          `יובאו ${result.successCount} שורות לטבלה ${tableName}${result.errors.length > 0 ? ` (${result.errors.length} שגיאות)` : ''}`
        );
      }

      // Track successful import for the session
      if (!importedSheets.includes(selectedSheet)) {
        setImportedSheets(prev => [...prev, selectedSheet]);
      }

      setImportSummary({ rows: result.successCount, table: tableName });
      setStep(5);
    } catch (err: any) {
      setError(`שגיאה בביצוע הייבוא: ${err.message || 'וודא שהסכמה תקינה ושהרצת את ה-SQL המקדם'}`);
      setStep(2);
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  };

  const SQL_INSTRUCTION = `-- הרץ קוד זה ב-Supabase SQL Editor כדי לתקן את בעיות המטמון וההרשאות:

-- 1. פונקציית בדיקת קיום טבלה
DROP FUNCTION IF EXISTS check_table_exists(TEXT);
CREATE OR REPLACE FUNCTION check_table_exists(p_table_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = p_table_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. פונקציית יצירת טבלה התומכת במערך עמודות (Fix Error 22023)
DROP FUNCTION IF EXISTS create_dynamic_table(TEXT, JSONB, BOOLEAN);
CREATE OR REPLACE FUNCTION create_dynamic_table(p_table_name TEXT, p_columns JSONB, p_overwrite BOOLEAN DEFAULT FALSE)
RETURNS void AS $$
DECLARE
    col_record RECORD;
    sql_query TEXT;
BEGIN
    IF p_overwrite THEN
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(p_table_name);
    END IF;

    sql_query := 'CREATE TABLE IF NOT EXISTS ' || quote_ident(p_table_name) || ' (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMPTZ DEFAULT NOW()';
    
    -- שימוש ב-jsonb_to_recordset לטיפול במערך אובייקטים
    FOR col_record IN SELECT * FROM jsonb_to_recordset(p_columns) AS x(name text, type text) LOOP
        sql_query := sql_query || ', ' || quote_ident(col_record.name) || ' ' || 
                    CASE 
                        WHEN col_record.type = 'NUMERIC' THEN 'NUMERIC' 
                        WHEN col_record.type = 'BOOLEAN' THEN 'BOOLEAN' 
                        ELSE 'TEXT' 
                    END;
    END LOOP;
    
    sql_query := sql_query || ')';
    EXECUTE sql_query;
    
    NOTIFY pgrst, 'reload schema';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. הוספת עמודה לטבלה קיימת
DROP FUNCTION IF EXISTS add_column_to_table(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION add_column_to_table(p_table_name TEXT, p_column_name TEXT, p_column_type TEXT)
RETURNS void AS $$
BEGIN
    EXECUTE 'ALTER TABLE ' || quote_ident(p_table_name) || ' ADD COLUMN IF NOT EXISTS ' || quote_ident(p_column_name) || ' ' || 
            CASE 
                WHEN p_column_type = 'NUMERIC' THEN 'NUMERIC' 
                WHEN p_column_type = 'BOOLEAN' THEN 'BOOLEAN' 
                ELSE 'TEXT' 
            END;
    NOTIFY pgrst, 'reload schema';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. פונקציות תשתית נוספות
DROP FUNCTION IF EXISTS get_table_columns(TEXT);
CREATE OR REPLACE FUNCTION get_table_columns(p_table_name TEXT)
RETURNS TABLE(column_name TEXT, data_type TEXT, ordinal_position INT, is_updatable TEXT) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        c.column_name::TEXT, 
        c.data_type::TEXT, 
        c.ordinal_position::INT,
        c.is_updatable::TEXT
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' 
    AND c.table_name = p_table_name
    AND c.is_updatable = 'YES'
    ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS get_public_tables();
CREATE OR REPLACE FUNCTION get_public_tables()
RETURNS TABLE(table_name text) AS $$
BEGIN
    RETURN QUERY SELECT t.table_name::text FROM information_schema.tables t WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS reload_schema_cache();
CREATE OR REPLACE FUNCTION reload_schema_cache()
RETURNS void AS $$
BEGIN
    NOTIFY pgrst, 'reload schema';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';`;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      {/* Top Admin Status Bar */}
      <div className={`p-4 md:p-6 rounded-2xl md:rounded-[2rem] border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-500 ${
        connTest.result?.success ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'
      }`}>
        <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
          <div className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${connTest.result?.success ? 'bg-emerald-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
            <Zap size={20} className="md:w-6 md:h-6" />
          </div>
          <div className="flex-1">
            <h4 className="font-black text-slate-800 text-sm md:text-base">מצב תשתית Supabase</h4>
            <p className="text-[10px] md:text-xs font-bold text-slate-500">{connTest.result?.message || 'יש לוודא תקינות פונקציות ה-RPC לפני הייבוא'}</p>
          </div>
        </div>
        <button onClick={handleTestConnection} className="w-full md:w-auto px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs min-h-[44px]">בדיקת תשתית</button>
      </div>

      <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden min-h-[400px] md:min-h-[500px] flex flex-col">
        {step === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-20 space-y-6 md:space-y-10 text-center animate-in zoom-in duration-300">
            <div className="w-24 h-24 md:w-32 md:h-32 bg-blue-50 text-blue-600 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center shadow-inner">
               <Upload size={40} className="md:w-14 md:h-14" />
            </div>
            <div className="space-y-3 md:space-y-4">
              <h3 className="text-2xl md:text-3xl font-black text-slate-800">ייבוא נתונים מ-Excel</h3>
              <p className="text-sm md:text-base text-slate-500 font-bold max-w-sm mx-auto">קבצי Excel או CSV ייסרקו וימופו לטבלאות ב-Supabase.</p>
            </div>
            <label className="inline-flex items-center justify-center gap-3 md:gap-4 px-8 md:px-16 py-4 md:py-6 bg-blue-600 text-white rounded-2xl md:rounded-3xl font-black text-lg md:text-xl cursor-pointer hover:bg-blue-700 shadow-2xl transition-all active:scale-95 w-full sm:w-auto">
              <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
              <FileSpreadsheet size={24} className="md:w-7 md:h-7" />
              בחר קובץ לניתוח
            </label>
          </div>
        )}

        {step === 2 && workbook && (
          <div className="flex-1 flex flex-col animate-in fade-in duration-500">
            <div className="p-4 md:p-8 border-b bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                 <div className="space-y-1 w-full sm:w-auto">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">גיליון</label>
                    <select 
                      value={selectedSheet} 
                      onChange={(e) => {
                        const newSheet = e.target.value;
                        setSelectedSheet(newSheet);
                        setTableName(sanitizeName(newSheet));
                      }} 
                      className="block w-full p-2 bg-white border border-slate-200 rounded-xl font-black text-sm min-h-[44px]"
                    >
                        {workbook.SheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1 w-full sm:w-auto">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">שם טבלה</label>
                    <input type="text" value={tableName} onChange={(e) => setTableName(e.target.value)} className="block w-full p-2 bg-white border border-slate-200 rounded-xl font-black text-sm min-h-[44px]" />
                 </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                 <button onClick={handleFullReset} className="w-full sm:w-auto px-6 py-3 text-slate-500 font-black text-sm min-h-[44px] border border-slate-200 rounded-xl sm:border-none sm:rounded-none bg-white sm:bg-transparent">ביטול</button>
                 <button onClick={handleGoToConflictResolution} className="w-full sm:w-auto px-10 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-blue-700 flex items-center justify-center gap-2 min-h-[44px]">
                   {loading ? <Loader2 className="animate-spin" size={18} /> : <ChevronLeft size={18} />}
                   ווידוא והזרקה
                 </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
               <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-l overflow-y-auto p-4 md:p-8 space-y-6 bg-white h-64 md:h-auto shrink-0">
                  <h4 className="font-black text-slate-800 flex items-center gap-2"><Settings2 size={18} /> מיפוי עמודות</h4>
                  {mappings.map((m, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                       <span className="text-[10px] font-black text-slate-400 uppercase">מקור: {m.source}</span>
                       <input type="text" value={m.target} onChange={(e) => {
                          const next = [...mappings];
                          next[idx].target = e.target.value;
                          setMappings(next);
                       }} className="w-full p-2.5 bg-white border rounded-xl font-black text-xs min-h-[44px]" />
                       <div className="flex gap-1">
                          {['TEXT', 'NUMERIC', 'BOOLEAN'].map(t => (
                            <button key={t} onClick={() => {
                              const next = [...mappings];
                              (next[idx].type as any) = t;
                              setMappings(next);
                            }} className={`flex-1 py-2 md:py-1 rounded text-[9px] font-black min-h-[44px] md:min-h-0 ${m.type === t ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border'}`}>{t}</button>
                          ))}
                       </div>
                    </div>
                  ))}
               </div>
               <div className="flex-1 bg-slate-50 p-4 md:p-8 overflow-auto">
                  <h4 className="font-black text-slate-800 mb-6">דגימת נתונים</h4>
                  <div className="bg-white rounded-3xl border overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-right text-[11px]">
                      <thead className="bg-slate-800 text-white">
                        <tr>{mappings.map(m => <th key={m.source} className="p-3 font-black whitespace-nowrap border-l border-white/10">{m.source}</th>)}</tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, i) => (
                          <tr key={i} className="border-b">
                            {mappings.map(m => <td key={m.source} className="p-3 font-bold text-slate-600 truncate max-w-[150px]">{String(row[m.source] || '')}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-20 space-y-8 md:space-y-12 animate-in slide-in-from-top-4 duration-500 text-center">
             <AlertCircle size={48} className="md:w-16 md:h-16 text-orange-500" />
             <div className="space-y-2">
                <h3 className="text-2xl md:text-3xl font-black text-slate-800">הטבלה כבר קיימת</h3>
                <p className="text-sm md:text-base text-slate-500 font-bold">האם ברצונך לדרוס את המבנה הקיים או רק להוסיף נתונים?</p>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 w-full max-w-lg">
                <button onClick={() => { setConflictType('OVERWRITE'); executeImport('OVERWRITE'); setStep(4); }} className="p-4 md:p-6 bg-red-50 text-red-700 border rounded-2xl md:rounded-3xl font-black text-base md:text-lg hover:bg-red-100 min-h-[60px]">דרוס (Overwrite)</button>
                <button onClick={() => { setConflictType('APPEND'); executeImport('APPEND'); setStep(4); }} className="p-4 md:p-6 bg-emerald-50 text-emerald-700 border rounded-2xl md:rounded-3xl font-black text-base md:text-lg hover:bg-emerald-100 min-h-[60px]">הוסף (Append)</button>
             </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-20 space-y-6 md:space-y-8">
             <div className="w-16 h-16 md:w-24 md:h-24 rounded-full border-4 md:border-8 border-slate-100 border-t-blue-600 animate-spin" />
             <div className="text-center space-y-2 md:space-y-4">
                <h3 className="text-xl md:text-2xl font-black text-slate-800">{progress}% הושלמו</h3>
                <p className="text-sm md:text-base text-slate-600 font-bold">{statusMessage}</p>
             </div>
          </div>
        )}

        {step === 5 && importSummary && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-20 space-y-6 md:space-y-10 text-center animate-in zoom-in duration-500">
             <CheckCircle2 size={56} className="md:w-18 md:h-18 text-emerald-500" />
             <div className="space-y-2">
                <h3 className="text-3xl md:text-4xl font-black text-slate-800">הייבוא הושלם!</h3>
                <p className="text-lg md:text-xl font-bold text-slate-500">{importSummary.rows} שורות יובאו לטבלה {importSummary.table}</p>
             </div>
             <button onClick={() => setStep(1)} className="w-full sm:w-auto px-8 py-3 md:py-4 bg-slate-900 text-white rounded-xl md:rounded-2xl font-black shadow-xl min-h-[44px]">חזרה להתחלה</button>
          </div>
        )}
      </div>

      {importErrors.length > 0 && (
        <div className="bg-amber-50 rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 border border-amber-100 shadow-xl space-y-4">
          <div className="flex items-center gap-3 text-amber-700">
            <AlertTriangle size={24} />
            <h3 className="text-lg md:text-xl font-black">דוח שגיאות ייבוא ({importErrors.length})</h3>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2 scrollbar-thin">
            {importErrors.map((err, idx) => (
              <div key={idx} className="p-3 bg-white border border-amber-200 rounded-xl text-xs font-bold text-amber-800 flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="flex items-center gap-2">
                    שגיאה {idx + 1}:
                    {err.excelRow && (
                      <span className="px-2 py-0.5 bg-amber-100 rounded text-[10px]">שורה {err.excelRow} באקסל</span>
                    )}
                  </span>
                  <span className="text-[10px] opacity-70">{err.global ? 'שגיאה כללית' : (err.row ? 'שגיאה בשורה' : 'שגיאה בקבוצה')}</span>
                </div>
                <p className="font-mono text-[10px]">{err.error}</p>
                {err.row && (
                  <div className="mt-1 p-2 bg-slate-50 rounded border text-[9px] text-slate-500 overflow-x-auto">
                    {(() => {
                      const { __excel_row__, ...cleanRow } = err.row;
                      return JSON.stringify(cleanRow);
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button 
            onClick={() => setImportErrors([])} 
            className="text-xs font-black text-amber-600 hover:text-amber-700 underline"
          >
            נקה דוח שגיאות
          </button>
        </div>
      )}

      <div className="bg-slate-900 rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 space-y-4 md:space-y-6">
           <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 bg-blue-600 rounded-xl md:rounded-2xl shadow-lg"><Terminal size={20} className="md:w-6 md:h-6" /></div>
              <h3 className="text-lg md:text-2xl font-black">עדכון פונקציות SQL (תיקון שגיאה 22023)</h3>
           </div>
           <div className="relative group">
              <pre className="p-4 md:p-6 bg-black/40 text-emerald-400 rounded-xl md:rounded-2xl font-mono text-[9px] md:text-[10px] overflow-x-auto text-left leading-relaxed max-h-48 md:max-h-60 scrollbar-thin border border-white/10" dir="ltr">
                 {SQL_INSTRUCTION}
              </pre>
              <button onClick={() => { navigator.clipboard.writeText(SQL_INSTRUCTION); alert("קוד הועתק!"); }} className="absolute top-2 right-2 md:top-4 md:right-4 p-2 md:p-3 bg-blue-600 hover:bg-blue-700 rounded-lg md:rounded-xl text-white opacity-0 group-hover:opacity-100 transition-all shadow-xl min-h-[44px] min-w-[44px] flex items-center justify-center">
                <Copy size={16} />
              </button>
           </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-red-100 flex flex-col sm:flex-row items-start gap-4 md:gap-6">
          <AlertCircle size={24} className="md:w-8 md:h-8 text-red-600 flex-shrink-0" />
          <div className="flex-1">
             <h4 className="font-black text-red-800 text-base md:text-lg">שגיאה בתהליך</h4>
             <p className="text-sm md:text-base text-red-600 font-bold mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportExcel;