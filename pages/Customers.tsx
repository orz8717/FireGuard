
import React from 'react';
import { Customer, User, UserRole } from '../types';
import { dbService } from '../services/dbService';
import { 
  Users, 
  UserPlus, 
  Search, 
  FileSpreadsheet, 
  Edit2, 
  Trash2, 
  Loader2, 
  X, 
  Check,
  Tag,
  ShieldAlert,
  Calendar,
  FileBadge,
  Mail,
  Fingerprint,
  MapPin,
  Building,
  Hash,
  CreditCard,
  Settings2,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface CustomersProps {
  user: User;
}

interface ColumnDef {
  key: string;
  label: string;
  type: 'core' | 'dynamic';
  icon: React.ReactNode;
  width: string;
  isOptional?: boolean;
  isFixed?: boolean;
}

// Fix: Moved FileCheck declaration here so it is defined before its usage in ORDERED_SCHEMA
const FileCheck = ({ size }: { size: number }) => <FileBadge size={size} />;

const ORDERED_SCHEMA: ColumnDef[] = [
  { key: 'ROW ID', label: 'ROW ID', type: 'dynamic', icon: <Hash size={14} />, width: '80px', isOptional: true },
  { key: 'customerNumber', label: 'מספר לקוח', type: 'core', icon: <CreditCard size={14} />, width: '110px', isOptional: true },
  { key: 'name', label: 'שם לקוח', type: 'core', icon: <Building size={14} />, width: '180px', isFixed: true },
  { key: 'address', label: 'כתובת', type: 'core', icon: <MapPin size={14} />, width: '180px', isFixed: true },
  { key: 'city', label: 'עיר', type: 'core', icon: <MapPin size={14} />, width: '120px', isFixed: true },
  { key: 'מכון תקנים', label: 'מכון תקנים', type: 'dynamic', icon: <Building size={14} />, width: '100px', isOptional: true },
  { key: 'מס תעודה', label: 'מס תעודה', type: 'dynamic', icon: <FileBadge size={14} />, width: '100px', isOptional: true },
  { key: 'תאריך בדיקה', label: 'תאריך בדיקה', type: 'dynamic', icon: <Calendar size={14} />, width: '110px', isOptional: true },
  { key: 'תעודה 12 שנה', label: 'תעודה 12 שנה', type: 'dynamic', icon: <FileCheck size={14} />, width: '110px', isOptional: true },
  { key: 'תאריך 12 שנה', label: 'תאריך 12 שנה', type: 'dynamic', icon: <Calendar size={14} />, width: '110px', isOptional: true },
  { key: 'FirstName', label: 'FirstName', type: 'dynamic', icon: <Tag size={14} />, width: '100px', isOptional: true },
  { key: 'contactEmail', label: 'Email', type: 'core', icon: <Mail size={14} />, width: '150px', isOptional: true },
  { key: 'ח.פ', label: 'ח.פ', type: 'dynamic', icon: <Fingerprint size={14} />, width: '110px', isOptional: true },
  { key: 'רמת סיכון', label: 'רמת סיכון', type: 'dynamic', icon: <ShieldAlert size={14} />, width: '100px', isOptional: true }
];

const Customers: React.FC<CustomersProps> = ({ user }) => {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isEditing, setIsEditing] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  const [currentCustomer, setCurrentCustomer] = React.useState<Partial<Customer>>({});
  const [formState, setFormState] = React.useState<Record<string, string>>({});
  const [customFields, setCustomFields] = React.useState<Record<string, string>>({});
  const [newFieldName, setNewFieldName] = React.useState('');
  const [deleteConfirm, setDeleteConfirm] = React.useState<Customer | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  
  const [visibleColumns, setVisibleColumns] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    ORDERED_SCHEMA.forEach(col => {
      initial[col.key] = true;
    });
    return initial;
  });
  const [showColumnPicker, setShowColumnPicker] = React.useState(false);

  const isAdmin = user.role === UserRole.ADMIN;
  const canCreate = user.role === UserRole.ADMIN || user.role === UserRole.OFFICE;

  React.useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await dbService.getCustomers();
      setCustomers(data);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const getParsedNotes = (notes?: string): Record<string, any> => {
    if (!notes) return {};
    try {
      const parsed = JSON.parse(notes);
      return typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportProgress(0);
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as any[];

        const mappedCustomers: Partial<Customer>[] = data.map(row => {
          const getVal = (search: string) => {
            const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === search.trim().toLowerCase());
            return foundKey ? String(row[foundKey]).trim() : "";
          };

          const dynamicData: Record<string, any> = {};
          ORDERED_SCHEMA.filter(s => s.type === 'dynamic').forEach(s => {
            if (s.key !== 'ROW ID') {
              dynamicData[s.key] = getVal(s.label);
            }
          });

          return {
            name: getVal('שם לקוח') || "לקוח ללא שם",
            customerNumber: getVal('מספר לקוח'),
            address: getVal('כתובת'),
            city: getVal('עיר') || getVal('עיר '),
            contactEmail: getVal('Email'),
            notes: JSON.stringify(dynamicData)
          };
        }).filter(c => c.name);

        for (let i = 0; i < mappedCustomers.length; i += 25) {
          const chunk = mappedCustomers.slice(i, i + 25);
          setImportProgress(Math.round((i / mappedCustomers.length) * 100));
          await dbService.addCustomersBatch(chunk);
        }
        
        await loadCustomers();
      } catch (err) {
        alert('שגיאה בייבוא הקובץ');
      } finally {
        setImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleEdit = (customer: Customer) => {
    setCurrentCustomer(customer);
    const notes = getParsedNotes(customer.notes);
    const initialForm: Record<string, string> = {};
    const initialCustom: Record<string, string> = {};
    
    ORDERED_SCHEMA.forEach(field => {
      if (field.type === 'core') {
        initialForm[field.key] = (customer as any)[field.key] || '';
      } else {
        initialForm[field.key] = notes[field.key] || '';
      }
    });

    // Capture any other fields in notes that are not in the schema
    Object.keys(notes).forEach(key => {
      if (!ORDERED_SCHEMA.find(s => s.key === key)) {
        initialCustom[key] = String(notes[key]);
      }
    });
    
    setFormState(initialForm);
    setCustomFields(initialCustom);
    setIsEditing(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const coreData: any = {};
      const dynamicData: Record<string, string> = { ...customFields };
      
      ORDERED_SCHEMA.forEach(field => {
        if (field.type === 'core') {
          coreData[field.key] = formState[field.key];
        } else {
          if (field.key !== 'ROW ID') {
            dynamicData[field.key] = formState[field.key];
          }
        }
      });

      const payload = { 
        ...coreData, 
        notes: JSON.stringify(dynamicData) 
      };

      if (currentCustomer.id) {
        await dbService.updateCustomer(currentCustomer.id, payload);
      } else {
        await dbService.addCustomer(payload);
      }
      setIsEditing(false);
      setCustomFields({});
      await loadCustomers();
    } catch (err) {
      alert('שגיאה בשמירה');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.customerNumber && c.customerNumber.includes(searchTerm))
  );

  return (
    <div className="space-y-4 h-full flex flex-col" dir="rtl">
      {/* Search and Action Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-4 rounded-2xl border shadow-sm gap-3">
        <div className="relative w-full lg:w-96">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="חיפוש לפי שם או מספר..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-3 lg:py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm transition-all min-h-[44px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button 
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 p-3 lg:p-2.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-100 hover:bg-slate-100 font-bold text-xs min-h-[44px]"
          >
            <Settings2 size={16} />
            עמודות
          </button>

          <button onClick={loadCustomers} className="p-3 lg:p-2.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-100 hover:bg-slate-100 min-h-[44px] flex items-center justify-center">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {canCreate && (
            <>
              <input type="file" id="excel-import" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleImportExcel} disabled={importing} />
              <label htmlFor="excel-import" className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-3 lg:py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs cursor-pointer hover:bg-emerald-700 shadow-lg shadow-emerald-100 min-h-[44px]">
                {importing ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                ייבוא
              </label>
              <button onClick={() => { setCurrentCustomer({}); setFormState({}); setIsEditing(true); }} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-3 lg:py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 shadow-lg shadow-blue-100 min-h-[44px]">
                <UserPlus size={16} />
                חדש
              </button>
            </>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:flex flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex-col min-h-0">
        <div className="overflow-auto relative h-full">
          {loading ? (
             <div className="flex flex-col items-center justify-center h-64 text-blue-600">
               <Loader2 className="animate-spin mb-4" size={40} />
               <p className="font-bold text-sm">טוען לקוחות...</p>
             </div>
          ) : (
            <table className="w-full text-right border-collapse table-fixed min-w-[1200px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-800 text-white">
                  {ORDERED_SCHEMA.map((col, index) => {
                    if (!visibleColumns[col.key]) return null;
                    return (
                      <th key={col.key} style={{ width: col.width }} className="p-3 font-bold text-[11px] uppercase border-l border-white/5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400">{col.icon}</span>
                          {col.label}
                        </div>
                      </th>
                    );
                  })}
                  {isAdmin && <th className="p-3 font-bold text-[11px] text-center sticky left-0 z-10 bg-slate-800 w-[80px]">פעולות</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {filteredCustomers.map(customer => {
                  const notes = getParsedNotes(customer.notes);
                  return (
                    <tr key={customer.id} className="hover:bg-blue-50/30 transition-colors group">
                      {ORDERED_SCHEMA.map(col => {
                        if (!visibleColumns[col.key]) return null;
                        let value = col.type === 'core' ? (customer as any)[col.key] : notes[col.key];
                        return (
                          <td key={col.key} className="p-3 border-l border-slate-50 font-bold text-slate-600 truncate">
                            {value || <span className="text-slate-300">---</span>}
                          </td>
                        );
                      })}
                      {isAdmin && (
                        <td className="p-3 sticky left-0 z-10 bg-white group-hover:bg-blue-50/30 transition-colors border-r">
                          <div className="flex justify-center gap-1">
                            <button onClick={() => handleEdit(customer)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"><Edit2 size={16} /></button>
                            <button onClick={() => setDeleteConfirm(customer)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-blue-600">
            <Loader2 className="animate-spin mb-4" size={40} />
            <p className="font-bold text-sm">טוען לקוחות...</p>
          </div>
        ) : (
          filteredCustomers.map(customer => {
            const notes = getParsedNotes(customer.notes);
            return (
              <div key={customer.id} className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{customer.name || "לקוח ללא שם"}</h3>
                    <p className="text-gray-600 text-sm font-mono">{customer.customerNumber || "---"}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(customer)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"><Edit2 size={16} /></button>
                      <button onClick={() => setDeleteConfirm(customer)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-sm">
                  {ORDERED_SCHEMA.filter(col => col.key !== 'name' && col.key !== 'customerNumber' && visibleColumns[col.key]).slice(0, 4).map(col => {
                    let value = col.type === 'core' ? (customer as any)[col.key] : notes[col.key];
                    if (!value) return null;
                    return (
                      <div key={col.key} className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">{col.label}</span>
                        <span className="font-medium text-slate-700 truncate">{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {/* Modals remain mostly the same but ensure they are scrollable on mobile */}
      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-800">פרטי לקוח</h2>
              <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <form onSubmit={handleSaveCustomer} className="space-y-8">
                {/* Core Fields Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Building size={18} className="text-blue-600" />
                    <h3 className="font-bold text-slate-800">פרטי ליבה</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ORDERED_SCHEMA.filter(f => f.type === 'core').map(field => (
                      <div key={field.key} className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-1">{field.label}</label>
                        <input 
                          type="text" 
                          value={formState[field.key] || ''} 
                          onChange={(e) => setFormState({...formState, [field.key]: e.target.value})}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none font-bold text-sm transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dynamic Fields Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Settings2 size={18} className="text-emerald-600" />
                    <h3 className="font-bold text-slate-800">נתונים דינמיים</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ORDERED_SCHEMA.filter(f => f.type === 'dynamic' && f.key !== 'ROW ID').map(field => (
                      <div key={field.key} className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-1">{field.label}</label>
                        <input 
                          type="text" 
                          value={formState[field.key] || ''} 
                          onChange={(e) => setFormState({...formState, [field.key]: e.target.value})}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none font-bold text-sm transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Fields Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <Tag size={18} className="text-purple-600" />
                      <h3 className="font-bold text-slate-800">שדות מותאמים אישית</h3>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(customFields).map(key => (
                      <div key={key} className="space-y-1 relative group">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-1">{key}</label>
                        <div className="relative">
                          <input 
                            type="text" 
                            value={customFields[key] || ''} 
                            onChange={(e) => setCustomFields({...customFields, [key]: e.target.value})}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none font-bold text-sm transition-all"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              const next = { ...customFields };
                              delete next[key];
                              setCustomFields(next);
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <input 
                      type="text" 
                      placeholder="שם שדה חדש..."
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      className="flex-1 p-2 bg-slate-50 border border-dashed border-slate-300 rounded-lg outline-none text-xs font-bold"
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        if (newFieldName.trim()) {
                          setCustomFields({ ...customFields, [newFieldName.trim()]: '' });
                          setNewFieldName('');
                        }
                      }}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                    >
                      הוסף שדה
                    </button>
                  </div>
                </div>

                <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
                  <button type="button" onClick={() => { setIsEditing(false); setCustomFields({}); setNewFieldName(''); }} className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-700 transition-colors">ביטול</button>
                  <button type="submit" disabled={actionLoading} className="px-10 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50">
                    {actionLoading ? <Loader2 className="animate-spin"/> : 'שמור שינויים'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
