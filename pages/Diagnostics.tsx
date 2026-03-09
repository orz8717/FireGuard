
import React from 'react';
import { dbService } from '../services/dbService';
import { FormTemplate, Customer } from '../types';
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
  LayoutList
} from 'lucide-react';

const Diagnostics: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [scanning, setScanning] = React.useState(false);
  const [results, setResults] = React.useState<{
    templatesCount: number;
    formulaErrors: { template: string, field: string, error: string }[];
    customersMissingIds: number;
    totalFields: number;
  }>({
    templatesCount: 0,
    formulaErrors: [],
    customersMissingIds: 0,
    totalFields: 0
  });

  const runHealthCheck = async () => {
    setScanning(true);
    try {
      const [templates, customers] = await Promise.all([
        dbService.getFormTemplates(),
        dbService.getCustomers()
      ]);

      const errors: { template: string, field: string, error: string }[] = [];
      let fieldCount = 0;

      // Standard functions that are valid even if empty
      const SYSTEM_VOID_FUNCTIONS = [
        'UNIQUEID', 'USEREMAIL', 'USERNAME', 'TODAY', 'NOW', 'CONTEXT'
      ];

      // Scan formulas for syntax errors
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
              // 1. Bracket mismatch check
              const openBrackets = (formula.match(/\[/g) || []).length;
              const closeBrackets = (formula.match(/\]/g) || []).length;
              if (openBrackets !== closeBrackets) {
                errors.push({ 
                  template: t.name, 
                  field: `${f.label} (${item.key})`, 
                  error: `סוגריים מרובעים לא תואמים: ${openBrackets} פותחים לעומת ${closeBrackets} סוגרים` 
                });
              }

              // 2. Suspicious empty function check
              // Matches patterns like WORD() while ignoring system void functions
              const emptyFuncMatch = formula.match(/(\w+)\(\s*\)/g);
              if (emptyFuncMatch) {
                emptyFuncMatch.forEach(match => {
                  const funcName = match.split('(')[0].toUpperCase();
                  if (!SYSTEM_VOID_FUNCTIONS.includes(funcName)) {
                    errors.push({
                      template: t.name,
                      field: `${f.label} (${item.key})`,
                      error: `פונקציה ריקה חשודה: ${match} (ייתכן וחסרים ארגומנטים)`
                    });
                  }
                });
              }
            }
          });
        });
      });

      // Check customers for ROW IDs
      const missingIds = customers.filter(c => {
        try {
          const notes = JSON.parse(c.notes || '{}');
          return !notes['ROW ID'];
        } catch { return true; }
      }).length;

      setResults({
        templatesCount: templates.length,
        formulaErrors: errors,
        customersMissingIds: missingIds,
        totalFields: fieldCount
      });
    } catch (err) {
    } finally {
      setScanning(false);
      setLoading(false);
    }
  };

  React.useEffect(() => {
    runHealthCheck();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 text-blue-600">
      <Loader2 className="animate-spin mb-4" size={48} />
      <p className="font-bold">מריץ אבחון QA ראשוני...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir="rtl">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><LayoutList size={24}/></div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase">תבניות טפסים</p>
            <p className="text-2xl font-black text-slate-800">{results.templatesCount}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl"><FileCode size={24}/></div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase">סה"כ שדות לוגיים</p>
            <p className="text-2xl font-black text-slate-800">{results.totalFields}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className={`p-4 rounded-2xl ${results.formulaErrors.length > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {results.formulaErrors.length > 0 ? <Bug size={24}/> : <ShieldCheck size={24}/>}
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase">שגיאות בנוסחאות</p>
            <p className={`text-2xl font-black ${results.formulaErrors.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {results.formulaErrors.length}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className={`p-4 rounded-2xl ${results.customersMissingIds > 0 ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
            <Database size={24}/>
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase">לקוחות ללא ROW ID</p>
            <p className="text-2xl font-black text-slate-800">{results.customersMissingIds}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formula Audit List */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <Bug className="text-red-500" size={20} /> אבחון נוסחאות ולוגיקה
            </h3>
            <button onClick={runHealthCheck} disabled={scanning} className="p-2 hover:bg-white rounded-xl transition-all text-blue-600">
              <RefreshCw size={18} className={scanning ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px] p-4 space-y-3">
            {results.formulaErrors.length > 0 ? (
              results.formulaErrors.map((err, idx) => (
                <div key={idx} className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4 shadow-sm">
                  <div className="bg-white p-2 rounded-lg text-red-600 shadow-sm flex-shrink-0"><AlertTriangle size={16}/></div>
                  <div>
                    <p className="text-[10px] font-black text-red-800 uppercase tracking-tighter">{err.template} › {err.field}</p>
                    <p className="text-sm text-red-600 mt-1 font-bold leading-tight">{err.error}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <CheckCircle2 size={48} className="text-green-500 mb-4 opacity-50" />
                <p className="font-black">לא נמצאו שגיאות לוגיות בתבניות</p>
              </div>
            )}
          </div>
        </div>

        {/* Data Integrity */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b bg-slate-50">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <Database className="text-blue-500" size={20} /> שלמות נתוני לקוחות
            </h3>
          </div>
          <div className="p-8 flex flex-col items-center justify-center flex-1 text-center">
            {results.customersMissingIds > 0 ? (
              <>
                <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-6 animate-pulse">
                  <AlertTriangle size={40} />
                </div>
                <h4 className="text-xl font-black text-slate-800 mb-2">נמצאו לקוחות ללא מזהה ייחודי</h4>
                <p className="text-slate-500 text-sm font-bold mb-6 max-w-xs">ישנם {results.customersMissingIds} לקוחות במערכת שלא הוגדר עבורם ROW ID. הדבר עלול לפגוע בקישוריות דוחות בעתיד.</p>
                <p className="text-xs text-slate-400 mb-6 italic">ניתן לתקן זאת ע"י שמירה מחדש של פרטי הלקוחות במסך לקוחות.</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 size={40} />
                </div>
                <h4 className="text-xl font-black text-slate-800 mb-2">כל הנתונים תקינים</h4>
                <p className="text-slate-500 text-sm font-bold">לכל הלקוחות קיים ROW ID תקין המאפשר אינטגרציה מלאה עם מנוע הנוסחאות.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Diagnostics;
