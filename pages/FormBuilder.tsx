import React from 'react';
import { useFormulaEngine } from '../hooks/useFormulaEngine';
import { GoogleGenAI } from '@google/genai';
import { FormTemplate, FormField, FieldType, Customer, User, UserRole } from '../types';
import { dbService } from '../services/dbService';
import { 
  Trello, Plus, Trash2, X, Loader2, Settings2, 
  Save, PlusCircle, Calculator, Eye, ShieldCheck, 
  Wand2, Code, Clock, Type as TextIcon,
  PlayCircle, Zap, ChevronRight, ChevronDown, ChevronUp,
  ChevronLeft,
  Info, CheckCircle, AlertCircle,
  LayoutList, Database, Activity,
  CheckCircle2,
  RefreshCw,
  Hash,
  GripVertical,
  List,
  Server,
  LayoutGrid,
  Search,
  ArrowRightLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  RotateCcw,
  AlertTriangle,
  BookOpen,
  Keyboard,
  Cpu,
  Variable,
  Table as TableIcon,
  Columns,
  Sparkles,
  ArrowLeft,
  Check,
  Copy
} from 'lucide-react';
import DynamicForm from '../components/DynamicForm';
import { authService } from '../services/authService';
import { usePermissions } from '../src/context/PermissionContext';

// --- SUPPLEMENTAL: FUNCTION PARAMETER DEFINITIONS ---
type ParamType = 'field' | 'table' | 'column' | 'text' | 'number' | 'boolean';

interface ParamDef {
  label: string;
  type: ParamType;
  desc: string;
  dependsOnTable?: number; // Index of the parameter that holds the table name
}

interface FuncMeta {
  desc: string;
  syntax: string;
  example: string;
  params?: ParamDef[];
  isVariadic?: boolean; // Can have unlimited arguments (like SUM, CONCATENATE)
}

