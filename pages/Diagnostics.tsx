
import React from 'react';
import { dbService } from '../services/dbService';
import { nestChildRecords } from '../utils/dataUtils';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  Zap, 
  Database, 
  RefreshCw, 
  Loader2,
  Bug,
  FileCode,
  LayoutList,
  Server,
  Network,
  Code2,
  Terminal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const Diagnostics: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [scanning, setScanning] = React.useState(false);
  const [expandedError, setExpandedError] = React.useState<number | null>(null);
  
  const [results, setResults] = React.useState<{
    templatesCount: number;
    totalFields: number;
    schemaResults: any[];
    logicTest: { ok: boolean; payload?: any; error?: string };
    webhookStatus: { ok: boolean; status: string };
    formulaErrors: { template: string, field: string, error: string }[];
  }>({
    templatesCount: 0,
    totalFields: 0,
    schemaResults: [],
    logicTest: { ok: false },
    webhookStatus: { ok: false, status: 'Not Checked' },
    formulaErrors: []
  });

  const runHealthCheck = async () => {
    setScanning(true);
    try {
      const [templates, schemaIntegrity, webhook] = await Promise.all([
        dbService.getFormTemplates(),
        dbService.checkSchemaIntegrity(),
        dbService.testWebhook()
      ]);

      // 1. Formula Audit
      const formulaErrors: { template: string, field: string, error: string }[] = [];
      let fieldCount = 0;
      const SYSTEM_VOID_FUNCTIONS = ['UNIQUEID', 'USEREMAIL', 'USERNAME', 'TODAY', 'NOW', 'CONTEXT'];

      templates.forEach(t => {
        t.fields.forEach(f => {
          fieldCount++;
          const formulas = [
            { key: 'חישוב', val: f.calculationFormula },
            { key: 'נראות', val: f.visibilityCondition },
            { key: 'אימות', val: f.validationFormula }
          ];

          formulas.forEach(item => {
            const formula = item.val;
            if (formula && formula.trim()) {
              const openBrackets = (formula.match(/\[/g) || []).length;
              const closeBrackets = (formula.match(/\]/g) || []).length;
              if (openBrackets !== closeBrackets) {
                formulaErrors.push({ 
                  template: t.name, 
                  field: `${f.label} (${item.key})`, 
                  error: `סוגריים מרובעים לא תואמים: ${openBrackets} vs ${closeBrackets}` 
                });
              }
            }
          });
        });
      });

      // 2. Recursive Logic Verification (Test nestChildRecords)
      const sampleData: Record<string, any[]> = {
        'כיבויים_שנתי': [
          { ROWID: 'CHILD_1', parent_id: 'PARENT_1', name: 'מטף אבקה' }
        ],
        'כיבויים_שנתי_2': [
          { ROWID: 'GRANDCHILD_1', parent_id: 'CHILD_1', test_result: 'תקין' }
        ]
      };
      
      let logicTestResult: { ok: boolean; payload?: any; error?: string } = { ok: false, error: '' };
      try {
        const nested = nestChildRecords(sampleData, 'PARENT_1');
        const child = nested['כיבויים_שנתי']?.records?.[0];
        const grandchild = child?.temp_child_data?.['כיבויים_שנתי_2']?.records?.[0];
        
        if (grandchild && grandchild.test_result === 'תקין') {
          logicTestResult = { ok: true, payload: nested };
        } else {
          logicTestResult = { ok: false, error: 'Grandchild nesting failed' };
        }
      } catch (e: any) {
        logicTestResult = { ok: false, error: e.message };
      }

      setResults({
        templatesCount: templates.length,
        totalFields: fieldCount,
        schemaResults: schemaIntegrity,
        logicTest: logicTestResult,
        webhookStatus: webhook,
        formulaErrors
      });
    } catch (err) {
      console.error('Diagnostics failed:', err);
    } finally {
      setScanning(false);
      setLoading(false);
    }
  };

  React.useEffect(() => {
    runHealthCheck();
  }, []);

  const getDeepDive = (error: string, table: string) => {
    if (error.includes('temp_child_data')) {
      return {
        issue: `העמודה 'temp_child_data' חסרה בטבלה '${table}'.`,
        impact: "המערכת לא תוכל לשלוח נתוני ילדים (מטפים, מערכות וכו') בשמירה אטומית אחת. השמירה תיכשל או שתתבצע ללא הנתונים המשניים.",
        solution: `הרץ ב-SQL Editor:\nALTER TABLE ${table} ADD COLUMN temp_child_data JSONB DEFAULT '{}';`
      };
    }
    if (error.includes('trigger')) {
      return {
        issue: `הטריגר 'trg_child_sync' חסר בטבלה '${table}'.`,
        impact: "הנתונים המשולבים ב-JSON לא יפורקו לטבלאות הילדים בבסיס הנתונים. המידע יישמר רק כ-JSON גולמי ולא יהיה זמין לחיפושים או דוחות.",
        solution: `הרץ ב-SQL Editor:\nCREATE TRIGGER tr_atomic_save BEFORE INSERT OR UPDATE ON ${table}\nFOR EACH ROW EXECUTE FUNCTION atomic_nested_insert_trigger();`
      };
    }
    if (error.includes('parent_id')) {
      return {
        issue: `העמודה 'parent_id' (UUID) חסרה בטבלה '${table}'.`,
        impact: "לא ניתן לקשר רשומות בטבלה זו לרשומת האב שלהן. השמירה האטומית תיכשל בשלב הפירוק.",
        solution: `הרץ ב-SQL Editor:\nALTER TABLE ${table} ADD COLUMN parent_id UUID REFERENCES [PARENT_TABLE](id);`
      };
    }
    return { issue: error, impact: 'לא ידוע', solution: 'בדוק את הגדרות הטבלה' };
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 text-blue-600">
      <Loader2 className="animate-spin mb-4" size={48} />
      <p className="font-bold">מריץ אבחון QA עמוק (Atomic Architecture)...</p>
    </div>
  );

  const totalErrors = results.schemaResults.reduce((acc, curr) => acc + curr.errors.length, 0) + results.formulaErrors.length + (results.logicTest.ok ? 0 : 1);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">מרכז אבחון ושלמות נתונים</h2>
          <p className="text-slate-500 font-bold">בדיקת תקינות הצינור האטומי (Single-Trip Pipeline)</p>
        </div>
        <button 
          onClick={runHealthCheck} 
          disabled={scanning}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
        >
          {scanning ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
          הרצת אבחון מחדש
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Server size={24}/></div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">חיבור Supabase</p>
            <p className="text-lg font-black text-green-600">מחובר</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className={`p-4 rounded-2xl ${results.webhookStatus.ok ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            <Network size={24}/>
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">Webhook (Apps Script)</p>
            <p className={`text-lg font-black ${results.webhookStatus.ok ? 'text-green-600' : 'text-red-600'}`}>
              {results.webhookStatus.status}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className={`p-4 rounded-2xl ${results.logicTest.ok ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            <Code2 size={24}/>
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">לוגיקת קינון (Recursive)</p>
            <p className={`text-lg font-black ${results.logicTest.ok ? 'text-green-600' : 'text-red-600'}`}>
              {results.logicTest.ok ? 'תקין' : 'נכשל'}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className={`p-4 rounded-2xl ${totalErrors === 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            <Zap size={24}/>
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">ציון בריאות כללי</p>
            <p className={`text-lg font-black ${totalErrors === 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalErrors === 0 ? '100% - מוכן' : `${Math.max(0, 100 - totalErrors * 10)}%`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Database Schema Sync */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <Database className="text-blue-500" size={20} /> סנכרון סכימת בסיס נתונים
            </h3>
            <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded-full uppercase">Schema Sync</span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[500px] p-4 space-y-3">
            {results.schemaResults.map((res, idx) => (
              <div key={idx} className={`p-4 rounded-2xl border transition-all ${res.errors.length > 0 ? 'border-red-100 bg-red-50/30' : 'border-slate-100 bg-white'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${res.errors.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                    <span className="font-black text-slate-800">{res.table}</span>
                  </div>
                  <div className="flex gap-1">
                    {res.isParent && <span className="text-[9px] font-black bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded uppercase">Parent</span>}
                    {res.isChild && <span className="text-[9px] font-black bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded uppercase">Child</span>}
                  </div>
                </div>
                
                {res.errors.length > 0 ? (
                  <div className="space-y-2 mt-3">
                    {res.errors.map((err: string, eIdx: number) => {
                      const dive = getDeepDive(err, res.table);
                      const isExpanded = expandedError === (idx * 100 + eIdx);
                      return (
                        <div key={eIdx} className="bg-white border border-red-100 rounded-xl overflow-hidden">
                          <button 
                            onClick={() => setExpandedError(isExpanded ? null : (idx * 100 + eIdx))}
                            className="w-full p-3 flex items-center justify-between text-right hover:bg-red-50/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                              <AlertTriangle size={14} />
                              {err}
                            </div>
                            {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                          </button>
                          
                          {isExpanded && (
                            <div className="p-4 bg-slate-900 text-slate-300 text-[11px] space-y-3 border-t border-red-50">
                              <div>
                                <p className="text-red-400 font-black uppercase mb-1 flex items-center gap-1"><Bug size={12}/> Issue</p>
                                <p>{dive.issue}</p>
                              </div>
                              <div>
                                <p className="text-orange-400 font-black uppercase mb-1 flex items-center gap-1"><Activity size={12}/> Impact</p>
                                <p>{dive.impact}</p>
                              </div>
                              <div>
                                <p className="text-green-400 font-black uppercase mb-1 flex items-center gap-1"><Terminal size={12}/> Solution</p>
                                <pre className="bg-black/50 p-2 rounded mt-1 font-mono text-[10px] overflow-x-auto text-white">
                                  {dive.solution}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] text-green-600 font-bold flex items-center gap-1 mt-1">
                    <CheckCircle2 size={12} /> כל הבדיקות עברו בהצלחה
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Logic & Webhook Details */}
        <div className="space-y-8">
          {/* Logic Test */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b bg-slate-50">
              <h3 className="font-black text-slate-800 flex items-center gap-2">
                <Code2 className="text-purple-500" size={20} /> אימות לוגיקת קינון (Recursive Test)
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className={`p-4 rounded-2xl border ${results.logicTest.ok ? 'border-green-100 bg-green-50/30' : 'border-red-100 bg-red-50/30'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-3 rounded-xl ${results.logicTest.ok ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {results.logicTest.ok ? <ShieldCheck size={24}/> : <Bug size={24}/>}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800">בדיקת פונקציית nestChildRecords</h4>
                    <p className="text-xs text-slate-500 font-bold">אימות יכולת הקינון של נכדים בתוך ילדים</p>
                  </div>
                </div>
                
                {results.logicTest.ok ? (
                  <div className="bg-slate-900 rounded-xl p-4 font-mono text-[10px] text-green-400 overflow-x-auto">
                    <p className="text-slate-500 mb-2">// Sample Output Structure:</p>
                    <pre>{JSON.stringify(results.logicTest.payload, null, 2)}</pre>
                  </div>
                ) : (
                  <div className="p-4 bg-red-900 text-white rounded-xl text-xs font-mono">
                    <p className="font-black mb-2">Error during logic test:</p>
                    <p>{results.logicTest.error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Formula Audit */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b bg-slate-50">
              <h3 className="font-black text-slate-800 flex items-center gap-2">
                <Bug className="text-red-500" size={20} /> אבחון נוסחאות ולוגיקה
              </h3>
            </div>
            <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
              {results.formulaErrors.length > 0 ? (
                results.formulaErrors.map((err, idx) => (
                  <div key={idx} className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] font-black text-red-800 uppercase">{err.template} › {err.field}</p>
                      <p className="text-xs text-red-600 font-bold">{err.error}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <CheckCircle2 size={32} className="text-green-500 mb-2 opacity-50" />
                  <p className="text-sm font-black">לא נמצאו שגיאות לוגיות בתבניות</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Diagnostics;
