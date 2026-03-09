import React from 'react';
import { FormTemplate, FieldType, FormField, User } from '../types';
import { supabase, supabaseAdmin } from '../services/supabaseClient';
import { useDraftManager } from '../hooks/useDraftManager';
import { 
  Calculator, 
  AlertCircle, 
  Search, 
  X, 
  ChevronDown, 
  Check, 
  Phone, 
  Mail, 
  Hash, 
  Percent, 
  DollarSign, 
  CheckCircle2,
  ArrowRightLeft,
  Loader2,
  Clock,
  Zap,
  Fingerprint,
  CreditCard,
  Building,
  QrCode,
  ClipboardList
} from 'lucide-react';

interface DynamicFormProps {
  template: FormTemplate;
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void;
  onCancel: () => void;
  onSwitchDraft?: (draftId: string) => void;
  onAction?: (actionType: string, payload?: any) => void;
  readOnly?: boolean;
  contextData?: Record<string, any[]>;
  currentUser?: User | null;
  draftId: string; 
  editingInspectionId?: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\+\-\s\(\)]{7,20}$/;

const EnumSelector: React.FC<{
  field: FormField;
  value: any;
  onChange: (val: any) => void;
  readOnly?: boolean;
  isMulti?: boolean;
  commonClasses: string;
  openDropdown: string | null;
  setOpenDropdown: (val: string | null) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  selectSearch: Record<string, string>;
  setSelectSearch: (val: Record<string, string>) => void;
}> = ({ field, value, onChange, readOnly, isMulti, commonClasses, openDropdown, setOpenDropdown, dropdownRef, selectSearch, setSelectSearch }) => {
  const [options, setOptions] = React.useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadOptions = async () => {
      const fieldOpts = field.options as any;
      if (!fieldOpts) {
        setOptions([]);
        return;
      }

      // Handle new configuration format
      const source = fieldOpts.source || 'manual';

      if (source === 'table' && fieldOpts.sourceTable && fieldOpts.sourceColumn) {
        setLoading(true);
        setError(null);
        try {
          let actualColumn = fieldOpts.sourceColumn;
          
          // 1. Handle naming mismatches (Case sensitivity, spaces vs underscores, missing spaces)
          try {
            const normalize = (s: string) => s.toLowerCase().replace(/[\s_]/g, '');
            const targetNorm = normalize(fieldOpts.sourceColumn);

            // Try RPC first (more reliable for schema)
            const { data: cols } = await supabaseAdmin.rpc('get_table_columns', { p_table_name: fieldOpts.sourceTable });
            
            if (cols && cols.length > 0) {
              // Prefer exact match, then normalized match
              const match = cols.find((c: any) => c.column_name === fieldOpts.sourceColumn) || 
                            cols.find((c: any) => normalize(c.column_name) === targetNorm);
              if (match) actualColumn = match.column_name;
            } else {
              // Fallback to sample row
              const { data: sample } = await supabaseAdmin.from(fieldOpts.sourceTable).select('*').limit(1);
              if (sample && sample.length > 0) {
                const keys = Object.keys(sample[0]);
                const match = keys.find(k => k === fieldOpts.sourceColumn) || 
                              keys.find(k => normalize(k) === targetNorm);
                if (match) actualColumn = match;
              }
            }
          } catch (err) {
            console.warn("[EnumSelector] Pre-flight check failed:", err);
          }

          let allData: any[] = [];
          let from = 0;
          const step = 1000;
          let finished = false;

          while (!finished) {
            // Use double quotes to handle spaces and special characters in column names
            const { data, error: fetchError } = await supabaseAdmin
              .from(fieldOpts.sourceTable)
              .select(`"${actualColumn.replace(/"/g, '""')}"`)
              .range(from, from + step - 1);
              
            if (fetchError) throw fetchError;
            if (data && data.length > 0) {
              allData = [...allData, ...data];
              if (data.length < step) finished = true;
              else from += step;
            } else {
              finished = true;
            }
          }
          
          const unique = Array.from(new Set(allData.map(r => r[actualColumn])))
            .filter(v => v !== null && v !== undefined && v !== '')
            .map(v => ({ value: String(v), label: String(v) }))
            .sort((a, b) => a.label.localeCompare(b.label, 'he'));
            
          setOptions(unique);
        } catch (e: any) {
          console.error("Error fetching options:", e);
          setError(`Error fetching from ${fieldOpts.sourceTable}: ${e.message || 'Unknown error'}`);
          setOptions([]);
        } finally {
          setLoading(false);
        }
      } else if (source === 'manual' && fieldOpts.manualOptions) {
        setOptions(fieldOpts.manualOptions.filter((o: string) => o && o.trim()).map((o: string) => ({ value: o, label: o })));
      } else if (Array.isArray(fieldOpts)) {
        // Fallback for older format where options is just an array
        setOptions(fieldOpts.map((o: any) => typeof o === 'string' ? { value: o, label: o } : o));
      } else {
        setOptions([]);
      }
    };
    loadOptions();
  }, [field.options]);

  const selectedValues = isMulti ? (Array.isArray(value) ? value : []) : (value ? [value] : []);
  const displayMode = (field.options as any)?.displayMode || field.displayMode || 'dropdown';

  if (displayMode === 'buttons') {
    return (
      <div className="flex flex-col gap-2 p-1">
        {loading && <div className="text-xs text-slate-400 flex items-center gap-2"><Loader2 size={12} className="animate-spin"/> טוען נתונים...</div>}
        {error && <div className="text-xs text-red-500 font-bold">{error}</div>}
        <div className="flex flex-wrap gap-2">
          {options.map(opt => {
            const isSelected = selectedValues ? selectedValues.includes(opt.value) : false;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={readOnly}
                onClick={() => {
                  if (isMulti) {
                    onChange(isSelected ? selectedValues.filter(v => v !== opt.value) : [...selectedValues, opt.value]);
                  } else {
                    onChange(isSelected ? '' : opt.value);
                  }
                }}
                className={`px-4 py-2 rounded-xl border-2 font-bold text-sm transition-all ${
                  isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                } disabled:opacity-50`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={openDropdown === field.fieldKey ? dropdownRef : null}>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => setOpenDropdown(openDropdown === field.fieldKey ? null : field.fieldKey)}
        className={`${commonClasses} flex justify-between items-center text-right min-h-[52px] gap-2`}
      >
        <span className="truncate">
          {isMulti ? (
            selectedValues.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedValues.map(v => (
                  <span key={v} className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded-lg font-black flex items-center gap-1">
                    {options.find(o => o.value === v)?.label || v}
                    {!readOnly && <X size={10} className="cursor-pointer hover:scale-110" onClick={(e) => { e.stopPropagation(); onChange(selectedValues.filter(sv => sv !== v)); }} />}
                  </span>
                ))}
              </div>
            ) : <span className="text-slate-400">בחר...</span>
          ) : (
            options.find(o => o.value === value)?.label || value || <span className="text-slate-400">בחר...</span>
          )}
        </span>
        <ChevronDown size={18} className={`transition-transform duration-200 ${openDropdown === field.fieldKey ? 'rotate-180' : ''}`} />
      </button>
      
      {openDropdown === field.fieldKey && !readOnly && (
        <div className="absolute top-full left-0 right-0 z-[150] mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-3 border-b bg-slate-50 flex gap-2">
            <Search size={16} className="text-slate-400 mt-2" />
            <input
              type="text"
              placeholder="חיפוש מהיר..."
              autoFocus
              value={selectSearch[field.fieldKey] || ''}
              onChange={(e) => setSelectSearch({ ...selectSearch, [field.fieldKey]: e.target.value })}
              className="w-full bg-transparent outline-none text-sm font-bold"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1 scrollbar-thin">
            {loading && <div className="p-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin"/> טוען...</div>}
            {error && <div className="p-4 text-center text-red-500 text-xs font-bold">{error}</div>}
            {!loading && !error && options.filter(opt => !selectSearch[field.fieldKey] || (opt.label && opt.label.includes(selectSearch[field.fieldKey]))).map(opt => {
              const isSelected = selectedValues ? selectedValues.includes(opt.value) : false;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (isMulti) {
                      onChange(isSelected ? selectedValues.filter(v => v !== opt.value) : [...selectedValues, opt.value]);
                    } else {
                      onChange(opt.value);
                      setOpenDropdown(null);
                    }
                  }}
                  className={`w-full text-right px-4 py-3 rounded-xl hover:bg-blue-50 font-bold text-sm flex items-center justify-between transition-colors ${isSelected ? 'text-blue-600 bg-blue-50' : 'text-slate-600'}`}
                >
                  {opt.label}
                  {isSelected && <Check size={16} className="animate-in zoom-in" />}
                </button>
              );
            })}
            {!loading && !error && options.length === 0 && <div className="p-4 text-center text-slate-400 text-xs">אין אפשרויות להצגה</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const SignaturePad: React.FC<{ 
  value: string; 
  onChange: (val: string) => void; 
  readOnly?: boolean 
}> = ({ value, onChange, readOnly }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000';
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readOnly || !canvasRef.current) return;
    if (e.cancelable) e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) {
      onChange(canvasRef.current.toDataURL());
    }
  };

  const clearCanvas = () => {
    if (readOnly || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      onChange('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-slate-200 rounded-2xl bg-white overflow-hidden h-44 touch-none shadow-inner">
        {value && readOnly ? (
          <img src={value} alt="Signature" className="w-full h-full object-contain" />
        ) : (
          <canvas
            ref={canvasRef}
            width={600}
            height={176}
            className="w-full h-full cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={endDrawing}
            onMouseLeave={endDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={endDrawing}
          />
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={clearCanvas}
            className="absolute top-2 left-2 px-3 py-1 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg text-[10px] font-black transition-all shadow-sm border border-slate-200"
          >
            מחק
          </button>
        )}
      </div>
      {value && !readOnly && <div className="text-[10px] text-emerald-600 font-black px-2 flex items-center gap-1 animate-in zoom-in"><CheckCircle2 size={12}/> חתימה שמורה</div>}
    </div>
  );
};

const DynamicForm: React.FC<DynamicFormProps> = ({ 
  template, 
  initialValues = {}, 
  onSubmit, 
  onCancel, 
  onSwitchDraft,
  onAction,
  readOnly = false,
  contextData = {},
  currentUser = null,
  draftId,
  editingInspectionId = null
}) => {
  // Use a ref for dependencies to avoid excessive updates in formula engine
  const fieldsRef = React.useRef(template.fields);
  React.useEffect(() => { fieldsRef.current = template.fields; }, [template.fields]);

  const [formData, setFormData] = React.useState<Record<string, any>>(() => {
    const base = { ...initialValues };
    template.fields.forEach(f => {
      if (base[f.fieldKey] === undefined) {
        if (f.fieldType === FieldType.ENUM_LIST || f.fieldType === FieldType.MULTI_SELECT) {
          base[f.fieldKey] = [];
        } else {
          base[f.fieldKey] = '';
        }
      }
    });
    return base;
  });

  // Ref to access latest formData in runCalculations without triggering re-creation
  const formDataRef = React.useRef(formData);
  React.useEffect(() => { formDataRef.current = formData; }, [formData]);

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [visibleFields, setVisibleFields] = React.useState<Record<string, boolean>>({});
  const [calculatingFields, setCalculatingFields] = React.useState<Set<string>>(new Set());
  const [selectSearch, setSelectSearch] = React.useState<Record<string, string>>({});
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const {
    hasDraft,
    draftData,
    isChecking,
    isSaving,
    saveDraft,
    deleteDraft,
    updateCurrentData,
    setHasDraft
  } = useDraftManager(currentUser?.id || '', template.id);

  const [showDraftPrompt, setShowDraftPrompt] = React.useState(false);

  React.useEffect(() => {
    if (hasDraft && !draftId && !editingInspectionId) {
      setShowDraftPrompt(true);
    }
  }, [hasDraft, draftId, editingInspectionId]);

  React.useEffect(() => {
    const customer = contextData?.['Customers']?.find((c: any) => c.id === formData.customerId);
    updateCurrentData({
      ...formData,
      templateName: template.name,
      customerName: customer?.name || 'לקוח טרם נבחר',
      editingInspectionId: editingInspectionId
    });
  }, [formData, updateCurrentData, template.name, contextData, editingInspectionId]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- REFERENCE SYSTEM (Parent -> Child) ---
  const [parentRecord, setParentRecord] = React.useState<Record<string, any> | null>(null);
  const [loadingParent, setLoadingParent] = React.useState(false);
  const [childRecords, setChildRecords] = React.useState<any[]>([]);
  const [localSummary, setLocalSummary] = React.useState<any[]>([]);
  const [loadingChildren, setLoadingChildren] = React.useState(false);

  const fetchChildRecords = async (rowId: string) => {
    if (!rowId) return;
    setLoadingChildren(true);
    try {
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .filter('data->>ROWID', 'eq', rowId)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setChildRecords(data);
      }
    } catch (err) {
      console.error("Error fetching child records:", err);
    } finally {
      setLoadingChildren(false);
    }
  };

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlParentId = urlParams.get('parentRowId');
    const pendingId = localStorage.getItem('pendingParentRowId');
    const formId = formData['ROWID'] || formData['inspectionSerialNumber'];
    
    const rowId = formId || urlParentId || pendingId;
    
    if (rowId) {
      fetchChildRecords(rowId);
      const saved = localStorage.getItem(`summary_${rowId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setLocalSummary(parsed);
          }
        } catch (e) {
          setLocalSummary([]);
        }
      }
    }
  }, [formData['ROWID'], formData['inspectionSerialNumber']]);

  React.useEffect(() => {
    const initParentData = async () => {
      // 1. Try URL first
      let searchParams = new URLSearchParams(window.location.search);
      if (!searchParams.has('parentRowId') && window.location.hash && window.location.hash.includes('?')) {
         const hashQuery = window.location.hash.split('?')[1];
         searchParams = new URLSearchParams(hashQuery);
      }
      
      let parentRowId = searchParams.get('parentRowId');
      
      // 2. Try LocalStorage if URL is empty
      if (!parentRowId) {
        parentRowId = localStorage.getItem('pendingParentRowId');
      }

      // NEW: Load full parent data if available
      const savedParentDataJSON = localStorage.getItem('parentFormData');
      if (savedParentDataJSON) {
          try {
              const savedParentData = JSON.parse(savedParentDataJSON);
              setParentRecord(savedParentData);
              
              // If we have the data, we can also try to extract the ID if missing
              if (!parentRowId) {
                  parentRowId = savedParentData.id || savedParentData.ROWID || savedParentData.inspectionSerialNumber;
              }
          } catch (e) {
          }
      }
      
      if (parentRowId) {
        setLoadingParent(true);
        
        // 1. Auto-fill ROWID if it exists in the form
        const refField = template.fields.find(f => f.fieldKey === 'ROWID');
        if (refField) {
          setFormData(prev => {
            if (prev['ROWID'] !== parentRowId) {
              return { ...prev, ROWID: parentRowId };
            }
            return prev;
          });
        }

        // 2. Fetch the full Parent Record from Supabase
        try {
          // Try fetching by ROWID (friendly ID) first
          let { data, error } = await supabase
            .from('inspections')
            .select('data')
            .filter('data->>ROWID', 'eq', parentRowId)
            .maybeSingle();

          // If not found, and it looks like a UUID, try fetching by ID
          if (!data && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parentRowId)) {
             const res = await supabase
                .from('inspections')
                .select('data')
                .eq('id', parentRowId)
                .maybeSingle();
             data = res.data;
             error = res.error;
          }
            
          if (data && data.data) {
            setParentRecord(data.data);
          } else {
          }
        } catch (err) {
        } finally {
          setLoadingParent(false);
        }
      } else {
      }
    };
    
    initParentData();
  }, []); // Run once on mount

  // --- LOOKUP LOGIC (Pull from Reference) ---
  const prevRefValuesRef = React.useRef<Record<string, any>>({});
  const isMountedRef = React.useRef(false);

  React.useEffect(() => {
    if (readOnly) return;

    const updates: Record<string, any> = {};
    let hasUpdates = false;

    fieldsRef.current.forEach(field => {
      const options = field.options as any;
      if (options?.pullFromRef && options.linkedRefField && options.sourceProperty) {
        const refKey = options.linkedRefField;
        const refValue = formData[refKey];
        const prevRefValue = prevRefValuesRef.current[refKey];
        const currentFieldValue = formData[field.fieldKey];

        // Determine if we should update
        const refChanged = String(refValue || '') !== String(prevRefValue || '');
        const isInitialLoad = !isMountedRef.current;
        
        // Check if refKey is a Template ID (basic check: length > 20 and no spaces, or just not a known field)
        // If refKey is NOT a field in the current form, we assume it's a Template ID pointing to the Parent.
        const isLocalField = fieldsRef.current.some(f => f.fieldKey === refKey);
        const isTemplateRef = !isLocalField && refKey.length > 10; // Simple heuristic for UUID

        let shouldUpdate = false;
        if (refChanged && refValue) {
            if (isInitialLoad) {
                // On initial load, only fill if currently empty
                if (!currentFieldValue) shouldUpdate = true;
            } else {
                // On user change, always overwrite
                shouldUpdate = true;
            }
        }

        // Special case: If parent record just loaded, we might need to update even if ref didn't change
        // This applies to ROWID OR if the linkedRefField is actually a Template ID (which means "Use Parent")
        if ((refKey === 'ROWID' || isTemplateRef) && parentRecord && !currentFieldValue) {
           shouldUpdate = true;
        }

        if (shouldUpdate) {
          // Find the linked field definition to know the table
          const refFieldDef = fieldsRef.current.find(f => f.fieldKey === refKey);
          let targetTable = '';
          let targetColumn = 'id'; // Default lookup column

          if (refKey === 'customerId') {
            targetTable = 'Customers';
          } else if (refKey === 'technicianId') {
            targetTable = 'Users';
          } else if (refKey === 'ROWID') {
             // Handled separately via parentRecord
          } else if (refFieldDef?.supabaseConfig?.tableName) {
            targetTable = refFieldDef.supabaseConfig.tableName;
            targetColumn = refFieldDef.supabaseConfig.columnName || 'id';
          }

          if ((refKey === 'ROWID' || isTemplateRef) && parentRecord) {
             const newValue = parentRecord[options.sourceProperty];
             if (newValue !== undefined && newValue !== null) {
               // Only inject if the field is currently empty AND the value is different to avoid loops
               const currentVal = formData[field.fieldKey];
               const isEmpty = currentVal === '' || currentVal === null || currentVal === undefined;
               if (isEmpty && currentVal !== newValue) {
                 updates[field.fieldKey] = newValue;
                 hasUpdates = true;
               }
             }
          } else if (targetTable && contextData[targetTable]) {
             const tableData = contextData[targetTable];
             // Find record where targetColumn matches refValue
             const record = tableData.find((r: any) => String(r[targetColumn] || '') === String(refValue));
             
             if (record) {
               const newValue = record[options.sourceProperty];
               if (newValue !== undefined && newValue !== null) {
                 const currentVal = formData[field.fieldKey];
                 const isEmpty = currentVal === '' || currentVal === null || currentVal === undefined;
                 if (isEmpty && currentVal !== newValue) {
                   updates[field.fieldKey] = newValue;
                   hasUpdates = true;
                 }
               }
             }
          }
        }
      }
    });

    if (hasUpdates) {
      setFormData(prev => ({ ...prev, ...updates }));
    }

    // Update refs
    fieldsRef.current.forEach(field => {
       const options = field.options as any;
       if (options?.pullFromRef && options.linkedRefField) {
         prevRefValuesRef.current[options.linkedRefField] = formData[options.linkedRefField];
       }
    });
    
    isMountedRef.current = true;

  }, [formData, contextData, readOnly, parentRecord]);

  // --- FORMULA ENGINE ---

  const formulaFunctions = React.useMemo(() => {
    const funcs: any = {
      // Logical
      AND: (...args: any[]) => args.every(Boolean),
      OR: (...args: any[]) => args.some(Boolean),
      NOT: (val: any) => !val,
      IF: (cond: any, t: any, f: any) => (!!cond ? t : f),
      IFS: (...args: any[]) => {
        for (let i = 0; i < args.length; i += 2) {
          if (args[i]) return args[i+1];
        }
        return null;
      },
      SWITCH: (val: any, ...args: any[]) => {
        for (let i = 0; i < args.length - 1; i += 2) {
          if (val === args[i]) return args[i+1];
        }
        return args.length % 2 !== 0 ? args[args.length - 1] : null;
      },
      ISBLANK: (val: any) => val === undefined || val === null || String(val).trim() === '' || (Array.isArray(val) && val.length === 0),
      ISNOTBLANK: (val: any) => !(val === undefined || val === null || String(val).trim() === '' || (Array.isArray(val) && val.length === 0)),
      TRUE: true,
      FALSE: false,
      
      // Math (Strict Type-Safe)
      ABS: (n: any) => Math.abs(Number(n) || 0),
      CEILING: (n: any) => Math.ceil(Number(n) || 0),
      FLOOR: (n: any) => Math.floor(Number(n) || 0),
      ROUND: (n: any) => Math.round(Number(n) || 0),
      MOD: (a: any, b: any) => (Number(a) || 0) % (Number(b) || 1),
      POWER: (a: any, b: any) => Math.pow(Number(a) || 0, Number(b) || 0),
      SQRT: (n: any) => Math.sqrt(Number(n) || 0),
      LOG: (n: any) => Math.log10(Number(n) || 0),
      LN: (n: any) => Math.log(Number(n) || 0),
      EXP: (n: any) => Math.exp(Number(n) || 0),
      MAX: (...args: any[]) => {
        const nums = args.flat().map(n => Number(n)).filter(n => !isNaN(n));
        return nums.length ? Math.max(...nums) : 0;
      },
      MIN: (...args: any[]) => {
        const nums = args.flat().map(n => Number(n)).filter(n => !isNaN(n));
        return nums.length ? Math.min(...nums) : 0;
      },
      AVERAGE: (...args: any[]) => {
        const nums = args.flat().map(n => Number(n)).filter(n => !isNaN(n));
        return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      },
      COUNT: (...args: any[]) => args.flat().length,
      SUM: (...args: any[]) => args.flat().reduce((acc, val) => acc + (Number(val) || 0), 0),
      RANDBETWEEN: (min: any, max: any) => {
        const mn = Math.ceil(Number(min) || 0);
        const mx = Math.floor(Number(max) || 0);
        return Math.floor(Math.random() * (mx - mn + 1)) + mn;
      },
      
      // Text (Safe Null Handling)
      CONCATENATE: (...args: any[]) => args.map(a => a === null || a === undefined ? '' : String(a)).join(''),
      EXACT: (a: any, b: any) => String(a || '') === String(b || ''),
      FIND: (find: any, within: any) => (String(within || '')).indexOf(String(find || '')) + 1,
      LEFT: (text: any, num: any) => (String(text || '')).substring(0, Number(num) || 0),
      LEN: (text: any) => (String(text || '')).length,
      LOWER: (text: any) => (String(text || '')).toLowerCase(),
      MID: (text: any, start: any, num: any) => (String(text || '')).substring((Number(start) || 1) - 1, ((Number(start) || 1) - 1) + (Number(num) || 0)),
      RIGHT: (text: any, num: any) => (String(text || '')).slice(-(Number(num) || 0)),
      SUBSTITUTE: (text: any, oldT: any, newT: any) => (String(text || '')).split(String(oldT || '')).join(String(newT || '')),
      TRIM: (text: any) => (String(text || '')).trim(),
      UPPER: (text: any) => (String(text || '')).toUpperCase(),
      CONTAINS: (text: any, search: any) => {
        const str = String(text || '');
        return str ? str.includes(String(search || '')) : false;
      },
      INITIALS: (text: any) => (String(text || '')).trim().split(/\s+/).filter(Boolean).map((w: string) => w[0]).join('').toUpperCase(),
      
      // Date & Time
      TODAY: () => new Date().toISOString().split('T')[0],
      NOW: () => new Date().toISOString(),
      TIMENOW: () => new Date().toLocaleTimeString(),
      DAY: (date: any) => date ? new Date(date).getDate() : null,
      MONTH: (date: any) => date ? new Date(date).getMonth() + 1 : null,
      YEAR: (date: any) => date ? new Date(date).getFullYear() : null,
      HOUR: (time: any) => time ? new Date(`1970-01-01T${time}`).getHours() : null,
      MINUTE: (time: any) => time ? new Date(`1970-01-01T${time}`).getMinutes() : null,
      SECOND: (time: any) => time ? new Date(`1970-01-01T${time}`).getSeconds() : null,
      
      // System
      UNIQUEID: () => Math.random().toString(36).substring(2, 11).toUpperCase(),
      USEREMAIL: () => currentUser?.email || '',
      USERNAME: () => currentUser?.name || '',
      USERROLE: () => currentUser?.role || '',
      
      // Deep Links
      LINKTOFORM: (formId: string, ...args: any[]) => {
        const payload: any = { targetFormId: formId, initialValues: {} };
        for (let i = 0; i < args.length; i += 2) {
          payload.initialValues[args[i]] = args[i+1];
        }
        return `__LINKTOFORM__${JSON.stringify(payload)}`;
      },
      LINKTOROW: (rowId: string, formId: string) => {
        return `__LINKTOROW__${JSON.stringify({ rowId, targetFormId: formId })}`;
      },
      LINKTOVIEW: (viewName: string) => {
        return `__LINKTOVIEW__${JSON.stringify({ viewName })}`;
      },
      
      // List & Ref
      ANY: (list: any[]) => Array.isArray(list) ? list[0] : list,
      IN: (val: any, list: any[]) => Array.isArray(list) ? list.includes(val) : false,
      UNIQUE: (list: any[]) => Array.from(new Set(list)),
      SORT: (list: any[]) => [...list].sort(),
      
      // Data Access (Full Async LOOKUP)
      LOOKUP: async (val: any, tableName: string, col: string, returnCol: string) => {
        if (val === null || val === undefined || val === '') return null;
        
        const searchVal = String(val).trim();
        const tNameStr = String(tableName || '').trim();
        const colStr = String(col || '').trim();
        const returnColStr = String(returnCol || '').trim();

        if (!tNameStr || !colStr || !returnColStr) return null;
        
        // 1. Check contextData first (Synchronous/Cache)
        const tNameLower = tNameStr.toLowerCase();
        let tableData = [];
        
        if (tNameLower === 'customers' || tNameLower === 'customer') {
          tableData = contextData['Customers'] || [];
        } else if (tNameLower === 'users' || tNameLower === 'user') {
          tableData = contextData['Users'] || [];
        } else {
          tableData = contextData[tNameStr] || 
                      Object.values(contextData).find((t: any, idx) => 
                        Object.keys(contextData)[idx].toLowerCase() === tNameLower
                      ) || [];
        }

        if (Array.isArray(tableData) && tableData.length > 0) {
          const row = tableData.find((r: any) => String(r[colStr] || '').trim() === searchVal);
          if (row) return row[returnColStr] !== undefined ? (row[returnColStr] === null ? "" : row[returnColStr]) : null;
        }

        // 2. Fallback to Supabase (Asynchronous)
        try {
          const { data, error } = await supabase
            .from(tNameStr)
            .select(returnColStr)
            .eq(colStr, searchVal)
            .maybeSingle();
          
          if (error) throw error;
          return data ? data[returnColStr] : null;
        } catch (e) {
          console.error(`LOOKUP failed for ${tNameStr}:`, e);
          return null;
        }
      },
      __SELECT: async (tableName: string, returnCol: string, conditionStr: string) => {
        const tableData = contextData[tableName] || contextData['Customers'] || [];
        const parsedCondition = conditionStr.replace(/\[([^\]]+)\]/g, `row["$1"]`).replace(/([^<>=!])=([^=])/g, '$1===$2');
        const condFunc = new Function('row', `try { return ${parsedCondition}; } catch(e) { return false; }`);
        return tableData.filter((r: any) => condFunc(r)).map((r: any) => r[returnCol]);
      },
      __FILTER: async (tableName: string, conditionStr: string) => {
        const tableData = contextData[tableName] || contextData['Customers'] || [];
        const parsedCondition = conditionStr.replace(/\[([^\]]+)\]/g, `row["$1"]`).replace(/([^<>=!])=([^=])/g, '$1===$2');
        const condFunc = new Function('row', `try { return ${parsedCondition}; } catch(e) { return false; }`);
        return tableData.filter((r: any) => condFunc(r)).map((r: any) => r.id);
      },
      __GET_COLUMN_LIST: (tableName: string, col: string) => {
        const tableData = contextData[tableName] || [];
        return tableData.map((r: any) => r[col]);
      },
      __GET_RELATED_VALUE: (tableName: string, col: string, currentData: Record<string, any>) => {
        const tNameLower = tableName.toLowerCase();
        let tableData = [];
        
        if (tNameLower === 'customers' || tNameLower === 'customer') {
          tableData = contextData['Customers'] || [];
        } else if (tNameLower === 'users' || tNameLower === 'user') {
          tableData = contextData['Users'] || [];
        } else {
          tableData = contextData[tableName] || 
                      Object.values(contextData).find((t: any, idx) => 
                        Object.keys(contextData)[idx].toLowerCase() === tNameLower
                      ) || [];
        }

        if (!Array.isArray(tableData) || !tableData.length) return null;

        let foreignKeyField = null;
        if (tNameLower === 'customers' || tNameLower === 'customer') {
          foreignKeyField = 'customerId';
        } else if (tNameLower === 'users' || tNameLower === 'user') {
          foreignKeyField = currentData['technicianId'] !== undefined ? 'technicianId' : 'userId';
        } else {
          const singularName = tNameLower.endsWith('s') ? tNameLower.slice(0, -1) : tNameLower;
          foreignKeyField = `${singularName}Id`;
        }

        if (currentData[foreignKeyField] !== undefined) {
          const foreignKeyValue = currentData[foreignKeyField];
          if (foreignKeyValue === null || foreignKeyValue === undefined || foreignKeyValue === '') return "";

          const row = tableData.find((r: any) => String(r.id) === String(foreignKeyValue));
          if (row && row[col] !== undefined) return row[col] === null ? "" : row[col];
          return "";
        }

        if (tableData.length > 0 && tableData[0][col] !== undefined) {
           return tableData[0][col] === null ? "" : tableData[0][col];
        }

        return null;
      },
      __DEREF: async (refVal: any, returnCol: string) => {
        if (!refVal) return null;
        for (const table of Object.values(contextData)) {
          if (Array.isArray(table)) {
            const row = table.find((r: any) => String(r.id) === String(refVal));
            if (row && row[returnCol] !== undefined) return row[returnCol];
          }
        }
        return null;
      },
      __LIST_MATH: (list1: any, op: string, list2: any) => {
        if (!Array.isArray(list1) && !Array.isArray(list2)) {
          if (op === '+') return Number(list1 || 0) + Number(list2 || 0);
          if (op === '-') return Number(list1 || 0) - Number(list2 || 0);
        }
        const l1 = Array.isArray(list1) ? list1 : [list1];
        const l2 = Array.isArray(list2) ? list2 : [list2];
        if (op === '+') return [...l1, ...l2];
        if (op === '-') return l1.filter(x => !l2.includes(x));
        return l1;
      }
    };
    return funcs;
  }, [contextData, currentUser, supabase]);

  const evaluateFormula = React.useCallback(async (formula: string, data: Record<string, any>) => {
    try {
      if (!formula || formula.trim() === '') return null;
      
      let script = formula;
      
      // 1. Syntactic Sugar Replacements (AppSheet style)
      script = script.replace(/SELECT\s*\(\s*([a-zA-Z0-9_]+)\[([^\]]+)\]\s*,\s*(.+?)\s*\)/ig, `__SELECT("$1", "$2", "$3")`);
      script = script.replace(/FILTER\s*\(\s*"?([a-zA-Z0-9_]+)"?\s*,\s*(.+?)\s*\)/ig, `__FILTER("$1", "$2")`);
      script = script.replace(/\[([^\]]+)\]\.\[([^\]]+)\]/g, `__DEREF(data["$1"], "$2")`);
      script = script.replace(/([a-zA-Z0-9_]+)\[([^\]]+)\]/g, `__GET_RELATED_VALUE("$1", "$2", data)`);
      
      // List Math: List1 + List2 or List1 - List2
      script = script.replace(/([a-zA-Z0-9_]+\[[^\]]+\]|\[[^\]]+\])\s*([+-])\s*([a-zA-Z0-9_]+\[[^\]]+\]|\[[^\]]+\])/g, (match, p1, p2, p3) => {
        const parseArg = (arg: string) => {
          if (arg && arg.includes('[')) {
            const m = arg.match(/([a-zA-Z0-9_]+)?\[([^\]]+)\]/);
            if (m) {
              if (m[1]) return `__GET_RELATED_VALUE("${m[1]}", "${m[2]}", data)`;
              return `data["${m[2]}"]`;
            }
          }
          return arg;
        };
        return `__LIST_MATH(${parseArg(p1)}, "${p2}", ${parseArg(p3)})`;
      });

      script = script.replace(/\[([^\]]+)\]/g, `data["$1"]`);
      script = script.replace(/([^<>=!])=([^=])/g, '$1===$2');

      // 2. Async Injection: Wrap known async functions with await to support nested async calls
      const asyncFuncs = ['LOOKUP', '__SELECT', '__FILTER', '__DEREF'];
      asyncFuncs.forEach(fn => {
        const regex = new RegExp(`\\b${fn}\\s*\\(`, 'g');
        script = script.replace(regex, `await ${fn}(`);
      });

      // 3. Execution Scope: Inject all library functions into the local scope
      const keys = Object.keys(formulaFunctions);
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      
      const evaluator = new AsyncFunction(...keys, 'data', `
        try { 
          return await (${script}); 
        } catch(e) { 
          return null; 
        }
      `);
      
      const result = await evaluator(...Object.values(formulaFunctions), data);
      return result === undefined ? null : result;
    } catch (e) {
      console.error("Formula Parser Error:", e.message, "Formula:", formula);
      return null;
    }
  }, [formulaFunctions]);

  const runCalculations = React.useCallback(async () => {
    const newData = { ...formDataRef.current };
    const updatedKeys = new Set<string>();
    let hasOverallChanged = false;

    // Identify which fields need calculation or visibility check
    const calcFields = fieldsRef.current.filter(f => f.calculationFormula);
    const visibilityFields = fieldsRef.current.filter(f => f.visibilityCondition);
    
    if (calcFields.length === 0 && visibilityFields.length === 0) return;

    // Mark fields as calculating
    setCalculatingFields(prev => {
      const next = new Set(prev);
      calcFields.forEach(f => next.add(f.fieldKey));
      return next;
    });

    try {
      // 1. Calculate Visibility first (one pass is usually enough)
      const visibilityResults = await Promise.all(visibilityFields.map(async (field) => {
        const isVisible = await evaluateFormula(field.visibilityCondition!, newData);
        return { key: field.fieldKey, isVisible: !!isVisible };
      }));
      
      setVisibleFields(prev => {
        const next = { ...prev };
        visibilityResults.forEach(({ key, isVisible }) => {
          next[key] = isVisible;
        });
        return next;
      });

      // 2. Calculate Formulas (with iteration for dependencies)
      for (let i = 0; i < 3; i++) { // Max depth for nested calculations
        let iterationChanged = false;
        
        const results = await Promise.all(calcFields.map(async (field) => {
          if (field.calculationFormula && field.calculationFormula.toUpperCase().includes('UNIQUEID()') && newData[field.fieldKey]) {
            return { key: field.fieldKey, result: newData[field.fieldKey] };
          }
          const result = await evaluateFormula(field.calculationFormula!, newData);
          return { key: field.fieldKey, result };
        }));

        results.forEach(({ key, result }) => {
          const currentVal = newData[key];
          const resultStr = result === null || result === undefined ? '' : String(result);
          const currentStr = currentVal === null || currentVal === undefined ? '' : String(currentVal);

          if (resultStr !== currentStr) {
            newData[key] = result;
            iterationChanged = true;
            hasOverallChanged = true;
            updatedKeys.add(key);
          }
        });

        if (!iterationChanged) break;
      }

      if (hasOverallChanged) {
        setFormData(prev => {
          const merged = { ...prev };
          let trulyDifferent = false;
          updatedKeys.forEach(key => {
            if (String(prev[key] || '') !== String(newData[key] || '')) {
              merged[key] = newData[key];
              trulyDifferent = true;
            }
          });
          return trulyDifferent ? merged : prev;
        });
      }
    } finally {
      setCalculatingFields(prev => {
        const next = new Set(prev);
        calcFields.forEach(f => next.delete(f.fieldKey));
        return next;
      });
    }
  }, [evaluateFormula]);

  // Logic dependencies: include core system fields to trigger lookups immediately
  const dataString = React.useMemo(() => {
    const triggerData: Record<string, any> = {};
    Object.keys(formData).forEach(key => {
      const field = fieldsRef.current.find(f => f.fieldKey === key);
      // We trigger calculations on any non-calculated field OR core system fields
      if (!field?.calculationFormula || key.toLowerCase().endsWith('id')) {
        triggerData[key] = formData[key];
      }
    });
    return JSON.stringify(triggerData);
  }, [formData]);

  React.useEffect(() => {
    const timer = setTimeout(async () => {
      await runCalculations();
    }, 300);
    return () => clearTimeout(timer);
  }, [dataString, runCalculations]);

  const handleChange = (key: string, value: any) => {
    if (readOnly) return;
    setFormData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    let isValid = true;
    fieldsRef.current.forEach(field => {
      if (field.isHidden) return;
      const isVisible = field.visibilityCondition ? visibleFields[field.fieldKey] !== false : true;
      if (!isVisible) return;

      const value = formData[field.fieldKey];
      const isEmpty = value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
      
      let fieldError = null;
      if (field.isRequired && isEmpty) {
        fieldError = 'שדה זה הוא חובה';
      } else if (field.fieldType === FieldType.EMAIL && !isEmpty && !EMAIL_REGEX.test(value)) {
        fieldError = 'כתובת אימייל לא תקינה';
      } else if (field.fieldType === FieldType.PHONE && !isEmpty && !PHONE_REGEX.test(value)) {
        fieldError = 'מספר טלפון לא תקין';
      }

      if (fieldError) {
        newErrors[field.fieldKey] = fieldError;
        isValid = false;
      }
    });

    setErrors(newErrors);

    if (!isValid) {
      // Find the first field with an error based on orderIndex
      const firstErrorField = [...fieldsRef.current]
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
        .find(f => newErrors[f.fieldKey]);

      if (firstErrorField) {
        const element = document.getElementById(`field-container-${firstErrorField.fieldKey}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a temporary highlight effect
          element.classList.add('ring-2', 'ring-red-400', 'ring-offset-2');
          setTimeout(() => element.classList.remove('ring-2', 'ring-red-400', 'ring-offset-2'), 3000);
        }
      }
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (calculatingFields.size > 0) {
      alert('אנא המתן לסיום החישובים...');
      return;
    }
    if (validate()) {
      setIsSubmitting(true);
      try {
        deleteDraft();
        await onSubmit(formData);
      } catch (error) {
        console.error("Submission error:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const renderField = (field: FormField) => {
    if (field.isHidden) return null;
    const isVisible = field.visibilityCondition ? visibleFields[field.fieldKey] !== false : true;
    if (!isVisible) return null;

    const params = new URLSearchParams(window.location.search);
    const isLinked = field.fieldKey === 'ROWID' && params.get('parentRowId') === String(formData[field.fieldKey] || '');
    
    const options = field.options as any;
    const isPullingFromParent = options?.pullFromRef && 
                                (options.linkedRefField === 'ROWID' || 
                                 (!fieldsRef.current.some(f => f.fieldKey === options.linkedRefField) && options.linkedRefField?.length > 10));

    const isCalculating = calculatingFields.has(field.fieldKey);
    const hasError = !!errors[field.fieldKey];
    const isCalculated = !!field.calculationFormula;
    const isFieldReadOnly = readOnly || isCalculated || isLinked || (loadingParent && isPullingFromParent);

    const commonClasses = `w-full p-3.5 border-2 rounded-2xl outline-none transition-all duration-200 ${
      hasError ? 'border-red-400 bg-red-50' : 'border-slate-100 focus:border-blue-500 focus:bg-white'
    } ${isCalculated || isLinked || (loadingParent && isPullingFromParent) ? 'bg-slate-50 font-bold text-blue-800' : 'bg-white shadow-sm'} ${isCalculating ? 'animate-pulse opacity-70' : ''}`;

    if (field.fieldType === FieldType.SECTION_TITLE) return (
      <div key={field.id} className="col-span-full mt-6 md:mt-8 first:mt-0">
        <h3 className="text-lg md:text-xl font-black text-slate-800 border-r-4 border-blue-600 pr-3 py-1 mb-2 bg-slate-50/50 rounded-l-xl break-words">{field.label}</h3>
      </div>
    );

    return (
      <div key={field.id} id={`field-container-${field.fieldKey}`} className="flex flex-col space-y-1.5 animate-in fade-in duration-300 rounded-2xl transition-all">
        <label className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest px-1 flex items-center flex-wrap gap-1.5 leading-tight">
          {field.label} {field.isRequired && <span className="text-red-500">*</span>}
          {isCalculated && <Calculator size={12} className="text-blue-500" />}
          {loadingParent && isPullingFromParent && <Loader2 size={12} className="text-blue-500 animate-spin" />}
        </label>
        
        <div className="relative">
          {(() => {
            switch (field.fieldType) {
              case FieldType.LONG_TEXT:
                return <textarea disabled={isFieldReadOnly} value={isCalculating ? 'טוען...' : (formData[field.fieldKey] ?? '')} onChange={e => handleChange(field.fieldKey, e.target.value)} className={`${commonClasses} min-h-[100px] resize-none`} />;
              case FieldType.NUMBER:
              case FieldType.DECIMAL:
              case FieldType.PRICE:
              case FieldType.PERCENT:
                return (
                  <div className="relative">
                    <input type="text" disabled={isFieldReadOnly} value={isCalculating ? 'טוען...' : (formData[field.fieldKey] ?? '')} onChange={e => handleChange(field.fieldKey, e.target.value)} className={commonClasses} />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {field.fieldType === FieldType.PRICE ? <DollarSign size={16}/> : field.fieldType === FieldType.PERCENT ? <Percent size={16}/> : <Hash size={16}/>}
                    </div>
                  </div>
                );
              case FieldType.EMAIL:
                return (
                  <div className="relative">
                    <input type="email" disabled={isFieldReadOnly} value={isCalculating ? 'טוען...' : (formData[field.fieldKey] ?? '')} onChange={e => handleChange(field.fieldKey, e.target.value)} className={commonClasses} />
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                );
              case FieldType.PHONE:
                return (
                  <div className="relative">
                    <input type="tel" disabled={isFieldReadOnly} value={isCalculating ? 'טוען...' : (formData[field.fieldKey] ?? '')} onChange={e => handleChange(field.fieldKey, e.target.value)} className={commonClasses} />
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                );
              case FieldType.DATE:
                return <input type="date" disabled={isFieldReadOnly} value={isCalculating ? 'טוען...' : (formData[field.fieldKey] ?? '')} onChange={e => handleChange(field.fieldKey, e.target.value)} className={commonClasses} />;
              case FieldType.YES_NO:
              case FieldType.BOOLEAN:
                const currentYesLabel = field.yesLabel || 'כן';
                const currentNoLabel = field.noLabel || 'לא';
                return (
                  <div className="flex gap-3 p-1">
                    <button type="button" onClick={() => handleChange(field.fieldKey, currentYesLabel)} className={`flex-1 py-3 rounded-2xl border-2 font-black transition-all duration-300 ${formData[field.fieldKey] === currentYesLabel ? 'border-green-500 bg-green-50 text-green-700 shadow-lg shadow-green-100' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}>
                      {currentYesLabel}
                    </button>
                    <button type="button" onClick={() => handleChange(field.fieldKey, currentNoLabel)} className={`flex-1 py-3 rounded-2xl border-2 font-black transition-all duration-300 ${formData[field.fieldKey] === currentNoLabel ? 'border-red-500 bg-red-50 text-red-700 shadow-lg shadow-red-100' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}>
                      {currentNoLabel}
                    </button>
                  </div>
                );
              case FieldType.SIGNATURE:
                return <SignaturePad value={formData[field.fieldKey] ?? ''} onChange={(val) => handleChange(field.fieldKey, val)} readOnly={readOnly} />;
              case FieldType.LINK_BUTTON:
                const targetId = field.targetFormId || (field.options as any)?.targetFormId || (field.options as any)?.targetTemplateId;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (!targetId) {
                        console.warn(`No target form defined for button: ${field.label}`);
                        alert('תבנית יעד לא הוגדרה עבור כפתור זה.');
                        return;
                      }
                      onAction?.('REDIRECT_FORM', { 
                        field, 
                        currentData: formData,
                        targetFormId: targetId
                      });
                    }}
                    className={`w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-slate-200 ${!targetId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Zap size={18} className="text-yellow-400" /> {field.label}
                  </button>
                );
              case FieldType.ENUM:
              case FieldType.SELECT:
              case FieldType.ENUM_LIST:
              case FieldType.MULTI_SELECT:
                return <EnumSelector field={field} value={formData[field.fieldKey] ?? ''} onChange={(val) => handleChange(field.fieldKey, val)} readOnly={isFieldReadOnly} isMulti={field.fieldType === FieldType.ENUM_LIST || field.fieldType === FieldType.MULTI_SELECT} commonClasses={commonClasses} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} dropdownRef={dropdownRef} selectSearch={selectSearch} setSelectSearch={setSelectSearch} />;
              default:
                return <input type="text" disabled={isFieldReadOnly} value={formData[field.fieldKey] ?? ''} onChange={e => handleChange(field.fieldKey, e.target.value)} className={commonClasses} />;
            }
          })()}
          {isLinked && (
            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-black text-blue-600 animate-in fade-in slide-in-from-right-1 px-1">
              <ArrowRightLeft size={10} />
              <span>מקושר לרשומה עליונה (Parent)</span>
            </div>
          )}
        </div>
        {hasError && <p className="text-[10px] font-black text-red-500 flex items-center gap-1 px-1 animate-in slide-in-from-top-1"><AlertCircle size={10}/> {errors[field.fieldKey]}</p>}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-right relative" dir="rtl">
      {showDraftPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <ClipboardList size={32} />
            </div>
            <h3 className="text-2xl font-black text-center text-slate-800 mb-2">נמצאה טיוטה שמורה</h3>
            <p className="text-slate-500 text-center mb-8 font-medium">
              נמצאה טיוטה של טופס זה. האם תרצה להמשיך מאותה נקודה או להתחיל מחדש?
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  if (draftData) {
                    setFormData(draftData);
                  }
                  setShowDraftPrompt(false);
                }}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-200"
              >
                המשך טיוטה
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteDraft();
                  setShowDraftPrompt(false);
                }}
                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all active:scale-95"
              >
                התחל מחדש
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-600 p-8 rounded-[2rem] text-white shadow-xl flex justify-between items-center relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700" />
        <div className="relative z-10">
          <h2 className="text-2xl font-black">{template.name}</h2>
          {template.description && <p className="text-blue-100 mt-1 text-sm font-bold opacity-80">{template.description}</p>}
        </div>
        {!readOnly && (
          <div className="relative z-10 bg-white/10 px-4 py-2 rounded-xl border border-white/20 backdrop-blur-md flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400"/> 
            <span className="text-[10px] font-black uppercase tracking-widest">טיוטה פעילה</span>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 p-2">
        {[...template.fields].sort((a,b) => (a.orderIndex || 0) - (b.orderIndex || 0)).map(field => renderField(field))}
      </div>

      {template.navigation_config?.enabled && (
        <div className="p-2">
          <button
            type="button"
            onClick={() => {
              const rowId = formData['ROWID'] || formData['inspectionSerialNumber'];
              if (rowId) {
                localStorage.setItem('pendingParentRowId', rowId);
                const url = new URL(window.location.href);
                url.searchParams.set('parentRowId', rowId);
                window.history.pushState({}, '', url.toString());
              }
              onAction?.('REDIRECT_FORM', { 
                targetFormId: template.navigation_config?.targetTemplateId,
                currentData: formData 
              });
            }}
            className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-blue-100 border-b-4 border-blue-800"
          >
            <ArrowRightLeft size={24} className="text-blue-200" />
            {template.navigation_config.label || 'מעבר לטופס אחר'}
          </button>
        </div>
      )}

      {(() => {
        const hasData = childRecords.length > 0 || localSummary.length > 0;
        if (!hasData) return null;

        return (
          <div className="mt-6 p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                <ClipboardList size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-800">ריכוז נתונים שנשמרו</h3>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-500">מספר סידורי</th>
                    <th className="px-4 py-3 font-bold text-slate-500">סוג טופס</th>
                    <th className="px-4 py-3 font-bold text-slate-500">תאריך</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(() => {
                    const combined = [...localSummary, ...childRecords.map(r => ({ ...r.data, id: r.id, createdAt: r.created_at, serial_number: r.inspectionSerialNumber || r.serial_number }))];
                    const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                    return unique.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((record, idx) => (
                      <tr key={record.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">{record.inspectionSerialNumber || record.serial_number || '---'}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{record.templateName || record.type || 'נתוני טופס'}</td>
                        <td className="px-4 py-3 text-slate-500 font-medium">{record.inspectionDate || (record.createdAt ? new Date(record.createdAt).toLocaleDateString('he-IL') : '---')}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
      
      <div className="flex justify-between items-center pt-6 border-t border-slate-100 flex-col sm:flex-row gap-4">
        <div className="flex items-center">
          {!readOnly && (
            <button
              type="button"
              onClick={async () => {
                try {
                  if (!currentUser?.id) {
                    throw new Error('User not authenticated');
                  }
                  
                  const customer = contextData?.['Customers']?.find((c: any) => c.id === formData.customerId);
                  const draftData = {
                    ...formData,
                    templateName: template.name,
                    customerName: customer?.name || 'לקוח טרם נבחר',
                    editingInspectionId: editingInspectionId
                  };

                  const { data: result, error } = await supabase.from('inspection_drafts').upsert({
                    user_id: currentUser.id,
                    table_name: template.id,
                    data: draftData,
                    last_updated: new Date().toISOString()
                  }, { onConflict: 'user_id,table_name' }).select();

                  if (error) throw error;
                  if (!result || result.length === 0) {
                    throw new Error(`Data sync failed for table: inspection_drafts`);
                  }
                  
                  onCancel();
                } catch (err) {
                  console.error('Error saving draft:', err);
                  alert('שגיאה בשמירת הטיוטה. אנא נסה שוב.');
                }
              }}
              className="w-full sm:w-auto px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black transition-all hover:bg-slate-200 active:scale-95 min-h-[44px] flex items-center justify-center gap-2"
            >
              <ClipboardList size={18} />
              שמור טיוטה
            </button>
          )}
        </div>
        <div className="flex justify-end gap-3 flex-col sm:flex-row w-full sm:w-auto">
          <button 
            type="button" 
            onClick={() => {
              onCancel();
            }} 
            className="w-full sm:w-auto px-8 py-3 bg-white border border-slate-100 rounded-2xl text-slate-500 font-black transition-all hover:bg-slate-50 active:scale-95 min-h-[44px]"
          >
            ביטול
          </button>
          {!readOnly && (
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full sm:w-auto px-12 py-3 bg-blue-600 text-white rounded-2xl shadow-xl font-black transition-all hover:bg-blue-700 active:scale-95 shadow-blue-200 min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 size={20} className="animate-spin" />}
              שמור ביקורת
            </button>
          )}
        </div>
      </div>
    </form>
  );
};

export default DynamicForm;