const FieldRow = React.memo(({ 
  field, 
  idx, 
  canEdit,
  canDelete,
  moveField, 
  setEditingField, 
  setEditTab, 
  localFieldsLength,
  onDelete
}: {
  field: FormField;
  idx: number;
  canEdit: boolean;
  canDelete: boolean;
  moveField: (index: number, direction: 'up' | 'down') => void;
  setEditingField: (field: FormField) => void;
  setEditTab: (tab: string) => void;
  localFieldsLength: number;
  onDelete: (e: React.MouseEvent, field: FormField) => void;
}) => {
  return (
    <div 
      onClick={() => {setEditingField(field); setEditTab('general');}} 
      className={`p-4 md:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between group shadow-sm hover:shadow-xl transition-all cursor-pointer gap-4 ${field.isVirtual ? 'bg-orange-50/30 border-orange-100' : 'bg-white border-slate-100'}`}
    >
      <div className="flex items-center gap-3 md:gap-5 w-full sm:w-auto">
        <div className={`p-2 md:p-3 rounded-2xl transition-all shrink-0 flex items-center gap-1 ${field.isVirtual ? 'bg-orange-50 text-orange-400 group-hover:text-orange-600 group-hover:bg-orange-100' : 'bg-slate-50 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50'}`}>
          <GripVertical size={20} className="md:w-[22px] md:h-[22px]" />
          {canEdit && (
            <div className="flex flex-col gap-0.5 ml-1">
              <button 
                onClick={(e) => { e.stopPropagation(); moveField(idx, 'up'); }}
                disabled={idx === 0}
                className="p-0.5 hover:bg-white/50 rounded disabled:opacity-30 transition-colors"
                title="הזז למעלה"
              >
                <ChevronUp size={14} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); moveField(idx, 'down'); }}
                disabled={idx === localFieldsLength - 1}
                className="p-0.5 hover:bg-white/50 rounded disabled:opacity-30 transition-colors"
                title="הזז למטה"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-black text-slate-800 text-base md:text-lg flex items-center gap-2 truncate">
            {field.label} 
            {field.isVirtual && <Zap size={14} className="text-orange-500 shrink-0" />}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded border ${field.isVirtual ? 'bg-orange-100 text-orange-600 border-orange-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
              {field.fieldType}
            </span>
            <span className="text-[10px] text-blue-400 font-bold truncate max-w-[100px] md:max-w-[200px]">{field.fieldKey}</span>
            {field.isVirtual && <span className="text-[10px] text-orange-500 font-black bg-orange-50 px-2 py-0.5 rounded border border-orange-100">וירטואלי</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
        {field.calculationFormula && <Calculator size={16} className="text-purple-500" />}
        {field.visibilityCondition && <Eye size={16} className="text-blue-500" />}
        {field.fieldType === FieldType.LINK_BUTTON && <Zap size={16} className="text-yellow-500" />}
        {canDelete && (
          <button 
            onClick={(e) => onDelete(e, field)} 
            className="p-2 text-slate-300 hover:text-red-600 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-50 sm:bg-transparent"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.field.id === next.field.id &&
    prev.field.label === next.field.label &&
    prev.field.fieldKey === next.field.fieldKey &&
    prev.field.orderIndex === next.field.orderIndex &&
    prev.field.fieldType === next.field.fieldType &&
    prev.field.calculationFormula === next.field.calculationFormula &&
    prev.field.visibilityCondition === next.field.visibilityCondition &&
    prev.field.isVirtual === next.field.isVirtual &&
    prev.field.isRequired === next.field.isRequired &&
    prev.field.options === next.field.options &&
    prev.idx === next.idx &&
    prev.canEdit === next.canEdit &&
    prev.canDelete === next.canDelete &&
    prev.localFieldsLength === next.localFieldsLength &&
    prev.moveField === next.moveField &&
    prev.onDelete === next.onDelete &&
    prev.setEditingField === next.setEditingField &&
    prev.setEditTab === next.setEditTab
  );
});

const DETAILED_DOCS: Record<string, FuncMeta> = {
  'IF': { 
    desc: 'בודק תנאי ומחזיר ערך אחד אם אמת וערך אחר אם שקר.', 
    syntax: 'IF(תנאי, ערך_אם_אמת, ערך_אם_שקר)', 
    example: 'IF([מחיר] > 100, "יקר", "זול")',
    params: [
      { label: 'תנאי לוגי', type: 'text', desc: 'לדוגמה: [שדה] > 10' },
      { label: 'ערך אם אמת', type: 'text', desc: 'מה יוחזר אם התנאי מתקיים' },
      { label: 'ערך אם שקר', type: 'text', desc: 'מה יוחזר אם התנאי לא מתקיים' }
    ]
  },
  'IFS': { desc: 'בודק סדרת תנאים ומחזיר את הערך של התנאי הראשון שהוא אמת.', syntax: 'IFS(תנאי1, ערך1, תנאי2, ערך2, ...)', example: 'IFS([ציון] > 90, "מצוין", [ציון] > 80, "טוב")', params: [] },
  'SWITCH': { desc: 'משווה ערך לרשימת אפשרויות ומחזיר את התוצאה התואמת.', syntax: 'SWITCH(ערך, אפשרות1, תוצאה1, אפשרות2, תוצאה2, ..., ברירת_מחדל)', example: 'SWITCH([סטטוס], "חדש", 1, "בטיפול", 2, 0)', params: [] },
  'AND': { 
    desc: 'מחזיר אמת רק אם כל התנאים נכונים.', 
    syntax: 'AND(תנאי1, תנאי2, ...)', 
    example: 'AND([פעיל] = TRUE, [מחיר] > 0)',
    params: [{ label: 'תנאי', type: 'text', desc: 'ביטוי לוגי' }],
    isVariadic: true
  },
  'OR': { desc: 'מחזיר אמת אם לפחות תנאי אחד נכון.', syntax: 'OR(תנאי1, תנאי2, ...)', example: 'OR([סטטוס] = "חדש", [סטטוס] = "פתוח")', params: [] },
  'NOT': { desc: 'הופך את התוצאה הלוגית (אמת לשקר ולהפך).', syntax: 'NOT(תנאי)', example: 'NOT([פעיל])', params: [] },
  'ISBLANK': { 
    desc: 'בודק האם שדה הוא ריק.', 
    syntax: 'ISBLANK(ערך)', 
    example: 'ISBLANK([הערות])',
    params: [{ label: 'ערך לבדיקה', type: 'field', desc: 'השדה שרוצים לבדוק' }]
  },
  'ISNOTBLANK': { desc: 'בודק האם שדה אינו ריק.', syntax: 'ISNOTBLANK(ערך)', example: 'ISNOTBLANK([שם])', params: [] },
  'TRUE': { desc: 'מחזיר את הערך הלוגי אמת.', syntax: 'TRUE', example: 'TRUE', params: [] },
  'FALSE': { desc: 'מחזיר את הערך הלוגי שקר.', syntax: 'FALSE', example: 'FALSE', params: [] },
  'CONCATENATE': { 
    desc: 'מחבר מספר מחרוזות טקסט לאחת.', 
    syntax: 'CONCATENATE(טקסט1, טקסט2, ...)', 
    example: 'CONCATENATE("שלום ", [שם])',
    params: [{ label: 'טקסט לחיבור', type: 'text', desc: 'שדה או טקסט בגרשיים' }],
    isVariadic: true
  },
  'EXACT': { desc: 'משווה שתי מחרוזות טקסט בדיוק (כולל אותיות רישיות).', syntax: 'EXACT(טקסט1, טקסט2)', example: 'EXACT([סיסמה], "Secret")', params: [] },
  'FIND': { desc: 'מוצא מיקום של טקסט בתוך טקסט אחר.', syntax: 'FIND(חיפוש, טקסט)', example: 'FIND("@", [אימייל])', params: [] },
  'LEFT': { desc: 'מחזיר מספר תווים מצד שמאל של הטקסט.', syntax: 'LEFT(טקסט, מספר)', example: 'LEFT([טלפון], 3)', params: [] },
  'LEN': { desc: 'מחזיר את אורך הטקסט.', syntax: 'LEN(טקסט)', example: 'LEN([שם])', params: [] },
  'LOWER': { desc: 'ממיר טקסט לאותיות קטנות.', syntax: 'LOWER(טקסט)', example: 'LOWER([אימייל])', params: [] },
  'MID': { desc: 'מחזיר תווים מאמצע הטקסט.', syntax: 'MID(טקסט, התחלה, אורך)', example: 'MID([תעודת_זהות], 3, 4)', params: [] },
  'RIGHT': { desc: 'מחזיר מספר תווים מצד ימין של הטקסט.', syntax: 'RIGHT(טקסט, מספר)', example: 'RIGHT([טלפון], 4)', params: [] },
  'SUBSTITUTE': { desc: 'מחליף טקסט ישן בטקסט חדש.', syntax: 'SUBSTITUTE(טקסט, ישן, חדש)', example: 'SUBSTITUTE([טלפון], "-", "")', params: [] },
  'TRIM': { desc: 'מסיר רווחים מיותרים מהטקסט.', syntax: 'TRIM(טקסט)', example: 'TRIM([שם])', params: [] },
  'UPPER': { desc: 'ממיר טקסט לאותיות רישיות.', syntax: 'UPPER(טקסט)', example: 'UPPER([קוד])', params: [] },
  'CONTAINS': { desc: 'בודק אם טקסט מכיל מחרוזת מסוימת.', syntax: 'CONTAINS(טקסט, חיפוש)', example: 'CONTAINS([תיאור], "דחוף")', params: [] },
  'INITIALS': { desc: 'מחזיר ראשי תיבות של הטקסט.', syntax: 'INITIALS(טקסט)', example: 'INITIALS([שם_מלא])', params: [] },
  'ABS': { desc: 'מחזיר ערך מוחלט של מספר.', syntax: 'ABS(מספר)', example: 'ABS([הפרש])', params: [] },
  'CEILING': { desc: 'מעגל מספר כלפי מעלה.', syntax: 'CEILING(מספר)', example: 'CEILING([מחיר])', params: [] },
  'FLOOR': { desc: 'מעגל מספר כלפי מטה.', syntax: 'FLOOR(מספר)', example: 'FLOOR([מחיר])', params: [] },
  'ROUND': { desc: 'מעגל מספר לשלם הקרוב.', syntax: 'ROUND(מספר)', example: 'ROUND([ממוצע])', params: [] },
  'MOD': { desc: 'מחזיר את השארית מחלוקה.', syntax: 'MOD(מספר, מחלק)', example: 'MOD([כמות], 10)', params: [] },
  'POWER': { desc: 'מעלה מספר בחזקה.', syntax: 'POWER(בסיס, חזקה)', example: 'POWER([רדיוס], 2)', params: [] },
  'SQRT': { desc: 'מחזיר שורש ריבועי.', syntax: 'SQRT(מספר)', example: 'SQRT([שטח])', params: [] },
  'LOG': { desc: 'מחזיר לוגריתם בסיס 10.', syntax: 'LOG(מספר)', example: 'LOG([ערך])', params: [] },
  'LN': { desc: 'מחזיר לוגריתם טבעי.', syntax: 'LN(מספר)', example: 'LN([ערך])', params: [] },
  'EXP': { desc: 'מחזיר e בחזקת המספר.', syntax: 'EXP(מספר)', example: 'EXP([ערך])', params: [] },
  'MAX': { desc: 'מחזיר את הערך המקסימלי.', syntax: 'MAX(ערך1, ערך2, ...)', example: 'MAX([מחיר1], [מחיר2])', params: [] },
  'MIN': { desc: 'מחזיר את הערך המינימלי.', syntax: 'MIN(ערך1, ערך2, ...)', example: 'MIN([מחיר1], [מחיר2])', params: [] },
  'AVERAGE': { desc: 'מחזיר את הממוצע.', syntax: 'AVERAGE(ערך1, ערך2, ...)', example: 'AVERAGE([ציון1], [ציון2])', params: [] },
  'COUNT': { desc: 'סופר את מספר הפריטים.', syntax: 'COUNT(רשימה)', example: 'COUNT([פריטים])', params: [] },
  'SUM': { 
    desc: 'מחשב סכום של מספרים או שדות.', 
    syntax: 'SUM(ערך1, ערך2, ...)', 
    example: 'SUM([א], [ב], 50)',
    params: [{ label: 'ערך לסיכום', type: 'text', desc: 'שדה או מספר' }],
    isVariadic: true
  },
  'RANDBETWEEN': { desc: 'מחזיר מספר אקראי בין שני ערכים.', syntax: 'RANDBETWEEN(מינימום, מקסימום)', example: 'RANDBETWEEN(1, 100)', params: [] },
  'TODAY': { desc: 'מחזיר את התאריך של היום.', syntax: 'TODAY()', example: 'TODAY()', params: [] },
  'NOW': { desc: 'מחזיר תאריך ושעה נוכחיים.', syntax: 'NOW()', example: 'NOW()', params: [] },
  'TIMENOW': { desc: 'מחזיר את השעה הנוכחית.', syntax: 'TIMENOW()', example: 'TIMENOW()', params: [] },
  'DAY': { desc: 'מחזיר את היום בחודש מתאריך.', syntax: 'DAY(תאריך)', example: 'DAY([תאריך_לידה])', params: [] },
  'MONTH': { desc: 'מחזיר את החודש מתאריך.', syntax: 'MONTH(תאריך)', example: 'MONTH([תאריך_לידה])', params: [] },
  'YEAR': { desc: 'מחזיר את השנה מתאריך.', syntax: 'YEAR(תאריך)', example: 'YEAR([תאריך_לידה])', params: [] },
  'HOUR': { desc: 'מחזיר את השעה מזמן.', syntax: 'HOUR(זמן)', example: 'HOUR([שעת_התחלה])', params: [] },
  'MINUTE': { desc: 'מחזיר דקות מזמן.', syntax: 'MINUTE(זמן)', example: 'MINUTE([שעת_התחלה])', params: [] },
  'SECOND': { desc: 'מחזיר שניות מזמן.', syntax: 'SECOND(זמן)', example: 'SECOND([שעת_התחלה])', params: [] },
  'ANY': { desc: 'מחזיר איבר אקראי מרשימה (לרוב הראשון).', syntax: 'ANY(רשימה)', example: 'ANY([רשימת_תמונות])', params: [] },
  'IN': { desc: 'בודק אם ערך קיים ברשימה.', syntax: 'IN(ערך, רשימה)', example: 'IN([סטטוס], {"פתוח", "בטיפול"})', params: [] },
  'UNIQUE': { desc: 'מסיר כפילויות מרשימה.', syntax: 'UNIQUE(רשימה)', example: 'UNIQUE([רשימת_לקוחות])', params: [] },
  'SORT': { desc: 'ממיין רשימה.', syntax: 'SORT(רשימה)', example: 'SORT([רשימת_שמות])', params: [] },
  'LOOKUP': { 
    desc: 'מחפש ערך בטבלה חיצונית ומחזיר עמודה רצויה.', 
    syntax: 'LOOKUP(ערך, טבלה, מפתח, תוצאה)', 
    example: 'LOOKUP([ID], "Customers", "id", "name")',
    params: [
      { label: 'ערך לחיפוש', type: 'field', desc: 'השדה מהטופס שמשמש כמפתח' },
      { label: 'טבלת יעד', type: 'table', desc: 'הטבלה ב-Supabase שבה נחפש' },
      { label: 'עמודת מפתח', type: 'column', desc: 'העמודה בטבלה להשוואה', dependsOnTable: 1 },
      { label: 'עמודת תוצאה', type: 'column', desc: 'העמודה שאת הערך שלה נרצה לקבל', dependsOnTable: 1 }
    ]
  },
  'UNIQUEID': { desc: 'מייצר מזהה ייחודי אקראי.', syntax: 'UNIQUEID()', example: 'UNIQUEID()', params: [] },
  'USEREMAIL': { desc: 'מחזיר את מייל המשתמש.', syntax: 'USEREMAIL()', example: 'USEREMAIL()', params: [] },
  'USERNAME': { desc: 'מחזיר את שם המשתמש.', syntax: 'USERNAME()', example: 'USERNAME()', params: [] },
  'USERROLE': { desc: 'מחזיר את הרשאת המשתמש.', syntax: 'USERROLE()', example: 'USERROLE()', params: [] }
};

const FORMULA_FUNCTIONS = [
  { group: 'Logical (לוגיקה)', icon: <ShieldCheck size={14} />, items: ['IF', 'IFS', 'SWITCH', 'AND', 'OR', 'NOT', 'ISBLANK', 'ISNOTBLANK', 'TRUE', 'FALSE'] },
  { group: 'Text (טקסט)', icon: <TextIcon size={14} />, items: ['CONCATENATE', 'EXACT', 'FIND', 'LEFT', 'LEN', 'LOWER', 'MID', 'RIGHT', 'SUBSTITUTE', 'TRIM', 'UPPER', 'CONTAINS', 'INITIALS'] },
  { group: 'Math (מתמטיקה)', icon: <Calculator size={14} />, items: ['ABS', 'CEILING', 'FLOOR', 'ROUND', 'MOD', 'POWER', 'SQRT', 'LOG', 'LN', 'EXP', 'MAX', 'MIN', 'AVERAGE', 'COUNT', 'SUM', 'RANDBETWEEN'] },
  { group: 'Date & Time (תאריך ושעה)', icon: <Clock size={14} />, items: ['TODAY', 'NOW', 'TIMENOW', 'DAY', 'MONTH', 'YEAR', 'HOUR', 'MINUTE', 'SECOND'] },
  { group: 'List & Ref (רשימות והפניות)', icon: <List size={14} />, items: ['ANY', 'IN', 'UNIQUE', 'SORT', 'LOOKUP'] },
  { group: 'System (מערכת)', icon: <Zap size={14} />, items: ['UNIQUEID', 'USEREMAIL', 'USERNAME', 'USERROLE'] }
];

// --- EDITOR WITH HIGHLIGHTING ---
const FormulaHighlightEditor: React.FC<{
  value: string;
  onChange: (val: string) => void;
  fields: FormField[];
  dynamicSchema: Record<string, string[]>;
}> = ({ value, onChange, fields, dynamicSchema }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const mirrorRef = React.useRef<HTMLDivElement>(null);

  const [suggestions, setSuggestions] = React.useState<{ label: string; value: string; icon: React.ReactNode }[]>([]);
  const [suggestionPos, setSuggestionPos] = React.useState({ top: 0, left: 0 });
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [currentTrigger, setCurrentTrigger] = React.useState<{ pos: number; char: string } | null>(null);
  const [syntaxError, setSyntaxError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Live Syntax Validation
    if (!value || value.trim() === '') {
      setSyntaxError(null);
      return;
    }
    
    // Check for balanced parentheses
    const openParens = (value.match(/\(/g) || []).length;
    const closeParens = (value.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      setSyntaxError(`סוגריים עגולים לא תואמים: חסרים ${Math.abs(openParens - closeParens)} סוגריים.`);
      return;
    }

    // Check for balanced square brackets
    const openBrackets = (value.match(/\[/g) || []).length;
    const closeBrackets = (value.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      setSyntaxError(`סוגריים מרובעים לא תואמים: חסרים ${Math.abs(openBrackets - closeBrackets)} סוגריים.`);
      return;
    }

    // Check for unclosed quotes
    const quotes = (value.match(/"/g) || []).length;
    if (quotes % 2 !== 0) {
      setSyntaxError('מרכאות כפולות לא סגורות.');
      return;
    }

    setSyntaxError(null);
  }, [value]);

  const getHighlightedHTML = (text: string) => {
    if (!text) return '';
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/"([^"]*)"/g, '<span class="text-emerald-500">"$1"</span>');
    html = html.replace(/([^\[\s(]+)?\[([^\]]+)\]/g, '<span class="text-orange-500 font-black">$1[$2]</span>');
    const funcRegex = new RegExp(`\\b(${Object.keys(DETAILED_DOCS).join('|')})\\b(?=\\s*\\()`, 'g');
    html = html.replace(funcRegex, '<span class="text-blue-500 font-black">$1</span>');
    return html;
  };

  const calculateCaretPosition = () => {
    if (!textareaRef.current || !mirrorRef.current) return;
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    const textBeforeCaret = textarea.value.substring(0, textarea.selectionStart);
    mirror.textContent = textBeforeCaret;
    const span = document.createElement('span');
    span.textContent = textarea.value.substring(textarea.selectionStart, textarea.selectionStart + 1) || '.';
    mirror.appendChild(span);
    setSuggestionPos({ top: span.offsetTop + 35 - textarea.scrollTop, left: span.offsetLeft });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    onChange(val);
    const lastChar = val.charAt(pos - 1);
    
    // Extract the word being typed
    const textBeforeCursor = val.substring(0, pos);
    const match = textBeforeCursor.match(/([A-Za-z_]+)$/);
    const currentWord = match ? match[1].toUpperCase() : '';

    if (lastChar === '{' || lastChar === '[') {
      setCurrentTrigger({ pos, char: lastChar });
      setSuggestions(fields.map(f => ({ label: f.label, value: f.fieldKey, icon: <Variable size={12} className="text-orange-500" /> })));
      setShowSuggestions(true);
      calculateCaretPosition();
    } else if (lastChar === '"') {
      setCurrentTrigger({ pos, char: lastChar });
      setSuggestions(Object.keys(dynamicSchema).map(t => ({ label: t, value: t, icon: <TableIcon size={12} className="text-blue-500" /> })));
      setShowSuggestions(true);
      calculateCaretPosition();
    } else if (currentWord.length > 0) {
      // Function auto-completion
      const allFuncs = FORMULA_FUNCTIONS.flatMap(g => g.items);
      const matchedFuncs = allFuncs.filter(f => f.startsWith(currentWord));
      if (matchedFuncs.length > 0) {
        setCurrentTrigger({ pos: pos - currentWord.length + 1, char: 'FUNC' });
        setSuggestions(matchedFuncs.map(f => ({ label: f, value: f + '(', icon: <Code size={12} className="text-blue-500" /> })));
        setShowSuggestions(true);
        calculateCaretPosition();
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const insertSuggestion = (suggestion: string) => {
    if (!currentTrigger || !textareaRef.current) return;
    const before = value.substring(0, currentTrigger.pos - 1);
    const after = value.substring(textareaRef.current.selectionStart);
    let wrapped = suggestion;
    if (currentTrigger.char === '{' || currentTrigger.char === '[') wrapped = `[${suggestion}]`;
    else if (currentTrigger.char === '"') wrapped = `${suggestion}"`;
    // For functions, suggestion already includes '('
    
    onChange(before + wrapped + after);
    setShowSuggestions(false);
    textareaRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(prev => (prev + 1) % suggestions.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (suggestions[activeIndex]) insertSuggestion(suggestions[activeIndex].value); }
    else if (e.key === 'Escape') setShowSuggestions(false);
  };

  const syncScroll = React.useCallback(() => {
    if (containerRef.current && textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = scrollTop;
          containerRef.current.scrollLeft = scrollLeft;
        }
      });
    }
  }, []);
  const commonStyles = "font-mono text-xl leading-relaxed p-8 break-words whitespace-pre-wrap text-left";

  return (
    <div className="flex flex-col h-full gap-2">
      <div className={`relative w-full h-full font-mono text-xl border-2 rounded-[2.5rem] bg-white overflow-hidden shadow-inner transition-all ${syntaxError ? 'border-red-400 focus-within:border-red-500' : 'border-slate-100 focus-within:border-blue-500'}`}>
        <div ref={mirrorRef} className={`absolute inset-0 invisible pointer-events-none ${commonStyles}`} style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }} />
        <div ref={containerRef} dir="ltr" className={`absolute inset-0 pointer-events-none overflow-hidden border-2 border-transparent ${commonStyles}`} dangerouslySetInnerHTML={{ __html: getHighlightedHTML(value) + '\n' }} />
        <textarea ref={textareaRef} dir="ltr" value={value} onChange={handleTextChange} onKeyDown={handleKeyDown} onScroll={syncScroll} placeholder="הזן נוסחה..." spellCheck={false} className={`absolute inset-0 w-full h-full bg-transparent text-transparent caret-slate-800 outline-none resize-none overflow-auto border-2 border-transparent ${commonStyles}`} />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-[1000] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden min-w-[200px] animate-in fade-in zoom-in duration-150" style={{ top: suggestionPos.top, left: suggestionPos.left }}>
            <div className="max-h-48 overflow-y-auto scrollbar-thin">
              {suggestions.map((s, i) => (
                <button key={s.value} onClick={() => insertSuggestion(s.value)} onMouseEnter={() => setActiveIndex(i)} className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm font-bold transition-colors ${i === activeIndex ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`} >
                  {s.icon} <span className="truncate">{s.label}</span> <span className={`ml-auto text-[9px] font-black uppercase opacity-50 ${i === activeIndex ? 'text-blue-100' : 'text-slate-400'}`}>{s.value}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {syntaxError && (
        <div className="flex items-center gap-2 text-red-500 text-sm font-bold px-4 py-2 bg-red-50 rounded-xl animate-in fade-in">
          <AlertTriangle size={16} />
          <span>שגיאת תחביר: {syntaxError}</span>
        </div>
      )}
    </div>
  );
};

// --- SUPPLEMENTAL: GENERIC DYNAMIC PARAMETER ASSISTANT ---
const ParameterAssistant: React.FC<{
  funcName: string;
  fields: FormField[];
  dynamicSchema: Record<string, string[]>;
  onApply: (formula: string) => void;
  onCancel: () => void;
}> = ({ funcName, fields, dynamicSchema, onApply, onCancel }) => {
  const meta = DETAILED_DOCS[funcName];
  if (!meta) return null;
  const [args, setArgs] = React.useState<string[]>(meta.params?.map(() => '') || []);

  const handleArgChange = (idx: number, val: string) => {
    const newArgs = [...args];
    newArgs[idx] = val;
    setArgs(newArgs);
  };

  const addArg = () => { if (meta.isVariadic) setArgs([...args, '']); };
  const removeArg = (idx: number) => { if (meta.isVariadic && args.length > 1) setArgs(args.filter((_, i) => i !== idx)); };

  const formatValue = (val: string, type: ParamType) => {
    if (!val) return '';
    if (type === 'field') return `[${val}]`;
    if (type === 'table' || type === 'column') return `"${val}"`;
    return val;
  };

  const constructedFormula = `${funcName}( ${args.map((v, i) => {
    const pType = meta.params && meta.params[i] ? meta.params[i].type : (meta.params?.[0].type || 'text');
    return formatValue(v, pType as ParamType);
  }).join(', ')} )`;

  const isComplete = args.every(a => a !== '') && (meta.params?.length || 0) <= args.length;

  return (
    <div className="bg-white border-2 border-blue-100 rounded-[2.5rem] p-8 space-y-6 animate-in slide-in-from-right-4 duration-300 shadow-xl shadow-blue-50/50 h-full flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100"><Sparkles size={18}/></div>
          <h3 className="font-black text-slate-800">עוזר חכם: {funcName}</h3>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-5 scrollbar-thin">
        {args.map((val, idx) => {
          const pMeta = meta.params && (meta.params[idx] || (meta.isVariadic ? meta.params[0] : null));
          if (!pMeta) return null;

          let targetColumns: string[] = [];
          if (pMeta.type === 'column' && pMeta.dependsOnTable !== undefined) {
            const tableName = args[pMeta.dependsOnTable];
            targetColumns = dynamicSchema[tableName] || [];
          }

          return (
            <div key={idx} className="space-y-1.5 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  {pMeta.label} {meta.isVariadic ? `#${idx + 1}` : ''}
                </label>
                {meta.isVariadic && args.length > 1 && (
                  <button onClick={() => removeArg(idx)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={12}/></button>
                )}
              </div>
              
              {pMeta.type === 'field' ? (
                <select value={val} onChange={e => handleArgChange(idx, e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500">
                  <option value="">בחר שדה מהטופס...</option>
                  {fields.map(f => <option key={f.fieldKey} value={f.fieldKey}>{f.label}</option>)}
                </select>
              ) : pMeta.type === 'table' ? (
                <select value={val} onChange={e => handleArgChange(idx, e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500">
                  <option value="">בחר טבלה ב-DB...</option>
                  {Object.keys(dynamicSchema).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : pMeta.type === 'column' ? (
                <select value={val} disabled={targetColumns.length === 0} onChange={e => handleArgChange(idx, e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 disabled:opacity-50">
                  <option value="">בחר עמודה...</option>
                  {targetColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input type="text" value={val} onChange={e => handleArgChange(idx, e.target.value)} placeholder={pMeta.desc} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500" />
              )}
            </div>
          );
        })}

        {meta.isVariadic && (
          <button onClick={addArg} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-blue-500 hover:border-blue-200 transition-all font-black text-[10px] flex items-center justify-center gap-2">
            <Plus size={14}/> הוסף ארגומנט ל-{funcName}
          </button>
        )}
      </div>

      <div className="pt-4 border-t border-slate-100 space-y-4 flex-shrink-0">
        <div className="p-4 bg-slate-900 rounded-2xl border border-white/5 space-y-2">
           <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">תצוגה מקדימה</span>
           <div className="font-mono text-xs text-white break-all leading-relaxed" dir="ltr">{constructedFormula}</div>
        </div>
        <button disabled={!isComplete} onClick={() => onApply(constructedFormula)} className={`w-full py-4 rounded-[1.5rem] font-black transition-all flex items-center justify-center gap-2 ${isComplete ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 hover:bg-blue-700' : 'bg-slate-100 text-slate-400'}`} >
          <ArrowLeft size={18} /> הזרק נוסחה לעורך
        </button>
      </div>
    </div>
  );
};

interface FormBuilderProps {
  user: User;
}

const FormBuilder: React.FC<FormBuilderProps> = ({ user }) => {
  const [templates, setTemplates] = React.useState<FormTemplate[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [localFields, setLocalFields] = React.useState<FormField[]>([]);
  const [deletedFieldIds, setDeletedFieldIds] = React.useState<string[]>([]);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState('');
  const [dynamicSchema, setDynamicSchema] = React.useState<Record<string, string[]>>({});
  const [dynamicTableData, setDynamicTableData] = React.useState<Record<string, any[]>>({});
  const [isSchemaLoading, setIsSchemaLoading] = React.useState(false);
  const [tableSearch, setTableSearch] = React.useState('');
  const [editingField, setEditingField] = React.useState<FormField | null>(null);
  const [editTab, setEditTab] = React.useState<'general' | 'logic' | 'options' | 'preview'>('general');
  const [wizardConfig, setWizardConfig] = React.useState<{ isOpen: boolean; targetField: any; currentFormula: string; sidebarTab: any; activeAssistantFunc: string | null; expandedTable: string | null; selectedDocKey: string | null; sandboxValues: Record<string, any>; } | null>(null);
  const [syncConfig, setSyncConfig] = React.useState<{ isOpen: boolean; tables: any[]; selectedTable: string | null; diff: any; isLoading: boolean; } | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = React.useState(false); // Fixed: setter name and scope
  const [newTemplateData, setNewTemplateData] = React.useState({ name: '', formKey: '', description: '', tableName: '' });
  const [templateToDelete, setTemplateToDelete] = React.useState<FormTemplate | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [localNavigationConfig, setLocalNavigationConfig] = React.useState<FormTemplate['navigation_config']>({ enabled: false, label: '', targetTemplateId: '' });
  const [localTableName, setLocalTableName] = React.useState<string>('');
  const [availableTables, setAvailableTables] = React.useState<{ id: string; label: string }[]>([]);
  const [templateSearch, setTemplateSearch] = React.useState('');
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = React.useState(false);
  const [fieldSearch, setFieldSearch] = React.useState('');
  const [isFieldDropdownOpen, setIsFieldDropdownOpen] = React.useState(false);
  const [aiQuery, setAiQuery] = React.useState('');
  const [aiResponse, setAiResponse] = React.useState('');
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [syncSuccess, setSyncSuccess] = React.useState(false);
  const { hasPermission } = usePermissions();
  const canEditForm = hasPermission('form_builder', 'canEdit');
  const canDeleteForm = hasPermission('form_builder', 'canDelete');

  const handleMirrorSync = async (tableName?: string) => {
    const targetTable = tableName || localTableName;
    if (!targetTable || !selectedTemplateId) {
      if (!targetTable) {
        setSyncConfig({ isOpen: true, tables: [], selectedTable: null, diff: null, isLoading: false });
      }
      return;
    }

    setIsSchemaLoading(true);
    try {
      // 1. Schema Fetching: Fetch table schema including ordinal_position
      const dbCols = await dbService.getTableColumns(targetTable);
      const virtualCols = await dbService.getVirtualColumns(targetTable);
      
      if ((!dbCols || dbCols.length === 0) && virtualCols.length === 0) {
        alert('לא ניתן היה למשוך עמודות מהטבלה הנבחרת.');
        return;
      }

      const existingFields = [...localFields];
      const finalFields: FormField[] = [];
      const processedKeys = new Set<string>();

      // 1. Process Real Columns (Source of Truth for these)
      dbCols.forEach(col => {
        const key = col.column_name.trim();
        const existing = existingFields.find(f => f.fieldKey.trim() === key);
        
        if (existing) {
          finalFields.push({
            ...existing,
            orderIndex: col.ordinal_position,
            isVirtual: false
          });
        } else {
          finalFields.push({
            id: `temp_field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            formTemplateId: selectedTemplateId!,
            fieldKey: key,
            label: key,
            fieldType: col.data_type.includes('int') || col.data_type.includes('num') ? FieldType.NUMBER : FieldType.TEXT,
            orderIndex: col.ordinal_position,
            isRequired: false,
            isVirtual: false
          });
        }
        processedKeys.add(key);
      });

      // 2. Process Virtual Columns
      virtualCols.forEach((vCol, idx) => {
        const key = vCol.trim();
        if (processedKeys.has(key)) return; // Already processed as real column

        const existing = existingFields.find(f => f.fieldKey.trim() === key);
        const order = dbCols.length + idx + 1;

        if (existing) {
          finalFields.push({
            ...existing,
            orderIndex: order,
            isVirtual: true
          });
        } else {
          finalFields.push({
            id: `temp_vfield_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            formTemplateId: selectedTemplateId!,
            fieldKey: key,
            label: key,
            fieldType: FieldType.TEXT,
            orderIndex: order,
            isRequired: false,
            isVirtual: true
          });
        }
        processedKeys.add(key);
      });

      // 3. Keep everything else (Manually defined fields, Link Buttons, etc.)
      const remainingFields = existingFields.filter(f => !processedKeys.has(f.fieldKey.trim()));
      const maxOrderSoFar = finalFields.length > 0 ? Math.max(...finalFields.map(f => f.orderIndex)) : 0;

      remainingFields.forEach((f, idx) => {
        finalFields.push({
          ...f,
          orderIndex: maxOrderSoFar + idx + 1
        });
      });

      // 3. Save immediately to DB
      setSaving(true);
      const fieldsToSave = finalFields.filter(f => f.fieldType !== FieldType.LINK_BUTTON);
      await dbService.saveFormFields(selectedTemplateId!, fieldsToSave, deletedFieldIds);
      
      // 4. The "React Flush" Trick: Empty state first to force structural re-render
      setLocalFields([]);
      
      setTimeout(async () => {
        // Update local state and metadata
        setLocalFields(finalFields);
        setHasChanges(false);
        setDeletedFieldIds([]);
        
        // Refresh data to ensure UI reflects the 1-to-1 order
        await loadData(selectedTemplateId!);

        // Success Confirmation
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 3000);
      }, 0);
      
      if (syncConfig) setSyncConfig(null);
    } catch (err) {
      console.error('Sync error:', err);
      alert('שגיאה בסנכרון השדות.');
    } finally {
      setIsSchemaLoading(false);
      setSaving(false);
    }
  };

  const moveField = React.useCallback((index: number, direction: 'up' | 'down') => {
    if (!canEditForm) return;
    setLocalFields(prev => {
      const newFields = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newFields.length) return prev;
      const temp = newFields[index];
      newFields[index] = newFields[targetIndex];
      newFields[targetIndex] = temp;
      return newFields.map((f, idx) => ({ ...f, orderIndex: idx + 1 }));
    });
    setHasChanges(true);
  }, [canEditForm]);

  const handleDeleteField = React.useCallback((e: React.MouseEvent, field: FormField) => {
    e.stopPropagation();
    setLocalFields(prev => prev.filter(item => item.id !== field.id));
    if (!field.id.startsWith('temp_')) {
      setDeletedFieldIds(prev => [...prev, field.id]);
    }
    setHasChanges(true);
  }, []);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || null;

  const filteredFields = React.useMemo(() => {
    return localFields
      .filter(f => 
        (f.label && f.label.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) || 
        (f.fieldKey && f.fieldKey.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
      )
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [localFields, debouncedSearchTerm]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  React.useEffect(() => { loadData(); fetchTables(); }, []);
  
  const fetchTables = async () => {
    try {
      const tables = await dbService.getTablesList();
      setAvailableTables(tables);
    } catch (err) {
      // Error handled silently
    }
  };

  React.useEffect(() => { 
    if (selectedTemplate) { 
      setLocalFields([...selectedTemplate.fields].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))); 
      setLocalNavigationConfig(selectedTemplate.navigation_config || { enabled: false, label: '', targetTemplateId: '' });
      setLocalTableName(selectedTemplate.tableName || '');
      setDeletedFieldIds([]); 
      setHasChanges(false); 
    } 
  }, [selectedTemplateId, templates]);
  React.useEffect(() => { if (wizardConfig?.isOpen && (wizardConfig?.sidebarTab === 'data' || wizardConfig?.sidebarTab === 'assistant')) fetchDynamicSchema(); }, [wizardConfig?.isOpen, wizardConfig?.sidebarTab]);

  const fetchDynamicSchema = async (forceRefresh = false) => {
    if (!forceRefresh && Object.keys(dynamicSchema).length > 0) return;
    setIsSchemaLoading(true);
    try {
      if (forceRefresh) await dbService.reloadSchemaCache();
      const currentUser = authService.getCurrentUser();
      const dtd = await dbService.getDynamicSchema(currentUser?.name || 'System', forceRefresh);
      const ds: Record<string, string[]> = {};
      Object.keys(dtd).forEach(tableName => {
        const data = dtd[tableName];
        if (data && data.length > 0) {
          const allKeys = new Set<string>();
          data.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
          ds[tableName] = Array.from(allKeys).sort();
        } else {
          ds[tableName] = [];
        }
      });
      setDynamicSchema(ds);
      setDynamicTableData(dtd);
    } finally { setIsSchemaLoading(false); }
  };

  const loadData = async (idToSelect?: string) => {
    setLoading(true);
    try {
      const [tData, cData, uData] = await Promise.all([dbService.getFormTemplates(), dbService.getCustomers(), dbService.getUsers()]);
      setTemplates(tData); setCustomers(cData); setUsers(uData);
      if (tData.length > 0) setSelectedTemplateId(idToSelect || selectedTemplateId || tData[0].id);
      await fetchDynamicSchema();
    } catch { } finally { setLoading(false); }
  };

  const handleAskAi = async () => {
    if (!aiQuery.trim()) return;
    setIsAiLoading(true);
    try {
      const aiClient = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '' });
      const response = await aiClient.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are an AppSheet formula expert. The user wants to write a formula for a field named "${wizardConfig?.targetField}". 
        Available fields: ${localFields.map(f => f.label).join(', ')}.
        Available tables: ${Object.keys(dynamicSchema).join(', ')}.
        User query: ${aiQuery}
        Provide only the exact AppSheet formula without markdown formatting or explanations.`,
      });
      setAiResponse(response.text || '');
    } catch (e) {
      setAiResponse('שגיאה בתקשורת עם העוזר החכם. ודא שמפתח ה-API מוגדר.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveForm = async () => { 
    if (!selectedTemplateId) return; 
    setSaving(true); 
    try { 
      // 1. Save Fields (Isolated)
      // Filter out any linkButton fields from the fields array to prevent schema issues
      const fieldsToSave = localFields.filter(f => f.fieldType !== FieldType.LINK_BUTTON);
      await dbService.saveFormFields(selectedTemplateId, fieldsToSave, deletedFieldIds);
      
      // 2. Save Template Metadata (Isolated & Resilient)
      await dbService.updateFormTemplate(selectedTemplateId, { 
        navigation_config: localNavigationConfig,
        tableName: localTableName
      });

      setHasChanges(false); 
      setDeletedFieldIds([]); 
      await loadData(selectedTemplateId); 
    } catch (err) { 
      alert('שגיאה בשמירה.'); 
    } finally { 
      setSaving(false); 
    } 
  };

  const previewFields = React.useMemo(() => {
    const ef = editingField;
    const current = ef ? localFields.map(f => (f.id === ef.id ? ef : f)) : localFields;
    const customerOptions = customers.map(c => ({ value: c.id, label: `${c.name} (${c.customerNumber || c.customer_number})` }));
    return [{ id: 'sys_customer', fieldKey: 'customerId', label: 'בחר לקוח', fieldType: FieldType.SELECT, isRequired: true, orderIndex: -100, options: customerOptions } as any, ...current].sort((a,b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [localFields, editingField, customers]);

  const previewContext = React.useMemo(() => ({
    ...dynamicTableData,
    Customers: customers.map(c => ({ ...JSON.parse(c.notes || '{}'), id: c.id, customer_number: c.customer_number || c.customerNumber, name: c.name, address: c.address, city: c.city })),
    Users: users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role }))
  }), [customers, users, dynamicTableData]);

  const { evaluateFormula } = useFormulaEngine(previewContext, authService.getCurrentUser());

  const [wizardResult, setWizardResult] = React.useState<{ val: any; error: string | null }>({ val: null, error: null });
  const [isEvaluating, setIsEvaluating] = React.useState(false);

  React.useEffect(() => {
    if (!wizardConfig?.currentFormula) {
      setWizardResult({ val: null, error: null });
      return;
    }

    const timer = setTimeout(async () => {
      setIsEvaluating(true);
      try {
        const mockData: any = { customerId: 'c1', ...wizardConfig.sandboxValues };
        // Fill missing fields with defaults for simulation
        localFields.forEach(f => { 
          if (mockData[f.fieldKey] === undefined) {
             mockData[f.fieldKey] = f.fieldType === FieldType.NUMBER ? 10 : "דוגמה"; 
          }
        });
        
        const res = await evaluateFormula(wizardConfig.currentFormula, mockData);
        setWizardResult({ val: res, error: null });
      } catch (e: any) {
        setWizardResult({ val: null, error: e.message });
      } finally {
        setIsEvaluating(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [wizardConfig?.currentFormula, wizardConfig?.sandboxValues, evaluateFormula, localFields]);

  const detectedSandboxFields = React.useMemo(() => { 
    if (!wizardConfig?.currentFormula) return []; 
    const matches = Array.from(wizardConfig.currentFormula.matchAll(/([^\[\s(]+)?\[([^\]]+)\]/g)); 
    const unique = new Set<string>(); 
    matches.forEach(m => { if (!m[1]) unique.add(m[2]); }); 
    return Array.from(unique).map(k => localFields.find(lf => lf.fieldKey === k) || { fieldKey: k, label: k, fieldType: FieldType.TEXT } as any); 
  }, [wizardConfig?.currentFormula, localFields]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-80px)] md:h-[calc(100vh-120px)] gap-4 md:gap-6" dir="rtl">
      <div className="w-full md:w-72 bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden shrink-0 h-1/3 md:h-auto">
        <div className="p-4 bg-slate-50 border-b font-bold text-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600"><Trello size={18} /> תבניות</div>
          <button onClick={() => setIsCreatingTemplate(true)} className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg"><PlusCircle size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {templates.map(t => (
            <div key={t.id} className="relative group/tmpl">
              <button onClick={() => setSelectedTemplateId(t.id)} className={`w-full text-right p-4 rounded-2xl transition-all group ${selectedTemplateId === t.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'hover:bg-slate-50'}`} >
                <div className="font-black text-sm">{t.name}</div> <div className={`text-[10px] font-bold ${selectedTemplateId === t.id ? 'text-blue-100' : 'text-slate-400'}`}>{t.formKey}</div>
              </button>
              {canDeleteForm && (
                <button onClick={(e) => { e.stopPropagation(); setTemplateToDelete(t); }} className={`absolute top-2 left-2 p-2 rounded-lg opacity-0 group-hover/tmpl:opacity-100 transition-all ${selectedTemplateId === t.id ? 'bg-white/20 text-white hover:bg-white/40' : 'bg-red-50 text-red-600 hover:bg-red-100'}`} ><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl md:rounded-2xl border shadow-sm flex flex-col overflow-hidden min-h-[400px]">
        {selectedTemplate ? (
          <>
            <div className="p-4 md:p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center bg-white sticky top-0 z-10 gap-4">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1 w-full">
                <div>
                  <h2 className="text-lg md:text-xl font-black text-slate-800">{selectedTemplate.name}</h2>
                  <span className="text-[10px] md:text-xs text-slate-400 font-bold tracking-widest">{selectedTemplate.formKey}</span>
                </div>
                <div className="relative flex-1 max-w-md w-full">
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="חפש שדה..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <button onClick={() => handleMirrorSync()} className="flex-1 md:flex-none px-2 md:px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg md:rounded-xl hover:bg-emerald-100 font-black text-[10px] md:text-xs transition-all min-h-[36px] md:min-h-[44px] flex items-center justify-center gap-1.5 md:gap-2"><ArrowRightLeft size={14} className="md:w-4 md:h-4" /> <span className="hidden sm:inline">Mirror Sync</span></button>
                <button onClick={() => { const max = Math.max(...localFields.map(f => f.orderIndex || 0), -1); const n: any = { id: `temp_${Date.now()}`, fieldKey: `f_${localFields.length+1}`, label: 'שדה חדש', fieldType: FieldType.TEXT, orderIndex: max+1, isRequired: false, isVirtual: false }; setLocalFields([...localFields, n]); setHasChanges(true); setEditingField(n); }} className="flex-1 md:flex-none px-2 md:px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg md:rounded-xl font-black text-[10px] md:text-xs hover:bg-blue-100 min-h-[36px] md:min-h-[44px] flex items-center justify-center gap-1.5 md:gap-2"><Plus size={14} className="md:w-4 md:h-4" /> <span className="hidden sm:inline">הוספת שדה</span></button>
                <button onClick={handleSaveForm} disabled={!hasChanges || saving} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-4 md:px-6 py-2 rounded-lg md:rounded-xl font-black text-xs md:text-sm transition-all shadow-lg min-h-[36px] md:min-h-[44px] ${hasChanges ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-100 text-slate-400'}`}> {saving ? <Loader2 size={16} className="md:w-4 md:h-4 animate-spin" /> : <Save size={16} className="md:w-4 md:h-4" />} שמור </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 space-y-4">
              {/* Redirection Button Settings */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><ArrowRightLeft size={20} /></div>
                    <div>
                      <h3 className="font-black text-slate-800">לחצן ניווט (Redirection Button)</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">הגדרת לחצן קבוע למעבר בין טפסים</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setLocalNavigationConfig(prev => ({ ...prev!, enabled: !prev?.enabled })); setHasChanges(true); }}
                    className={`w-12 h-6 rounded-full relative transition-all ${localNavigationConfig?.enabled ? 'bg-blue-600' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localNavigationConfig?.enabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {localNavigationConfig?.enabled && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">טקסט הלחצן</label>
                      <input 
                        type="text" 
                        value={localNavigationConfig.label} 
                        onChange={e => { setLocalNavigationConfig(prev => ({ ...prev!, label: e.target.value })); setHasChanges(true); }}
                        placeholder="לדוגמה: פתח טופס 4"
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">טופס יעד</label>
                      <select 
                        value={localNavigationConfig.targetTemplateId} 
                        onChange={e => { setLocalNavigationConfig(prev => ({ ...prev!, targetTemplateId: e.target.value })); setHasChanges(true); }}
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-blue-500 appearance-none"
                      >
                        <option value="">בחר טופס יעד...</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Dedicated Table Settings */}
                <div className="pt-4 border-t border-slate-50 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Database size={20} /></div>
                    <div>
                      <h3 className="font-black text-slate-800">טבלת נתונים ייעודית</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">הגדרת טבלה ספציפית לשמירת נתוני הטופס</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">שם הטבלה ב-Supabase</label>
                    <select 
                      value={localTableName} 
                      onChange={e => { setLocalTableName(e.target.value); setHasChanges(true); }}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-emerald-500 appearance-none"
                    >
                      <option value="">Default (inspections table)</option>
                      {availableTables.filter(t => t.id !== 'inspections').map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 font-bold px-1 italic">* אם השדה ריק, הנתונים יישמרו בטבלת inspections הכללית.</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><LayoutList size={20} /></div>
                    <div>
                      <h3 className="font-black text-slate-800">הצג כלחצן ראשי בעמוד ביקורות</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">הצג טופס זה כלחצן בולט בעמוד ביקורות במקום ברשימה הנגללת</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setLocalNavigationConfig(prev => ({ ...prev!, showAsButton: !prev?.showAsButton })); setHasChanges(true); }}
                    className={`w-12 h-6 rounded-full relative transition-all ${localNavigationConfig?.showAsButton ? 'bg-purple-600' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localNavigationConfig?.showAsButton ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              {filteredFields.map((field, idx) => (
                <FieldRow 
                  key={field.id}
                  field={field}
                  idx={idx}
                  canEdit={canEditForm}
                  canDelete={canDeleteForm}
                  moveField={moveField}
                  setEditingField={setEditingField}
                  setEditTab={setEditTab}
                  localFieldsLength={localFields.length}
                  onDelete={handleDeleteField}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50 gap-4"> <Trello size={64} className="opacity-10" /> <span className="font-black text-lg">בחר תבנית מהתפריט הצדדי</span> </div>
        )}
      </div>

      {editingField && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-2 md:p-4 backdrop-blur-md text-right" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col h-[95vh] md:h-[90vh]">
            <div className="p-4 md:p-6 border-b flex justify-between items-center"> <h2 className="font-black text-slate-800 flex items-center gap-3 text-lg md:text-xl"> {editTab === 'preview' ? <><PlayCircle size={24} className="text-green-600" /> Sandbox</> : <><Settings2 size={24} className="text-blue-600" /> הגדרות שדה: {editingField.label}</>} </h2> <button onClick={() => setEditingField(null)} className="p-2 hover:bg-slate-100 rounded-full transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"><X size={24} /></button> </div>
            <div className="flex border-b bg-slate-50 p-1 overflow-x-auto scrollbar-none"> {[{ id: 'general', label: 'כללי' }, { id: 'logic', label: 'לוגיקה' }, { id: 'options', label: 'אפשרויות' }, { id: 'preview', label: 'תצוגה מקדימה' }].map(t => ( <button key={t.id} onClick={() => setEditTab(t.id as any)} className={`flex-1 min-w-[100px] py-3 md:py-4 text-xs md:text-sm font-black rounded-2xl whitespace-nowrap px-2 ${editTab === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}> {t.label} </button> ))} </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-white">
              {editTab === 'general' && ( 
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-4xl">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">תווית השדה</label>
                    <input type="text" value={editingField.label} onChange={e => setEditingField({...editingField, label: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">מפתח שדה</label>
                    <input type="text" value={editingField.fieldKey} onChange={e => setEditingField({...editingField, fieldKey: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-mono" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">סוג שדה</label>
                    <select 
                      value={editingField.fieldType} 
                      onChange={e => {
                        const newType = e.target.value as FieldType;
                        setEditingField({
                          ...editingField, 
                          fieldType: newType,
                          isVirtual: newType === FieldType.LINK_BUTTON ? true : editingField.isVirtual
                        });
                      }} 
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold appearance-none"
                    > 
                      {Object.values(FieldType).filter(t => t !== FieldType.LINK_BUTTON).map(t => <option key={t} value={t}>{t}</option>)} 
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">שדה וירטואלי (ללא עמודה ב-DB)</label>
                    <button 
                      type="button"
                      onClick={() => setEditingField({...editingField, isVirtual: !editingField.isVirtual})}
                      className={`w-full p-4 rounded-2xl border-2 font-black transition-all flex items-center justify-between ${editingField.isVirtual ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Zap size={16} className={editingField.isVirtual ? 'text-orange-500' : 'text-slate-300'} />
                        <span>{editingField.isVirtual ? 'שדה וירטואלי (UI בלבד)' : 'שדה נתונים (מסונכרן ל-DB)'}</span>
                      </div>
                      <div className={`w-10 h-5 rounded-full relative transition-colors ${editingField.isVirtual ? 'bg-orange-500' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${editingField.isVirtual ? 'left-1' : 'left-6'}`} />
                      </div>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">שדה חובה</label>
                    <button 
                      type="button"
                      onClick={() => setEditingField({...editingField, isRequired: !editingField.isRequired})}
                      className={`w-full p-4 rounded-2xl border-2 font-black transition-all flex items-center justify-between ${editingField.isRequired ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className={editingField.isRequired ? 'text-red-500' : 'text-slate-300'} />
                        <span>{editingField.isRequired ? 'שדה חובה (מנדטורי)' : 'שדה אופציונלי'}</span>
                      </div>
                      <div className={`w-10 h-5 rounded-full relative transition-colors ${editingField.isRequired ? 'bg-red-500' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${editingField.isRequired ? 'left-1' : 'left-6'}`} />
                      </div>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">נראות השדה</label>
                    <button 
                      type="button"
                      onClick={() => setEditingField({...editingField, isHidden: !editingField.isHidden})}
                      className={`w-full p-4 rounded-2xl border-2 font-black transition-all flex items-center justify-between ${editingField.isHidden ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-blue-50 border-blue-200 text-blue-700'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Eye size={16} className={editingField.isHidden ? 'text-slate-400' : 'text-blue-500'} />
                        <span>{editingField.isHidden ? 'מוסתר מהטופס' : 'גלוי בטופס'}</span>
                      </div>
                      <div className={`w-10 h-5 rounded-full relative transition-colors ${editingField.isHidden ? 'bg-slate-400' : 'bg-blue-500'}`}>
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${editingField.isHidden ? 'left-1' : 'left-6'}`} />
                      </div>
                    </button>
                  </div>

                  {/* Copy Settings From Dropdown */}
                  <div className="space-y-2 md:col-span-2 pt-6 border-t border-slate-100 mt-4">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1 flex items-center gap-2">
                      <Copy size={14} className="text-blue-500" />
                      העתק הגדרות משדה קיים
                    </label>
                    <select 
                      value=""
                      onChange={(e) => {
                        const selectedFieldKey = e.target.value;
                        if (!selectedFieldKey) return;

                        const sourceField = localFields.find(f => f.fieldKey === selectedFieldKey);
                        if (!sourceField) return;

                        // Create a new field object by copying all properties except label, fieldKey, id, and orderIndex (Position)
                        const { label, fieldKey, id, orderIndex, ...copiedSettings } = sourceField;
                        
                        setEditingField(prev => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            ...copiedSettings
                          };
                        });
                        
                        setHasChanges(true);
                        e.target.value = ""; // Reset
                      }}
                      className="w-full p-4 bg-blue-50/50 border-2 border-blue-100 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-blue-700 appearance-none"
                    >
                      <option value="">בחר שדה להעתקה (מאותו סוג)...</option>
                      {localFields
                        .filter(f => f.fieldType === editingField.fieldType && f.fieldKey !== editingField.fieldKey)
                        .map(f => (
                          <option key={f.id} value={f.fieldKey}>{f.label} ({f.fieldKey})</option>
                        ))
                      }
                    </select>
                    <p className="text-[10px] text-slate-400 font-bold px-1">
                      * פעולה זו תעתיק את כל ההגדרות, הלוגיקה והאפשרויות מהשדה הנבחר (למעט שם ומפתח).
                    </p>
                  </div>
                </div> 
              )}
              {editTab === 'logic' && ( 
                <div className="space-y-10 max-w-4xl"> 
                  {/* Initial Value Logic Section */}
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400"><Database size={18} className="text-orange-500"/></div>
                        <div>
                          <h4 className="font-black text-slate-800">לוגיקת ערך התחלתי (Lookup)</h4>
                          <p className="text-xs text-slate-500 font-bold">משיכת נתונים אוטומטית מרשומה מקושרת</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">משוך ערך מרפרנס?</span>
                        <button 
                          onClick={() => {
                            const currentOptions = (editingField.options as any) || {};
                            setEditingField({
                              ...editingField, 
                              options: { ...currentOptions, pullFromRef: !currentOptions.pullFromRef }
                            });
                          }}
                          className={`w-12 h-6 rounded-full relative transition-all ${(editingField.options as any)?.pullFromRef ? 'bg-orange-500' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${(editingField.options as any)?.pullFromRef ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>
                    </div>

                    {(editingField.options as any)?.pullFromRef && (
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/50 animate-in slide-in-from-top-2">
                        {/* Step 1: Linked Ref Field (Template Selector) */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">שדה רפרנס מקשר (Linked Ref Field)</label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-orange-500 flex justify-between items-center text-right text-slate-900"
                            >
                              {(() => {
                                const currentTemplateId = (editingField.options as any)?.linkedRefField;
                                const selectedTemplate = templates.find(t => t.id === currentTemplateId);
                                return (
                                  <span className={`truncate ${currentTemplateId ? 'text-slate-900' : 'text-slate-400'}`}>
                                    {selectedTemplate ? selectedTemplate.name : 'בחר תבנית מקור...'}
                                  </span>
                                );
                              })()}
                              <ChevronDown size={16} className={`text-slate-400 transition-transform flex-shrink-0 ${isTemplateDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isTemplateDropdownOpen && (
                              <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
                                <div className="p-2 border-b border-slate-100 bg-slate-50">
                                  <div className="relative">
                                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                      type="text"
                                      value={templateSearch}
                                      onChange={(e) => setTemplateSearch(e.target.value)}
                                      placeholder="חפש תבנית..."
                                      autoFocus
                                      className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                                <div className="max-h-60 overflow-y-auto scrollbar-thin p-1">
                                  {templates
                                    .filter(t => t.name && t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                                    .map(t => (
                                    <button
                                      key={t.id}
                                      type="button"
                                      onClick={() => {
                                        const currentOptions = (editingField.options as any) || {};
                                        setEditingField({
                                          ...editingField, 
                                          options: { 
                                            ...currentOptions, 
                                            linkedRefField: t.id,
                                            sourceProperty: '' // Reset dependent field
                                          }
                                        });
                                        setIsTemplateDropdownOpen(false);
                                        setTemplateSearch('');
                                      }}
                                      className={`w-full text-right px-3 py-2 rounded-lg text-sm flex items-center justify-between group transition-colors ${(editingField.options as any)?.linkedRefField === t.id ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                      <span className="font-bold truncate">{t.name}</span>
                                      {(editingField.options as any)?.linkedRefField === t.id && <Check size={14} className="flex-shrink-0" />}
                                    </button>
                                  ))}
                                  {templates.filter(t => t.name && t.name.toLowerCase().includes(templateSearch.toLowerCase())).length === 0 && (
                                    <div className="p-4 text-center text-xs text-slate-400 font-bold">לא נמצאו תבניות</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step 2: Source Property (Dependent Field Selector) */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">מאפיין מקור (Source Property)</label>
                          {(() => {
                            const currentTemplateId = (editingField.options as any)?.linkedRefField;
                            const sourceTemplate = templates.find(t => t.id === currentTemplateId);
                            
                            if (!currentTemplateId) {
                              return (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-sm font-bold flex items-center justify-center h-[46px]">
                                  בחר תבנית קודם
                                </div>
                              );
                            }

                            const currentFieldKey = (editingField.options as any)?.sourceProperty;
                            const selectedField = sourceTemplate?.fields.find(f => f.fieldKey === currentFieldKey);
                            
                            const filteredFields = (sourceTemplate?.fields || []).filter(f => 
                              (f.label && f.label.toLowerCase().includes(fieldSearch.toLowerCase())) || 
                              (f.fieldKey && f.fieldKey.toLowerCase().includes(fieldSearch.toLowerCase()))
                            );

                            return (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setIsFieldDropdownOpen(!isFieldDropdownOpen)}
                                  className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-orange-500 flex justify-between items-center text-right text-slate-900"
                                >
                                  <span className={`truncate ${currentFieldKey ? 'text-slate-900' : 'text-slate-400'}`}>
                                    {selectedField ? `${selectedField.label || selectedField.fieldKey} (${selectedField.fieldKey})` : (currentFieldKey || 'בחר שדה...')}
                                  </span>
                                  <ChevronDown size={16} className={`text-slate-400 transition-transform flex-shrink-0 ${isFieldDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isFieldDropdownOpen && (
                                  <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
                                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                                      <div className="relative">
                                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                          type="text"
                                          value={fieldSearch}
                                          onChange={(e) => setFieldSearch(e.target.value)}
                                          placeholder="חפש שדה..."
                                          autoFocus
                                          className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto scrollbar-thin p-1">
                                      {filteredFields.map(f => (
                                        <button
                                          key={f.id}
                                          type="button"
                                          onClick={() => {
                                            const currentOptions = (editingField.options as any) || {};
                                            setEditingField({
                                              ...editingField, 
                                              options: { ...currentOptions, sourceProperty: f.fieldKey }
                                            });
                                            setIsFieldDropdownOpen(false);
                                            setFieldSearch('');
                                          }}
                                          className={`w-full text-right px-3 py-2 rounded-lg text-sm flex items-center justify-between group transition-colors ${currentFieldKey === f.fieldKey ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                        >
                                          <div className="flex flex-col overflow-hidden">
                                            <span className="font-bold truncate">{f.label || f.fieldKey}</span>
                                            <span className="text-[10px] text-slate-400 font-mono truncate">{f.fieldKey}</span>
                                          </div>
                                          {currentFieldKey === f.fieldKey && <Check size={14} className="flex-shrink-0" />}
                                        </button>
                                      ))}
                                      {filteredFields.length === 0 && (
                                        <div className="p-4 text-center text-xs text-slate-400 font-bold">לא נמצאו שדות</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {[ { key: 'calculationFormula', label: 'נוסחת חישוב', desc: 'קביעת ערך השדה באופן אוטומטי', icon: <Calculator size={18} className="text-purple-500"/> }, { key: 'visibilityCondition', label: 'תנאי נראות', desc: 'מתי להציג את השדה למשתמש', icon: <Eye size={18} className="text-blue-500"/> }, { key: 'validationFormula', label: 'נוסחת אימות', desc: 'בדיקת תקינות הקלט', icon: <ShieldCheck size={18} className="text-green-500"/> } ].map(f => ( <div key={f.key} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4"> <div className="flex justify-between items-start"> <div className="flex gap-4"> <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400">{f.icon}</div> <div> <h4 className="font-black text-slate-800">{f.label}</h4> <p className="text-xs text-slate-500 font-bold">{f.desc}</p> </div> </div> <button onClick={() => setWizardConfig({ isOpen: true, targetField: f.key, currentFormula: (editingField as any)[f.key] || '', sidebarTab: 'functions', activeAssistantFunc: null, expandedTable: null, selectedDocKey: null, sandboxValues: {} })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-black text-[10px] hover:bg-blue-700 shadow-lg transition-all" > <Wand2 size={14} /> אשף הנוסחאות </button> </div> <textarea value={(editingField as any)[f.key] || ''} onChange={e => setEditingField({...editingField, [f.key]: e.target.value})} placeholder="כתוב נוסחה..." className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all font-mono text-sm min-h-[80px] text-left" dir="ltr" /> </div> ))} 
                </div> 
              )}
              {editTab === 'options' && (
                <div className="space-y-10 max-w-4xl">
                  {(editingField.fieldType === FieldType.ENUM || editingField.fieldType === FieldType.ENUM_LIST) ? (
                    <div className="space-y-6">
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-6">
                        <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
                          <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400"><List size={18} className="text-blue-500"/></div>
                          <div>
                            <h4 className="font-black text-slate-800">הגדרות רשימה (ENUM)</h4>
                            <p className="text-xs text-slate-500 font-bold">מקור נתונים ותצוגה</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">מקור נתונים (Data Source)</label>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  const currentOptions = (editingField.options as any) || {};
                                  setEditingField({
                                    ...editingField,
                                    options: { ...currentOptions, source: 'manual' }
                                  });
                                }}
                                className={`flex-1 py-3 rounded-xl border-2 font-black transition-all ${((editingField.options as any)?.source || 'manual') === 'manual' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                              >
                                הזנה ידנית
                              </button>
                              <button 
                                onClick={() => {
                                  const currentOptions = (editingField.options as any) || {};
                                  setEditingField({
                                    ...editingField,
                                    options: { ...currentOptions, source: 'table' }
                                  });
                                }}
                                className={`flex-1 py-3 rounded-xl border-2 font-black transition-all ${((editingField.options as any)?.source) === 'table' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                              >
                                טבלת Supabase
                              </button>
                            </div>
                          </div>

                          {((editingField.options as any)?.source || 'manual') === 'manual' && (
                            <div className="space-y-2 mt-4">
                              <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">פריטי רשימה</label>
                              <div className="space-y-2">
                                {((editingField.options as any)?.manualOptions || []).map((opt: string, idx: number) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <input 
                                      type="text" 
                                      value={opt}
                                      onChange={(e) => {
                                        const currentOptions = (editingField.options as any) || {};
                                        const newOpts = [...(currentOptions.manualOptions || [])];
                                        newOpts[idx] = e.target.value;
                                        setEditingField({ ...editingField, options: { ...currentOptions, manualOptions: newOpts } });
                                      }}
                                      className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
                                      placeholder={`פריט ${idx + 1}`}
                                    />
                                    <button 
                                      onClick={() => {
                                        const currentOptions = (editingField.options as any) || {};
                                        const newOpts = [...(currentOptions.manualOptions || [])];
                                        newOpts.splice(idx, 1);
                                        setEditingField({ ...editingField, options: { ...currentOptions, manualOptions: newOpts } });
                                      }}
                                      className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                ))}
                                <button 
                                  onClick={() => {
                                    const currentOptions = (editingField.options as any) || {};
                                    const newOpts = [...(currentOptions.manualOptions || []), ''];
                                    setEditingField({ ...editingField, options: { ...currentOptions, manualOptions: newOpts } });
                                  }}
                                  className="w-full p-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold hover:border-blue-300 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                                >
                                  <Plus size={16} /> הוסף פריט
                                </button>
                              </div>
                            </div>
                          )}

                          {((editingField.options as any)?.source) === 'table' && (
                            <div className="space-y-4 mt-4">
                              <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">טבלת מקור</label>
                                <select 
                                  value={(editingField.options as any)?.sourceTable || ''}
                                  onChange={(e) => {
                                    const currentOptions = (editingField.options as any) || {};
                                    setEditingField({ ...editingField, options: { ...currentOptions, sourceTable: e.target.value, sourceColumn: '' } });
                                  }}
                                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 appearance-none"
                                >
                                  <option value="">בחר טבלה...</option>
                                  {Object.keys(dynamicSchema).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                              {(editingField.options as any)?.sourceTable && (
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">עמודת תצוגה</label>
                                  <select 
                                    value={(editingField.options as any)?.sourceColumn || ''}
                                    onChange={(e) => {
                                      const currentOptions = (editingField.options as any) || {};
                                      setEditingField({ ...editingField, options: { ...currentOptions, sourceColumn: e.target.value } });
                                    }}
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 appearance-none"
                                  >
                                    <option value="">בחר עמודה...</option>
                                    {(dynamicSchema[(editingField.options as any)?.sourceTable] || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="space-y-2 mt-6">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">מצב תצוגה (Display Mode)</label>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  const currentOptions = (editingField.options as any) || {};
                                  setEditingField({
                                    ...editingField,
                                    options: { ...currentOptions, displayMode: 'dropdown' }
                                  });
                                }}
                                className={`flex-1 py-3 rounded-xl border-2 font-black transition-all ${((editingField.options as any)?.displayMode || 'dropdown') === 'dropdown' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                              >
                                רשימה נפתחת (Dropdown)
                              </button>
                              <button 
                                onClick={() => {
                                  const currentOptions = (editingField.options as any) || {};
                                  setEditingField({
                                    ...editingField,
                                    options: { ...currentOptions, displayMode: 'buttons' }
                                  });
                                }}
                                className={`flex-1 py-3 rounded-xl border-2 font-black transition-all ${((editingField.options as any)?.displayMode) === 'buttons' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                              >
                                כפתורים (Buttons)
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center text-slate-400 font-bold bg-slate-50 rounded-3xl border border-slate-100">
                      אין אפשרויות נוספות לסוג שדה זה.
                    </div>
                  )}
                </div>
              )}
              {editTab === 'preview' && ( <div className="max-w-4xl mx-auto border-4 border-dashed border-slate-100 rounded-[40px] p-12 bg-slate-50 shadow-inner relative"> <DynamicForm template={{...selectedTemplate!, fields: previewFields}} onCancel={() => {}} onSubmit={() => {}} contextData={previewContext} currentUser={user} draftId="preview_session" isPreview={true} /> </div> )}
            </div>
            <div className="p-4 md:p-8 border-t flex flex-col sm:flex-row justify-end gap-3 md:gap-4 bg-slate-50"> 
              <button onClick={() => setEditingField(null)} className="w-full sm:w-auto px-8 py-3 bg-white border rounded-2xl font-black text-slate-500 min-h-[44px]">ביטול</button> 
              <button 
                onClick={() => { 
                  if (!editingField) return;
                  // Use immutable map to preserve original array index/order
                  setLocalFields(prev => prev.map(f => f.id === editingField.id ? editingField : f));
                  setHasChanges(true); 
                  setEditingField(null); 
                }} 
                className="w-full sm:w-auto px-12 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl min-h-[44px]"
              > 
                עדכן שדה מקומית 
              </button> 
            </div>
          </div>
        </div>
      )}

      {isCreatingTemplate && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-4 backdrop-blur-md text-right" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-black text-slate-800 flex items-center gap-3 text-xl">
                <PlusCircle size={24} className="text-blue-600" /> יצירת תבנית חדשה
              </h2>
              <button onClick={() => setIsCreatingTemplate(false)} className="p-2 hover:bg-slate-200 rounded-full transition-all"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">שם התבנית</label>
                <input type="text" value={newTemplateData.name} onChange={e => setNewTemplateData({...newTemplateData, name: e.target.value})} placeholder="לדוגמה: ביקורת מטפים שנתית" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">מפתח פנימי (Form Key)</label>
                <input type="text" value={newTemplateData.formKey} onChange={e => setNewTemplateData({...newTemplateData, formKey: e.target.value})} placeholder="לדוגמה: ANNUAL_EXTINGUISHER" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-mono" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">תיאור</label>
                <textarea value={newTemplateData.description} onChange={e => setNewTemplateData({...newTemplateData, description: e.target.value})} placeholder="תיאור קצר של הטופס..." className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold min-h-[100px] resize-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">טבלת יעד (אופציונלי)</label>
                <select 
                  value={newTemplateData.tableName} 
                  onChange={e => setNewTemplateData({...newTemplateData, tableName: e.target.value})}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold appearance-none"
                >
                  <option value="">Default (inspections table)</option>
                  {availableTables.filter(t => t.id !== 'inspections').map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-8 bg-slate-50 border-t flex justify-end gap-4">
              <button onClick={() => setIsCreatingTemplate(false)} className="px-8 py-3 bg-white border rounded-2xl font-black text-slate-500">ביטול</button>
              <button 
                onClick={async () => {
                  if (!newTemplateData.name || !newTemplateData.formKey) return;
                  setLoading(true);
                  try {
                    const res = await dbService.createFormTemplate(newTemplateData);
                    await loadData(res.id);
                    setIsCreatingTemplate(false);
                    setNewTemplateData({ name: '', formKey: '', description: '', tableName: '' });
                  } catch (e) { alert('שגיאה ביצירת התבנית'); } finally { setLoading(false); }
                }} 
                className="px-12 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl"
              >
                צור תבנית
              </button>
            </div>
          </div>
        </div>
      )}

      {syncConfig?.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-4 backdrop-blur-md text-right" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col h-[80vh] animate-in zoom-in duration-300">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-black text-slate-800 flex items-center gap-3 text-xl">
                <ArrowRightLeft size={24} className="text-emerald-600" /> Mirror Sync
              </h2>
              <button onClick={() => setSyncConfig(null)} className="p-2 hover:bg-slate-200 rounded-full transition-all"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="space-y-4">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">בחר טבלת מקור לסנכרון</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.keys(dynamicSchema).map(tableName => (
                    <button 
                      key={tableName} 
                      onClick={async () => {
                        setSyncConfig({...syncConfig, selectedTable: tableName, isLoading: true});
                        const cols = await dbService.getTableColumns(tableName);
                        const existingKeys = localFields.map(f => f.fieldKey);
                        const missing = cols.filter(c => !existingKeys.includes(c.column_name));
                        setSyncConfig({...syncConfig, selectedTable: tableName, diff: missing, isLoading: false});
                      }}
                      className={`p-4 rounded-2xl border-2 transition-all text-right flex items-center justify-between ${syncConfig.selectedTable === tableName ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                      <span className="font-black text-sm">{tableName}</span>
                      {syncConfig.selectedTable === tableName && <CheckCircle2 size={18} />}
                    </button>
                  ))}
                </div>
              </div>

              {syncConfig.isLoading && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-4">
                  <Loader2 size={48} className="animate-spin text-blue-500" />
                  <span className="font-black animate-pulse">מנתח מבנה טבלה...</span>
                </div>
              )}

              {syncConfig.selectedTable && !syncConfig.isLoading && syncConfig.diff && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <h4 className="font-black text-slate-800 mb-2">נמצאו {syncConfig.diff.length} שדות חסרים בטופס</h4>
                    <p className="text-xs text-slate-500 font-bold italic">המערכת תייצר שדות חדשים עבור עמודות אלו באופן אוטומטי.</p>
                  </div>
                  <div className="space-y-2">
                    {syncConfig.diff.map((col: any) => (
                      <div key={col.column_name} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Plus size={14}/></div>
                          <div>
                            <div className="font-black text-sm text-slate-700">{col.column_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono uppercase">{col.data_type}</div>
                          </div>
                        </div>
                        <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">חדש</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-8 bg-slate-50 border-t flex justify-end gap-4">
              <button onClick={() => setSyncConfig(null)} className="px-8 py-3 bg-white border rounded-2xl font-black text-slate-500">ביטול</button>
              <button 
                disabled={!syncConfig.selectedTable || syncConfig.isLoading}
                onClick={() => handleMirrorSync(syncConfig.selectedTable!)}
                className={`px-12 py-3 bg-emerald-600 text-white rounded-2xl font-black shadow-xl transition-all ${(!syncConfig.selectedTable || syncConfig.isLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-700 active:scale-95'}`}
              >
                בצע סנכרון (Mirror)
              </button>
            </div>
          </div>
        </div>
      )}

      {templateToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-4 backdrop-blur-md text-right" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300">
            <div className="p-8 text-center space-y-4">
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800">מחיקת תבנית</h3>
              <p className="text-slate-500 font-bold">האם אתה בטוח שברצונך למחוק את התבנית <span className="text-red-600">"{templateToDelete.name}"</span>? פעולה זו תמחק גם את כל השדות המשויכים אליה ולא ניתן לבטלה.</p>
            </div>
            <div className="p-8 bg-slate-50 border-t flex gap-3">
              <button onClick={() => setTemplateToDelete(null)} className="flex-1 py-3 bg-white border rounded-2xl font-black text-slate-500">ביטול</button>
              <button 
                onClick={async () => {
                  setLoading(true);
                  try {
                    await dbService.deleteFormTemplate(templateToDelete.id);
                    if (selectedTemplateId === templateToDelete.id) setSelectedTemplateId(null);
                    await loadData();
                    setTemplateToDelete(null);
                  } catch (e) { alert('שגיאה במחיקה'); } finally { setLoading(false); }
                }} 
                className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-black shadow-xl shadow-red-100"
              >
                מחק לצמיתות
              </button>
            </div>
          </div>
        </div>
      )}

      {wizardConfig?.isOpen && (
        <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center z-[200] p-2 md:p-4 backdrop-blur-md text-right" dir="rtl">
          <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] w-full max-w-7xl h-[95vh] md:h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 md:p-8 bg-slate-50 border-b flex justify-between items-center"> <div className="flex items-center gap-3 md:gap-5"> <div className="p-3 md:p-4 bg-blue-600 text-white rounded-xl md:rounded-2xl shadow-lg shadow-blue-200"> <Wand2 size={24} className="w-5 h-5 md:w-6 md:h-6" /> </div> <div> <h2 className="text-lg md:text-2xl font-black text-slate-800">אשף הנוסחאות</h2> <p className="text-xs md:text-sm text-slate-500 font-bold">עריכת נוסחה</p> </div> </div> <button onClick={() => setWizardConfig(null)} className="p-2 md:p-3 hover:bg-white rounded-full transition-all border border-transparent hover:border-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center"><X size={24}/></button> </div>
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <div className="w-full md:w-[40%] border-b md:border-b-0 md:border-l flex flex-col bg-slate-50 border-slate-200 shrink-0 h-48 md:h-auto">
                <div className="flex p-2 bg-slate-200/50 m-2 md:m-4 rounded-2xl gap-1"> {[{ id: 'functions', label: 'פונקציות', icon: <Zap size={14}/> }, { id: 'fields', label: 'שדות', icon: <LayoutList size={14}/> }, { id: 'data', label: 'נתונים', icon: <Database size={14}/> }, { id: 'assistant', label: 'עוזר חכם', icon: <Sparkles size={14}/> }, { id: 'ai', label: 'עוזר AI', icon: <Wand2 size={14}/> }].map(tab => ( <button key={tab.id} onClick={() => setWizardConfig({...wizardConfig, sidebarTab: tab.id})} className={`flex-1 py-2 rounded-xl text-[10px] font-black flex flex-col md:flex-row items-center justify-center gap-1 transition-all ${wizardConfig.sidebarTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} > {tab.icon} <span className="hidden sm:inline">{tab.label}</span> </button> ))} </div>
                <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
                  {wizardConfig.sidebarTab === 'assistant' && ( <div className="space-y-4 h-full"> {wizardConfig.activeAssistantFunc ? ( <ParameterAssistant funcName={wizardConfig.activeAssistantFunc} fields={localFields} dynamicSchema={dynamicSchema} onCancel={() => setWizardConfig({...wizardConfig, activeAssistantFunc: null})} onApply={(formula) => setWizardConfig({...wizardConfig, currentFormula: wizardConfig.currentFormula + formula, activeAssistantFunc: null})} /> ) : ( <div className="space-y-4"> <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">בחר פונקציה לבנייה:</div> <div className="grid grid-cols-1 gap-2"> {Object.entries(DETAILED_DOCS).filter(([_,m])=>m.params).map(([name, meta]) => ( <button key={name} onClick={() => setWizardConfig({...wizardConfig, activeAssistantFunc: name})} className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-right hover:border-blue-500 transition-all group flex items-center justify-between" > <span className="font-black text-slate-700 group-hover:text-blue-600">{name}</span> <ChevronLeft size={16} className="text-slate-300"/> </button> ))} </div> </div> )} </div> )}
                  {wizardConfig.sidebarTab === 'docs' && ( <div className="space-y-4"> {Object.entries(DETAILED_DOCS).map(([key, info]) => ( <button key={key} onClick={() => setWizardConfig({...wizardConfig, selectedDocKey: key})} className={`w-full text-right p-4 rounded-2xl border transition-all ${wizardConfig.selectedDocKey === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700'}`} > <div className="font-black text-sm">{key}</div> {wizardConfig.selectedDocKey === key && ( <div className="mt-3 text-xs space-y-2 animate-in fade-in"> <p className="opacity-90">{info.desc}</p> <div className="bg-black/20 p-2 rounded-lg font-mono text-[10px] ltr text-left">{info.syntax}</div> <div className="flex flex-col gap-2 mt-2"><button onClick={(e) => { e.stopPropagation(); setWizardConfig({...wizardConfig, currentFormula: wizardConfig.currentFormula + key + "()"}); }} className="w-full py-2 bg-white text-blue-600 rounded-lg font-black" >הכנס נוסחה</button> {info.params && <button onClick={(e) => { e.stopPropagation(); setWizardConfig({...wizardConfig, sidebarTab: 'assistant', activeAssistantFunc: key}); }} className="w-full py-2 bg-blue-500 text-white rounded-lg font-black flex items-center justify-center gap-2"><Sparkles size={12}/> פתח עוזר חכם</button>} </div> </div> )} </button> ))} </div> )}
                  {wizardConfig.sidebarTab === 'data' && ( <div className="space-y-4"> <div className="relative px-2"> <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={14} /> <input type="text" placeholder="חפש טבלה..." value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] outline-none" /> </div> {Object.entries(dynamicSchema).map(([tableName, columns]) => ( <div key={tableName} className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-2 shadow-sm"> <button onClick={() => setWizardConfig({...wizardConfig, expandedTable: wizardConfig.expandedTable === tableName ? null : tableName})} className={`w-full p-4 flex items-center justify-between transition-all ${wizardConfig.expandedTable === tableName ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`} > <span className={`font-black text-xs uppercase ${wizardConfig.expandedTable === tableName ? 'text-blue-700' : 'text-slate-800'}`}>{tableName}</span> <ChevronDown size={14} className={`text-slate-400 transition-transform ${wizardConfig.expandedTable === tableName ? 'rotate-180 text-blue-500' : ''}`} /> </button> {wizardConfig.expandedTable === tableName && ( <div className="p-2 pt-0 space-y-1 bg-white"> {(columns as string[]).map(col => ( <button key={col} onClick={() => setWizardConfig({...wizardConfig, currentFormula: wizardConfig.currentFormula + `${tableName}[${col}] `})} className="w-full text-right p-2.5 text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" > {tableName}[{col}] </button> ))} </div> )} </div> ))} </div> )}
                  {wizardConfig.sidebarTab === 'functions' && ( <div className="space-y-6"> {FORMULA_FUNCTIONS.map(group => ( <div key={group.group}> <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3"> {group.icon} {group.group} </div> <div className="space-y-1"> {group.items.map(fn => ( <button key={fn} onClick={() => setWizardConfig({...wizardConfig, currentFormula: wizardConfig.currentFormula + fn + "()"}) } className="w-full text-right p-3 rounded-xl hover:bg-white hover:shadow-sm transition-all group" > <div className="text-xs font-black text-slate-700 group-hover:text-blue-600">{fn}</div> <div className="text-[10px] text-slate-400 font-bold">{DETAILED_DOCS[fn]?.desc || 'פונקציה במערכת'}</div> </button> ))} </div> </div> ))} </div> )}
                  {wizardConfig.sidebarTab === 'fields' && ( <div className="space-y-2"> {localFields.map(f => ( <button key={f.id} onClick={() => setWizardConfig({...wizardConfig, currentFormula: wizardConfig.currentFormula + `[${f.fieldKey}]`})} className="w-full text-right p-3 rounded-xl bg-white border border-slate-100 hover:border-blue-200 transition-all group" > <div className="text-xs font-black text-slate-700 group-hover:text-blue-600">{f.label}</div> <div className="text-[10px] text-blue-400 font-mono">{f.fieldKey}</div> </button> ))} </div> )}
                  {wizardConfig.sidebarTab === 'ai' && ( <div className="space-y-4 h-full flex flex-col"> <div className="flex-1 overflow-y-auto space-y-4"> <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 text-sm text-purple-800 font-bold"> תאר במילים שלך איזו נוסחה תרצה ליצור, והעוזר החכם יכתוב אותה עבורך. </div> {aiResponse && ( <div className="bg-slate-900 p-4 rounded-2xl text-emerald-400 font-mono text-sm break-all" dir="ltr"> {aiResponse} <button onClick={() => { setWizardConfig({...wizardConfig, currentFormula: aiResponse}); setAiResponse(''); }} className="mt-4 w-full py-2 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700"> החל נוסחה </button> </div> )} </div> <div className="flex gap-2"> <input type="text" value={aiQuery} onChange={e => setAiQuery(e.target.value)} placeholder="לדוגמה: סכום של שדה מחיר כפול כמות..." className="flex-1 p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-purple-500 text-sm font-bold" onKeyDown={e => e.key === 'Enter' && handleAskAi()} /> <button onClick={handleAskAi} disabled={isAiLoading} className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50"> {isAiLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />} </button> </div> </div> )}
                </div>
              </div>
              <div className="flex-1 p-4 md:p-10 space-y-4 md:space-y-8 flex flex-col bg-white overflow-hidden">
                <div className="flex-1 flex flex-col space-y-2 md:space-y-4 min-h-[200px]"> <div className="flex items-center justify-between px-2"> <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"> <Keyboard size={14} /> עורך נוסחאות חכם </label> </div> <div className="flex-1 relative group"> <FormulaHighlightEditor value={wizardConfig.currentFormula} onChange={(val) => setWizardConfig({...wizardConfig, currentFormula: val})} fields={localFields} dynamicSchema={dynamicSchema} /> </div> </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 items-start flex-shrink-0">
                  <div className="space-y-2 md:space-y-4"> <div className="flex items-center gap-2 px-1"> <Cpu size={14} className="text-orange-500" /> <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Live Sandbox</h4> </div> <div className="bg-slate-50 border border-slate-100 rounded-2xl md:rounded-3xl p-4 md:p-6 max-h-[120px] md:max-h-[160px] overflow-y-auto space-y-3 shadow-inner"> {detectedSandboxFields.length > 0 ? ( detectedSandboxFields.map(f => ( <div key={f.fieldKey} className="flex items-center justify-between gap-4"> <span className="text-[10px] font-bold text-slate-500 truncate max-w-[120px]">{f.label}</span> <input type="text" placeholder="ערך..." value={wizardConfig.sandboxValues[f.fieldKey] || ''} onChange={(e) => setWizardConfig({ ...wizardConfig, sandboxValues: { ...wizardConfig.sandboxValues, [f.fieldKey]: e.target.value } })} className="w-24 md:w-32 p-2 bg-white border border-slate-200 rounded-xl text-xs font-black outline-none focus:border-orange-400" /> </div> )) ) : ( <div className="text-center py-4 text-slate-400 text-xs font-bold italic flex flex-col items-center gap-2"> <Variable size={16} /> הגדר שדות [Field] להזנת ערכי בדיקה </div> )} </div> </div>
                  <div className="bg-slate-900 rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 text-white shadow-2xl relative overflow-hidden group border border-white/5 h-full"> <div className="relative z-10 space-y-2 md:space-y-4"> <div className="flex items-center justify-between"> <div className="flex items-center gap-3"> <div className="p-2 bg-white/10 rounded-xl"><Activity size={18} className="text-blue-400" /></div> <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">תוצאת חישוב</h4> </div> </div> <div className="space-y-2"> <textarea readOnly value={wizardResult.error || (wizardResult.val === null ? '' : String(wizardResult.val))} className={`w-full p-3 md:p-5 bg-black/40 border-2 rounded-xl md:rounded-2xl font-mono text-base md:text-xl outline-none resize-none h-16 md:h-24 transition-all duration-300 ${wizardResult.error ? 'border-red-500/30 text-red-400' : 'border-blue-500/30 text-emerald-400'}`} dir="ltr" /> </div> </div> </div>
                </div>
              </div>
            </div>
            <div className="p-4 md:p-8 bg-slate-50 border-t flex flex-col sm:flex-row justify-end gap-3 md:gap-4"> <button onClick={() => setWizardConfig(null)} className="w-full sm:w-auto px-8 py-3 bg-white border rounded-2xl font-black text-slate-500 min-h-[44px]">ביטול</button> <button onClick={() => { setEditingField({...editingField!, [wizardConfig.targetField]: wizardConfig.currentFormula}); setWizardConfig(null); }} className="w-full sm:w-auto px-12 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl min-h-[44px]" > שמור נוסחה </button> </div>
          </div>
        </div>
      )}
      {syncSuccess && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl z-[300] flex items-center gap-3 animate-in slide-in-from-bottom-4">
          <CheckCircle2 size={24} />
          <span className="font-black">סנכרון הושלם בהצלחה! השדות סודרו לפי סדר ה-DB.</span>
        </div>
      )}
    </div>
  );
};

export default FormBuilder;