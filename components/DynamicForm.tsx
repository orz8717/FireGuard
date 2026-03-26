import React from 'react';
import { FormTemplate, FieldType, FormField, User } from '../types';
import { supabase, supabaseAdmin } from '../services/supabaseClient';
import { dbService } from '../services/dbService';
import { isUUID, generateUUID, generateROWID } from '../src/utils/idGenerators';
import { useFormulaEngine } from '../hooks/useFormulaEngine';
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
  isPreview?: boolean;
  pendingChildRecords?: Record<string, any[]>;
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

      const source = fieldOpts.source || 'manual';

      if (source === 'table' && fieldOpts.sourceTable && fieldOpts.sourceColumn) {
        setLoading(true);
        setError(null);
        try {
          let actualColumn = fieldOpts.sourceColumn;
          
          const allData = await dbService.getRawTableData(fieldOpts.sourceTable);
          
          if (allData && allData.length > 0) {
            const normalize = (s: string) => s.toLowerCase().replace(/[\s_]/g, '');
            const targetNorm = normalize(fieldOpts.sourceColumn);
            const firstRow = allData[0];
            const keys = Object.keys(firstRow);
            const match = keys.find(k => k === fieldOpts.sourceColumn) || 
                          keys.find(k => normalize(k) === targetNorm);
            if (match) actualColumn = match;

            const unique = Array.from(new Set(allData.map(r => r[actualColumn])))
              .filter(v => v !== null && v !== undefined && v !== '')
              .map(v => ({ value: String(v), label: String(v) }))
              .sort((a, b) => a.label.localeCompare(b.label, 'he'));
              
            setOptions(unique);
          } else {
            setOptions([]);
          }
        } catch (e: any) {
          console.error("Error fetching options:", e);
          setOptions([]);
        } finally {
          setLoading(false);
        }
      } else if (source === 'manual' && fieldOpts.manualOptions) {
        let rawOptions = fieldOpts.manualOptions;
        let normalized: any[] = [];
        
        if (Array.isArray(rawOptions)) {
          normalized = rawOptions;
        } else if (typeof rawOptions === 'string') {
          normalized = rawOptions.split(',').map(s => s.trim());
        } else if (typeof rawOptions === 'object' && rawOptions !== null) {
          normalized = Object.values(rawOptions);
        }

        setOptions(
          normalized
            .filter(o => o !== null && o !== undefined && String(o).trim() !== '')
            .map(o => ({ value: String(o), label: String(o) }))
        );
      } else if (Array.isArray(fieldOpts)) {
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
  editingInspectionId = null,
  isPreview = false,
  pendingChildRecords = {}
}) => {
  const fieldsRef = React.useRef(template.fields);
  React.useEffect(() => { fieldsRef.current = template.fields; }, [template.fields]);

  const [formData, setFormData] = React.useState<Record<string, any>>(() => {
    const base = { ...initialValues };
    
    if (!base.id && !base.ROWID && !isPreview) {
      base.id = generateUUID();
      base.ROWID = generateROWID();
    }

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

  // ============================================================
  // על טעינה: שמור parentRowId ו-parentTemplateId מה-URL ל-localStorage
  // ============================================================
  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const parentRowId = searchParams.get('parentRowId');
    const parentTemplateId = searchParams.get('parentTemplateId');

    if (parentRowId) {
      localStorage.setItem('pendingParentRowId', parentRowId);
    }
    if (parentTemplateId) {
      localStorage.setItem('pendingParentTemplateId', parentTemplateId);
    }
  }, []);

  React.useEffect(() => {
  const base = { ...initialValues };
  
  const savedParentData = localStorage.getItem('parentFormData');
 
  
  if (savedParentData) {
    try {
      const parsed = JSON.parse(savedParentData);
      // ✅ אל תדרוס TEMP_CHILD_DATA אם כבר קיים ב-initialValues
      const { TEMP_CHILD_DATA: _ignore, ...parsedWithoutChild } = parsed;
      Object.assign(base, parsedWithoutChild);
    } catch (e) {
      console.error("Failed to parse parentFormData", e);
    }
  }
    
  if (!base.id && !base.ROWID && !isPreview) {
    base.id = generateUUID();
    base.ROWID = generateROWID();
  }

  template.fields.forEach(f => {
    if (base[f.fieldKey] === undefined) {
      if (f.fieldType === FieldType.ENUM_LIST || f.fieldType === FieldType.MULTI_SELECT) {
        base[f.fieldKey] = [];
      } else {
        base[f.fieldKey] = '';
      }
    }
  });
  setFormData(base);
}, [initialValues, template]);

  const formDataRef = React.useRef(formData);
  React.useEffect(() => { formDataRef.current = formData; }, [formData]);

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [visibleFields, setVisibleFields] = React.useState<Record<string, boolean>>({});
  const [calculatingFields, setCalculatingFields] = React.useState<Set<string>>(new Set());
  const [selectSearch, setSelectSearch] = React.useState<Record<string, string>>({});
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // מונע הפעלה כפולה של כפתור הניווט
  const [isNavigating, setIsNavigating] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const {
    hasDraft,
    draftData,
    isChecking,
    isSaving,
    saveDraft,
    deleteDraft,
    updateCurrentData,
    setHasDraft,
    setIsCancelling
  } = useDraftManager(currentUser?.id || '', template.id, isPreview);

  const [showDraftPrompt, setShowDraftPrompt] = React.useState(false);

  React.useEffect(() => {
    if (hasDraft && !draftId && !editingInspectionId) {
      setShowDraftPrompt(true);
    }
  }, [hasDraft, draftId, editingInspectionId]);

  React.useEffect(() => {
    console.log("Current customer ID in form:", formData.customerId);

    const customer = formData.customerId 
      ? contextData?.['Customers']?.find((c: any) => c.id === formData.customerId)
      : null;
    
    updateCurrentData({
      ...formData,
      templateName: template.name,
      customerName: customer ? customer.name : 'לקוח טרם נבחר', 
      customerAddress: customer ? customer.address : '',
      customerCity: customer ? customer.city : '',
      editingInspectionId: editingInspectionId,
      pendingChildRecords: pendingChildRecords
    });
  }, [formData, updateCurrentData, template.name, contextData, editingInspectionId, pendingChildRecords]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [parentRecord, setParentRecord] = React.useState<Record<string, any> | null>(null);
  const [loadingParent, setLoadingParent] = React.useState(false);
  const [childRecords, setChildRecords] = React.useState<any[]>([]);
  const [localSummary, setLocalSummary] = React.useState<any[]>([]);
  const [loadingChildren, setLoadingChildren] = React.useState(false);

  const fetchChildRecords = async (rowId: string) => {
    if (!rowId) return;
    setLoadingChildren(true);
    try {
      const data = await dbService.getChildInspections(rowId);
      setChildRecords(data);
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
    const formId = formData['id'] || formData['ROWID'] || formData['inspectionSerialNumber'];
    
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
  }, [formData['id'], formData['ROWID'], formData['inspectionSerialNumber']]);

  React.useEffect(() => {
    const initParentData = async () => {
      let searchParams = new URLSearchParams(window.location.search);
      if (!searchParams.has('parentRowId') && window.location.hash && window.location.hash.includes('?')) {
         const hashQuery = window.location.hash.split('?')[1];
         searchParams = new URLSearchParams(hashQuery);
      }
      
      let parentRowId = searchParams.get('parentRowId');
      
      if (!parentRowId) {
        parentRowId = localStorage.getItem('pendingParentRowId');
      }

      const savedParentDataJSON = localStorage.getItem('parentFormData');
      if (savedParentDataJSON) {
          try {
              const savedParentData = JSON.parse(savedParentDataJSON);
              setParentRecord(savedParentData);
              
              if (!parentRowId) {
                  parentRowId = savedParentData.id || savedParentData.ROWID || savedParentData.inspectionSerialNumber;
              }
          } catch (e) {
          }
      }
      
      if (parentRowId) {
        if (!isUUID(parentRowId)) {
          console.warn(`[DynamicForm] Invalid UUID for parentRowId: ${parentRowId}. Attempting to resolve correct ID from local storage.`);
          const savedParentDataJSON = localStorage.getItem('parentFormData');
          if (savedParentDataJSON) {
            try {
              const savedParentData = JSON.parse(savedParentDataJSON);
              if (savedParentData.id && isUUID(savedParentData.id)) {
                parentRowId = savedParentData.id;
                console.log(`[DynamicForm] Resolved correct parentRowId: ${parentRowId}`);
                localStorage.setItem('pendingParentRowId', parentRowId);
                const url = new URL(window.location.href);
                url.searchParams.set('parentRowId', parentRowId);
                window.history.replaceState({}, '', url.toString());
              }
            } catch (e) {}
          }
        }

        if (isUUID(parentRowId)) {
          setLoadingParent(true);
          
          try {
            const data = await dbService.getInspectionByRowId(parentRowId);
            if (data) {
              setParentRecord(data);
            }
          } catch (err) {
            console.error("Error fetching parent data:", err);
          } finally {
            setLoadingParent(false);
          }
        } else {
          console.error(`[DynamicForm] Could not resolve a valid UUID for parentRowId. Skipping DB fetch to avoid 22P02 error.`);
        }
      }
    };
    
    initParentData();
  }, []);

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

        const refChanged = String(refValue || '') !== String(prevRefValue || '');
        const isInitialLoad = !isMountedRef.current;
        
        const isLocalField = fieldsRef.current.some(f => f.fieldKey === refKey);
        const isTemplateRef = !isLocalField && refKey.length > 10;

        let shouldUpdate = false;
        if (refChanged && refValue) {
            if (isInitialLoad) {
                if (!currentFieldValue) shouldUpdate = true;
            } else {
                shouldUpdate = true;
            }
        }

        if ((refKey === 'ROWID' || isTemplateRef) && parentRecord && !currentFieldValue) {
           shouldUpdate = true;
        }

        if (shouldUpdate) {
          const refFieldDef = fieldsRef.current.find(f => f.fieldKey === refKey);
          let targetTable = '';
          let targetColumn = 'id';

          if (refKey === 'customerId') {
            targetTable = 'Customers';
          } else if (refKey === 'technicianId') {
            targetTable = 'Users';
          } else if (refKey === 'ROWID') {
          } else if (refFieldDef?.supabaseConfig?.tableName) {
            targetTable = refFieldDef.supabaseConfig.tableName;
            targetColumn = refFieldDef.supabaseConfig.columnName || 'id';
          }

          if ((refKey === 'id' || refKey === 'ROWID' || isTemplateRef) && parentRecord) {
             const newValue = parentRecord[options.sourceProperty];
             if (newValue !== undefined && newValue !== null) {
               const currentVal = formData[field.fieldKey];
               const isEmpty = currentVal === '' || currentVal === null || currentVal === undefined;
               if (isEmpty && currentVal !== newValue) {
                 updates[field.fieldKey] = newValue;
                 hasUpdates = true;
               }
             }
          } else if (targetTable && contextData[targetTable]) {
             const tableData = contextData[targetTable];
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

    fieldsRef.current.forEach(field => {
       const options = field.options as any;
       if (options?.pullFromRef && options.linkedRefField) {
         prevRefValuesRef.current[options.linkedRefField] = formData[options.linkedRefField];
       }
    });
    
    isMountedRef.current = true;
  }, [formData, contextData, readOnly, parentRecord]);

  const { evaluateFormula, formulaFunctions } = useFormulaEngine(contextData || {}, currentUser);

  const runCalculations = React.useCallback(async () => {
    const newData = { ...formDataRef.current };
    const updatedKeys = new Set<string>();
    let hasOverallChanged = false;

    const calcFields = fieldsRef.current.filter(f => f.calculationFormula);
    const visibilityFields = fieldsRef.current.filter(f => f.visibilityCondition);
    
    if (calcFields.length === 0 && visibilityFields.length === 0) return;

    setCalculatingFields(prev => {
      const next = new Set(prev);
      calcFields.forEach(f => next.add(f.fieldKey));
      return next;
    });

    try {
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

      for (let i = 0; i < 3; i++) {
        let iterationChanged = false;
        
        const results = await Promise.all(calcFields.map(async (field) => {
          if (field.calculationFormula && (field.calculationFormula.toUpperCase().includes('UNIQUEID()') || field.calculationFormula.toUpperCase().includes('UNIQUEID_V4()')) && newData[field.fieldKey]) {
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

  const dataString = React.useMemo(() => {
    const triggerData: Record<string, any> = {};
    Object.keys(formData).forEach(key => {
      const field = fieldsRef.current.find(f => f.fieldKey === key);
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
  }, [dataString, runCalculations, template.fields]);

  const handleChange = (key: string, value: any) => {
    if (readOnly) return;
    
    let extraData = {};
    if (key === 'customerId' || key === 'customer_id') {
      const otherKey = key === 'customerId' ? 'customer_id' : 'customerId';
      const selectedCustomer = contextData?.['Customers']?.find((c: any) => c.id === value);
      console.log("Selected Data:", selectedCustomer);
      
      extraData = { [otherKey]: value };

      if (selectedCustomer) {
        const customerNum = selectedCustomer.customer_number || selectedCustomer.customerNumber;
        if (customerNum !== undefined) {
          extraData = { ...extraData, 'מספר_לקוח': customerNum };
        }
      }
    }

    setFormData(prev => ({ ...prev, [key]: value, ...extraData }));
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
      const firstErrorField = [...fieldsRef.current]
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
        .find(f => newErrors[f.fieldKey]);

      if (firstErrorField) {
        const element = document.getElementById(`field-container-${firstErrorField.fieldKey}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-red-400', 'ring-offset-2');
          setTimeout(() => element.classList.remove('ring-2', 'ring-red-400', 'ring-offset-2'), 3000);
        }
      }
    }

    return isValid;
  };

  // ============================================================
  // handleExit — הלוגיקה המרכזית לחזרה לטופס האב
  // נלקחה מהקוד הישן ומיושמת כאן
  // ============================================================
  const handleExit = React.useCallback((actionType: string = 'CANCEL') => {
    setIsNavigating(true);
    
    if (onAction) {
      onAction(actionType, {
        currentData: formData,
        parentRowId: localStorage.getItem('pendingParentRowId'),
        parentTemplateId: localStorage.getItem('pendingParentTemplateId')
      });
    } else {
      onCancel();
    }
    return true;
  }, [onAction, onCancel, formData]);

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
        
        // Ensure timestamps are formatted for Supabase
        const now = new Date().toISOString();
        const fieldsToUpdate = ['created_at', 'last_modified_client'];
        const submissionData = { ...formData };
        fieldsToUpdate.forEach(field => {
          if (!submissionData[field] || submissionData[field] === "") {
            submissionData[field] = now;
          }
        });

        await onSubmit(submissionData);
        // אחרי שמירה מוצלחת — חזור לאב (או בצע ביטול רגיל אם אין אב)
        handleExit('SAVE_REVIEW');
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
    const isLinked = (field.fieldKey === 'id' || field.fieldKey === 'parent_id') && params.get('parentRowId') === String(formData[field.fieldKey] || '');
    
    const options = field.options as any;
    const isPullingFromParent = options?.pullFromRef && 
                                (options.linkedRefField === 'ROWID' || 
                                 (!fieldsRef.current.some(f => f.fieldKey === options.linkedRefField) && options.linkedRefField?.length > 10));

    const isCalculating = calculatingFields.has(field.fieldKey);
    const hasError = !!errors[field.fieldKey];
    const isCalculated = !!field.calculationFormula;
    const isFieldReadOnly = readOnly || isCalculated || isLinked || (loadingParent && isPullingFromParent) || field.isReadOnly;

    const commonClasses = `w-full p-3.5 border-2 rounded-2xl outline-none transition-all duration-200 ${
      hasError ? 'border-red-400 bg-red-50' : 'border-slate-100 focus:border-blue-500 focus:bg-white'
    } ${isCalculated || isLinked || (loadingParent && isPullingFromParent) || field.isReadOnly ? 'bg-slate-50 font-bold text-blue-800' : 'bg-white shadow-sm'} ${isCalculating ? 'animate-pulse opacity-70' : ''}`;

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

              // ============================================================
              // LINK_BUTTON — פותח טופס בן בלבד. אין bypass חזרה לאב כאן.
              // ============================================================
              case FieldType.LINK_BUTTON:
                const btnTargetId = field.targetFormId 
                  || (field.options as any)?.targetFormId 
                  || (field.options as any)?.targetTemplateId;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (!btnTargetId) {
                        console.warn(`No target form defined for button: ${field.label}`);
                        alert('תבנית יעד לא הוגדרה עבור כפתור זה.');
                        return;
                      }
                      // שמור את פרטי הטופס הנוכחי (האב) ל-localStorage לפני המעבר
                      const rowId = formData['id'] || formData['ROWID'] || formData['inspectionSerialNumber'];
                      if (rowId) {
                        // Ensure timestamps are formatted for Supabase
                        const now = new Date().toISOString();
                        const fieldsToUpdate = ['created_at', 'last_modified_client'];
                        const processedFormData = { ...formData };
                        fieldsToUpdate.forEach(field => {
                          if (!processedFormData[field] || processedFormData[field] === "") {
                            processedFormData[field] = now;
                          }
                        });

                        localStorage.setItem('pendingParentRowId', rowId);
                        localStorage.setItem('pendingParentTemplateId', template.id);
                        localStorage.setItem('parentFormData', JSON.stringify(processedFormData));
                        const url = new URL(window.location.href);
                        url.searchParams.set('parentRowId', rowId);
                        url.searchParams.set('parentTemplateId', template.id);
                        window.history.pushState({}, '', url.toString());
                      }
                      onAction?.('REDIRECT_FORM', { 
                        field, 
                        currentData: formData,
                        targetFormId: btnTargetId
                      });
                    }}
                    className={`w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-slate-200 ${!btnTargetId ? 'opacity-50 cursor-not-allowed' : ''}`}
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

  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const formTopRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    // Scroll to top when template changes or form mounts
    const scrollToTop = () => {
      if (formTopRef.current) {
        formTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    // Small delay to ensure content is ready and layout has settled
    const timer = setTimeout(scrollToTop, 100);
    return () => clearTimeout(timer);
  }, [template.id]);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <form ref={formTopRef} onSubmit={handleSubmit} className="space-y-6 text-right relative pb-32" dir="rtl">
      {!isOnline && (
        <div className="p-2 bg-yellow-100 text-yellow-800 text-center text-sm font-bold rounded-lg mb-4">
          מצב לא מקוון - עובד מהזיכרון המקומי
        </div>
      )}
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
        {!readOnly && hasDraft && (
          <div className="relative z-10 bg-white/10 px-4 py-2 rounded-xl border border-white/20 backdrop-blur-md flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400"/> 
            <span className="text-[10px] font-black uppercase tracking-widest">טיוטה פעילה</span>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 p-2">
        {(() => {
          const fields = [...template.fields];
          return fields.sort((a,b) => (a.orderIndex || 0) - (b.orderIndex || 0)).map(field => renderField(field));
        })()}
      </div>

      {/* ============================================================
          כפתור ניווט לטופס בן (navigation_config)
          שומר parentRowId + parentTemplateId לפני המעבר
          ============================================================ */}
      {template.navigation_config?.enabled && (
        <div className="p-2">
          <button
    type="button"
    onClick={async () => { // הוספת async לתמיכה בשמירה
        if (isNavigating) return;
        setIsNavigating(true);

        const rowId = formData['id'] || formData['ROWID'] || formData['inspectionSerialNumber'];
        if (rowId) {
            localStorage.setItem('pendingParentRowId', rowId);
            localStorage.setItem('pendingParentTemplateId', template.id);
            localStorage.setItem('parentFormData', JSON.stringify(formData));
            
            // --- ההוספה שלי: יצירת ה-Draft בבסיס הנתונים המקומי ---
            try {
                // Ensure timestamps are formatted for Supabase
                const now = new Date().toISOString();
                const fieldsToUpdate = ['created_at', 'last_modified_client'];
                const draftData = { ...formData };
                fieldsToUpdate.forEach(field => {
                  if (!draftData[field] || draftData[field] === "") {
                    draftData[field] = now;
                  }
                });

                await saveDraft(draftData); 
                console.log("DEBUG: Parent draft saved successfully before navigation");
            } catch (error) {
                console.error("DEBUG: Failed to save parent draft:", error);
            }
            // --------------------------------------------------

            const url = new URL(window.location.href);
            url.searchParams.set('parentRowId', rowId);
            url.searchParams.set('parentTemplateId', template.id);
            window.history.pushState({}, '', url.toString());
        }

        onAction?.('REDIRECT_FORM', { 
            targetFormId: template.navigation_config?.targetTemplateId,
            currentData: formData 
        });

        // אפשר ניווט חוזר אחרי קצר עיכוב
        setTimeout(() => setIsNavigating(false), 1000);
    }}
    className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-blue-100 border-b-4 border-blue-800"
>
    <ArrowRightLeft size={24} className="text-blue-200" />
    {template.navigation_config.label || 'מעבר לטופס אחר'}
</button>
        </div>
      )}

      {(() => {
        const tempChildData = formData['TEMP_CHILD_DATA'] || [];
        let parsedTempChildData = [];
        try {
          parsedTempChildData = typeof tempChildData === 'string' ? JSON.parse(tempChildData) : tempChildData;
        } catch (e) {
          console.warn('[DynamicForm] Failed to parse TEMP_CHILD_DATA:', e);
        }
        
        const combined = [
          ...localSummary, 
          ...(Array.isArray(parsedTempChildData) ? parsedTempChildData : []),
          ...childRecords.map(r => ({ ...r.data, id: r.id, createdAt: r.created_at, serial_number: r.inspectionSerialNumber || r.serial_number }))
        ];
        const unique = Array.from(new Map(combined.map(item => [item.id || item.ROWID, item])).values());
        
        if (unique.length === 0) {
          return <div className="mt-6 p-6 text-center text-slate-500 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">לא נוספו רשומות עדיין</div>;
        }

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
                    <th className="px-4 py-3 font-bold text-slate-500">ROWID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {unique.sort((a,b) => new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime()).map((record, idx) => (
                    <tr key={record.id || record.ROWID || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">{record.inspectionSerialNumber || record.serial_number || '---'}</td>
                      <td className="px-4 py-3 font-bold text-slate-700">{record.templateName || record.type || 'נתוני טופס'}</td>
                      <td className="px-4 py-3 text-slate-500 font-medium">{record.inspectionDate || (record.createdAt || record.created_at ? new Date(record.createdAt || record.created_at).toLocaleDateString('he-IL') : '---')}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{record.ROWID || '---'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      <div className="sticky bottom-0 left-0 right-0 z-[100] bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 -mx-2 sm:-mx-4 md:-mx-8 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex justify-between items-center flex-col sm:flex-row gap-4 mt-8">
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
                  const dataToSave = {
                    ...formData,
                    templateName: template.name,
                    customerName: customer?.name || 'לקוח טרם נבחר',
                    editingInspectionId: editingInspectionId,
                    pendingChildRecords: pendingChildRecords
                  };

                  // Ensure timestamps are formatted for Supabase
                  const now = new Date().toISOString();
                  const fieldsToUpdate = ['created_at', 'last_modified_client'];
                  fieldsToUpdate.forEach(field => {
                    if (!dataToSave[field] || dataToSave[field] === "") {
                      dataToSave[field] = now;
                    }
                  });

                  await saveDraft(dataToSave);
                  // אחרי שמירת טיוטה — חזור לאב (או ביטול רגיל)
                  handleExit('SAVE_REVIEW');
                } catch (err) {
                  console.error('Error saving draft:', err);
                  alert('שגיאה בשמירת הטיוטה. אנא נסה שוב.');
                }
              }}
              className="w-full sm:w-auto px-6 py-3 bg-slate-100 text-slate-700 rounded-full font-black transition-all hover:bg-slate-200 active:scale-95 min-h-[44px] flex items-center justify-center gap-2"
            >
              <ClipboardList size={18} />
              שמור טיוטה
            </button>
          )}
        </div>
        <div className="flex justify-end gap-3 flex-col sm:flex-row w-full sm:w-auto">
          {/* ============================================================
              כפתור ביטול — קורא ל-handleExit שמחזיר לאב או מבצע ביטול רגיל
              ============================================================ */}
          <button 
            type="button" 
            onClick={() => {
              setIsCancelling(true);
              handleExit('CANCEL');
            }} 
            className="w-full sm:w-auto px-8 py-3 bg-white border border-slate-200 rounded-full text-slate-500 font-black transition-all hover:bg-slate-50 active:scale-95 min-h-[44px]"
          >
            ביטול
          </button>
          {/* ============================================================
              כפתור שמור ביקורת — שומר ואז קורא ל-handleExit
              ============================================================ */}
          {!readOnly && (
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full sm:w-auto px-12 py-3 bg-blue-600 text-white rounded-full shadow-xl font-black transition-all hover:bg-blue-700 active:scale-95 shadow-blue-200 min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
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