
import React from 'react';
import { Inspection, InspectionType, InspectionStatus, Customer, User, UserRole, FormTemplate, FieldType } from '../types';
import { dbService } from '../services/dbService';
import { nestChildRecords } from '../utils/dataUtils';
import { supabase } from '../services/supabaseClient';
import { Plus, Search, Eye, Edit2, Loader2, ClipboardList, Clock, Trash2, Zap, Building, CreditCard, Fingerprint, Calendar } from 'lucide-react';
import DynamicForm from '../components/DynamicForm';
import { useSync } from '../src/context/SyncContext';

interface InspectionsProps {
  user: User;
}

const Inspections: React.FC<InspectionsProps> = ({ user }) => {
  const { syncData, isSyncing } = useSync();
  const [loading, setLoading] = React.useState(true);
  const [inspections, setInspections] = React.useState<Inspection[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [availableTemplates, setAvailableTemplates] = React.useState<FormTemplate[]>([]);
  const [dynamicTableData, setDynamicTableData] = React.useState<Record<string, any[]>>({});
  const [drafts, setDrafts] = React.useState<any[]>([]);
  
  const [activeDraftId, setActiveDraftId] = React.useState<string | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingInspectionId, setEditingInspectionId] = React.useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState<{id: string, serial: string} | null>(null);
  const [selectedType, setSelectedType] = React.useState<InspectionType>(InspectionType.ANNUAL);
  const [template, setTemplate] = React.useState<FormTemplate | null>(null);
  const [initialValues, setInitialValues] = React.useState<Record<string, any>>({});
  const [savingStatus, setSavingStatus] = React.useState<string | null>(null);
  const [pendingChildRecords, setPendingChildRecords] = React.useState<Record<string, any[]>>({});

  React.useEffect(() => { loadData(); }, [user]);

  const loadData = async (parentTable?: string, childTable?: string) => {
    setLoading(true);
    try {
      const [allI, allC, allU, allT] = await Promise.all([
        dbService.getInspections(),
        dbService.getCustomers(),
        dbService.getUsers(),
        dbService.getFormTemplates()
      ]);
      const filtered = user.role === UserRole.USER ? allI.filter(i => i.technicianId === user.id) : allI;
      // Include all inspections and active templates to ensure navigation works for all configured forms
      setInspections(filtered);
      setCustomers(allC);
      setUsers(allU);
      setAvailableTemplates(allT.filter(t => t.isActive));
      
      // Targeted Sync: Only fetch data for specific tables if provided
      await fetchDynamicSchema(parentTable, childTable);
      
      loadDrafts();
    } catch (err) { } finally { setLoading(false); }
  };

  const fetchDynamicSchema = async (parentTable?: string, childTable?: string) => {
    try {
      const dtd = await syncData(user.name, parentTable, childTable);
      setDynamicTableData(dtd);
    } catch (e) { }
  };

  const loadDrafts = async () => {
    try {
      const { data, error } = await supabase
        .from('inspection_drafts')
        .select('*')
        .eq('user_id', user.id);
        
      let supabaseDrafts: any[] = [];
      if (!error && data) {
        supabaseDrafts = data.map(d => ({
          id: d.id, // Supabase UUID
          templateId: d.table_name,
          templateName: d.data?.templateName || 'טיוטה',
          customerName: d.data?.customerName || 'לקוח לא ידוע',
          data: d.data,
          updatedAt: d.last_updated || d.updated_at || new Date().toISOString(),
          editingInspectionId: d.data?.editingInspectionId || null,
          isSupabase: true
        }));
      }

      // Only use Supabase drafts to prevent duplicates
      const allDrafts = supabaseDrafts.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setDrafts(allDrafts);
    } catch (err) {
      console.error('Error loading drafts:', err);
      setDrafts([]);
    }
  };

  const handleStartNew = async (type: InspectionType, templateId?: string) => {
    setLoading(true);
    try {
      let t: FormTemplate | null = null;
      if (templateId) {
        const searchId = String(templateId).toLowerCase().trim();
        t = availableTemplates.find(tmp => String(tmp.id).toLowerCase() === searchId) || null;
        
        if (!t) {
          const allT = await dbService.getFormTemplates();
          t = allT.find(tmp => String(tmp.id).toLowerCase() === searchId) || null;
        }
      } else {
        const formKey = type === InspectionType.ANNUAL ? 'ANNUAL_INSPECTION' : 'SEMI_ANNUAL_INSPECTION';
        t = await dbService.getFormTemplate(formKey);
      }
      
      if (!t || !t.fields || t.fields.length === 0) {
        alert("שגיאה: לא נמצאה תבנית פעילה עבור סוג ביקורת זה.");
        return;
      }

      // TASK: Implement Temporary ID for new Parent Forms
      const isChildNavigation = !!localStorage.getItem('returnToDraftId');
      const newInitialValues: Record<string, any> = { technicianId: user.id };

      if (!isChildNavigation) {
        // Fresh Parent Form session
        localStorage.removeItem('pendingParentRowId');
        localStorage.removeItem('parentFormData');
        
        const tempId = `TEMP_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        localStorage.setItem('pendingParentRowId', tempId);
        
        // Inject temp ID into ROWID field
        newInitialValues['ROWID'] = tempId;
        
        // Clear pending children for new session
        setPendingChildRecords({});
      }

      setSelectedType(type);
      setTemplate(t);
      setInitialValues(newInitialValues); 
      setActiveDraftId(`insp_${t.id}_${Date.now()}`);
      setIsAdding(true);
    } catch (err) {
      alert("שגיאה בטעינת התבנית.");
    } finally {
      setLoading(false);
    }
  };

  const handleContinueDraft = async (draftId: string) => {
    let draft: any = null;
    
    // Check Supabase drafts in state
    draft = drafts.find(d => d.id === draftId);
    
    // If not found in state, fetch from Supabase directly
    if (!draft) {
      try {
        let query = supabase.from('inspection_drafts').select('*').eq('user_id', user.id);
        
        if (draftId.startsWith('insp_')) {
          // Extract template ID from insp_TEMPLATEID_TIMESTAMP
          const parts = draftId.split('_');
          if (parts.length >= 2) {
            const templateId = parts[1];
            query = query.eq('table_name', templateId);
          } else {
            return; // Invalid ID format
          }
        } else {
          // Assume it's a UUID
          query = query.eq('id', draftId);
        }

        const { data } = await query.maybeSingle();
          
        if (data) {
          draft = {
            id: data.id,
            templateId: data.table_name,
            templateName: data.data?.templateName || 'טיוטה',
            customerName: data.data?.customerName || 'לקוח לא ידוע',
            data: data.data,
            updatedAt: data.last_updated || data.updated_at || new Date().toISOString(),
            editingInspectionId: data.data?.editingInspectionId || null,
            isSupabase: true
          };
        }
      } catch (e) {
        console.error('Error fetching draft from Supabase:', e);
      }
    }

    if (!draft) return;

    setLoading(true);
    try {
      const t = await dbService.getFormTemplates();
      const foundTemplate = t.find(tmp => tmp.id === draft.templateId);
      
      if (!foundTemplate) {
        alert("שגיאה: התבנית המקורית לא נמצאה.");
        return;
      }

      // Restore pending parent ID if it exists in the draft data
      // For child forms, the parent ID is in ROWID. For parent forms, it's in ROWID.
      const draftParentId = draft.data?.ROWID;
      if (draftParentId) {
        localStorage.setItem('pendingParentRowId', draftParentId);
      }

      const isAnnual = foundTemplate.formKey.includes('ANNUAL') || foundTemplate.name.includes('שנתית') || foundTemplate.name.includes('Annual');
      const isSemi = foundTemplate.formKey.includes('SEMI') || foundTemplate.name.includes('חצי שנתית');
      setSelectedType(isAnnual ? InspectionType.ANNUAL : (isSemi ? InspectionType.SEMI_ANNUAL : InspectionType.OTHER));
      setTemplate(foundTemplate);
      setInitialValues(draft.data);
      if (draft.data?.pendingChildRecords) {
        setPendingChildRecords(prev => {
          // Merge local state with draft data to prevent losing records during transitions
          const merged: Record<string, any[]> = {};
          
          // Sanitize draft data keys
          Object.keys(draft.data.pendingChildRecords).forEach(table => {
            let sanitizedTable = table;
            if (sanitizedTable === 'כיבויים_הצי_שנתי' || sanitizedTable === 'הצי_שנתי') {
              sanitizedTable = 'כיבויים_חצי_שנתי';
            }
            merged[sanitizedTable] = draft.data.pendingChildRecords[table];
          });

          Object.keys(prev).forEach(table => {
            let sanitizedTable = table;
            if (sanitizedTable === 'כיבויים_הצי_שנתי' || sanitizedTable === 'הצי_שנתי') {
              sanitizedTable = 'כיבויים_חצי_שנתי';
            }
            
            if (!merged[sanitizedTable]) {
              merged[sanitizedTable] = prev[table];
            } else {
              // Add local records that aren't in the draft yet
              const draftIds = new Set(merged[sanitizedTable].map((r: any) => r.id));
              const newLocal = prev[table].filter(r => !draftIds.has(r.id));
              merged[sanitizedTable] = [...merged[sanitizedTable], ...newLocal];
            }
          });
          return merged;
        });
      } else {
        // If no draft records, keep what we have in state (which might be newer)
        // or clear if we are starting fresh (though handleContinueDraft implies we aren't)
      }
      setEditingInspectionId(draft.editingInspectionId || null);
      setActiveDraftId(draft.id);
      setIsAdding(true);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (inspection: Inspection) => {
    if (user.role === UserRole.USER) return;
    setLoading(true);
    try {
      const allT = await dbService.getFormTemplates();
      let t = allT.find(tmp => tmp.name === inspection.templateName);
      if (!t) {
        const formKey = inspection.inspectionType === InspectionType.ANNUAL ? 'ANNUAL_INSPECTION' : 'SEMI_ANNUAL_INSPECTION';
        t = allT.find(tmp => tmp.formKey === formKey);
      }
      
      if (!t || !t.fields || t.fields.length === 0) {
        alert("שגיאה: לא נמצאה תבנית פעילה עבור ביקורת זו.");
        return;
      }

      // TASK: Set pending parent ID for existing record
      const parentRowId = inspection.data?.ROWID || inspection.inspectionSerialNumber || inspection.id;
      localStorage.setItem('pendingParentRowId', parentRowId);

      // Load existing child data into pending state for atomic update
      if (inspection.tempChildData) {
        const restored: Record<string, any[]> = {};
        Object.entries(inspection.tempChildData).forEach(([table, config]: [string, any]) => {
          if (config.records) {
            let sanitizedTable = table;
            if (sanitizedTable === 'כיבויים_הצי_שנתי' || sanitizedTable === 'הצי_שנתי') {
              sanitizedTable = 'כיבויים_חצי_שנתי';
            }
            restored[sanitizedTable] = config.records;
          }
        });
        setPendingChildRecords(restored);
      } else {
        setPendingChildRecords({});
      }

      setSelectedType(inspection.inspectionType);
      setTemplate(t);
      setInitialValues(inspection.data);
      setEditingInspectionId(inspection.id);
      setActiveDraftId(`edit_${inspection.id}_${Date.now()}`);
      setIsAdding(true);
    } catch (err) {
      alert("שגיאה בטעינת הביקורת.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string, serial: string) => {
    if (user.role === UserRole.USER) return;
    setDeleteConfirmation({ id, serial });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    const { id, serial } = deleteConfirmation;
    setLoading(true);
    setDeleteConfirmation(null);
    try {
      await dbService.deleteInspection(id);
      await dbService.logActivity(user.name, 'DELETE_INSPECTION', `נמחקה ביקורת: ${serial}`);
      await loadData();
    } catch (err) {
      alert("שגיאה במחיקת הביקורת.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: Record<string, any>) => {
    let targetTable = template?.tableName || 'inspections';
    // FIX TYPO: Ensure the correct table name is used for the JSON key and database table
    if (targetTable === 'כיבויים_הצי_שנתי' || targetTable === 'הצי_שנתי') {
      targetTable = 'כיבויים_חצי_שנתי';
    }
    
    const isChildForm = !!localStorage.getItem('returnToDraftId');
    
    if (isChildForm) {
      // TASK 1.1: Save Child to local temporary state instead of DB
      console.log(`[Local Save] Saving child record for table: ${targetTable}`);
      let parentRowId = localStorage.getItem('pendingParentRowId');
      
      // Fallback: Try to get from the data itself (ROWID)
      if (!parentRowId && data.ROWID) {
        parentRowId = data.ROWID;
        localStorage.setItem('pendingParentRowId', parentRowId);
      }

      // Validation: Allow saving if a Temporary ID exists
      if (!parentRowId) {
        alert("שגיאה: לא נמצא מזהה רשומה עליונה. אנא וודא שהרשומה העליונה נפתחה כראוי.");
        return;
      }

      const newChildRecord = {
        ...data,
        parent_id: parentRowId, // Rule C: Link to parent using parent_id
        ROWID: data.ROWID || `local_${Date.now()}`, // Ensure child has its own ID for potential grandchildren
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        _is_pending: true,
        _target_table: targetTable
      };

      const updatedPending = {
        ...pendingChildRecords,
        [targetTable]: [...(pendingChildRecords[targetTable] || []), newChildRecord]
      };
      
      setPendingChildRecords(updatedPending);

      // TASK: Update the parent draft in Supabase immediately so child data isn't lost on reload
      const returnDraftId = localStorage.getItem('returnToDraftId');
      if (returnDraftId) {
        try {
          const { data: draft } = await supabase.from('inspection_drafts').select('data').eq('id', returnDraftId).single();
          if (draft) {
            await supabase.from('inspection_drafts').update({
              data: {
                ...draft.data,
                pendingChildRecords: updatedPending
              }
            }).eq('id', returnDraftId);
          }
        } catch (e) {
          console.error('[Draft Sync] Failed to update parent draft with child data:', e);
        }
      }

      // Update local summary for UI display in DynamicForm
      const summaryKey = `summary_${parentRowId}`;
      const existing = JSON.parse(localStorage.getItem(summaryKey) || '[]');
      localStorage.setItem(summaryKey, JSON.stringify([...existing, {
        ...newChildRecord,
        templateName: template?.name || 'נתוני טופס',
        inspectionSerialNumber: 'טיוטה מקומית',
        inspectionDate: new Date().toLocaleDateString('he-IL')
      }]));

      // Return to parent form
      localStorage.removeItem('returnToDraftId');
      if (returnDraftId) {
        await handleContinueDraft(returnDraftId);
      } else {
        setIsAdding(false);
      }
      return;
    }

    // TASK 1.2: Final Save on Parent Form (Atomic Single-Trip)
    console.log(`Initiating Atomic Final Save... Target Table: ${targetTable}`);
    setSavingStatus(`שומר נתונים באופן אטומי...`);
    setLoading(true);
    
    try {
      const tempParentId = localStorage.getItem('pendingParentRowId');
      let finalData = { ...data };
      
      // Generate or retrieve serial number
      let serial = data.inspectionSerialNumber || data.serial_number;
      if (!serial) {
        serial = await dbService.generateInspectionSerialNumber(selectedType, template?.tableName);
      }

      // Sync TEMP ID to real serial
      if (tempParentId && String(finalData.ROWID).startsWith('TEMP_') && finalData.ROWID === tempParentId && serial) {
        finalData.ROWID = serial;
      }

      // Bundle Child Data for the Trigger using Recursive Nesting
      const bundledChildData = nestChildRecords(pendingChildRecords, tempParentId || '');

      // Execute Atomic Save
      const saveResult = editingInspectionId 
        ? await dbService.updateInspection(editingInspectionId, {
            customerId: data.customerId || '',
            technicianId: user.id,
            inspectionDate: new Date().toISOString().split('T')[0],
            data: finalData
          }, targetTable, bundledChildData)
        : await dbService.addInspection({
            inspectionSerialNumber: serial,
            inspectionType: selectedType,
            templateName: template?.name,
            customerId: data.customerId || '',
            technicianId: user.id,
            inspectionDate: new Date().toISOString().split('T')[0],
            status: InspectionStatus.SUBMITTED,
            data: finalData
          }, targetTable, bundledChildData);

      const parentData = Array.isArray(saveResult) ? saveResult[0] : saveResult;
      const parentFriendlyId = parentData.ROWID || parentData.serial_number || parentData.inspectionSerialNumber || parentData.id;

      // Cleanup session data
      localStorage.removeItem('pendingParentRowId');
      localStorage.removeItem('parentFormData');
      if (tempParentId) {
        localStorage.removeItem(`summary_${tempParentId}`);
      }

      // Delete the temporary skeleton record if it exists
      if (tempParentId && tempParentId.startsWith('TEMP_')) {
        try {
          await dbService.supabaseAdmin.from(targetTable).delete().eq('ROWID', tempParentId);
        } catch (cleanupErr) {}
      }

      await dbService.logActivity(user.name, 'CREATE_INSPECTION', `נוצרה ביקורת אטומית: ${parentFriendlyId}`);
      
      // Trigger Automation Bots
      dbService.triggerBots(targetTable, parentFriendlyId, 'ADDS');

      if (typeof (window as any).triggerAppsScript === 'function') {
        (window as any).triggerAppsScript(parentFriendlyId);
      }

      alert(`הנתונים נשמרו בהצלחה (שמירה אטומית)!`);
      setSavingStatus(null);
      setIsAdding(false);
      setEditingInspectionId(null);
      setPendingChildRecords({});
      
      const url = new URL(window.location.href);
      url.searchParams.delete('parentRowId');
      window.history.pushState({}, '', url.toString());
      
      await loadData(targetTable);
    } catch (err: any) {
      console.error(`Error in atomic save:`, err);
      alert(`שגיאה בשמירת הנתונים: ${err.message || 'שגיאה לא ידועה'}`);
      setSavingStatus(null);
    } finally {
      setLoading(false);
    }
  };

  // Production Fix: Normalize contextData keys to ensure formulas using different casing (e.g. customer_number vs customerNumber) work correctly.
  const contextData = React.useMemo(() => ({
    ...dynamicTableData,
    Customers: customers.map(c => {
      let nObj: Record<string, any> = {}; 
      try { nObj = JSON.parse(c.notes || '{}'); } catch{}
      return { 
        ...nObj, 
        id: c.id, 
        customerNumber: c.customerNumber, 
        customer_number: c.customerNumber, // Alias for Excel-imported formulas
        name: c.name, 
        address: c.address,
        city: c.city,
        contactName: c.contactName,
        contactPhone: c.contactPhone
      };
    }),
    Users: users.map(u => ({ 
      id: u.id, 
      name: u.name, 
      email: u.email, 
      role: u.role 
    }))
  }), [customers, users, dynamicTableData]);

  // Memoize the combined template to prevent referential changes triggering unnecessary re-renders in DynamicForm
  const fullTemplate = React.useMemo(() => {
    if (!template) return null;
    const isFireSafety = template.name.includes('כיבויים');
    const fields = [...(template.fields || [])];
    
    if (!isFireSafety) {
      fields.unshift({ 
        id: 'sys_customer', 
        formTemplateId: template.id, 
        fieldKey: 'customerId', 
        label: 'בחר לקוח', 
        fieldType: FieldType.SELECT, 
        isRequired: true, 
        orderIndex: -100, 
        options: customers.map(c => ({ value: c.id, label: `${c.name} (${c.customerNumber})` })),
        manualOptions: [] as string[]
      });
    }

    return {
      ...template,
      fields
    };
  }, [template, customers]);

  if (isAdding && fullTemplate && activeDraftId) {
    return (
      <div className="bg-white p-6 rounded-3xl border shadow-sm max-w-4xl mx-auto animate-in zoom-in duration-300">
        {savingStatus && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl font-bold animate-pulse">
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={18} />
              {savingStatus}
            </div>
          </div>
        )}
        <DynamicForm 
          key={activeDraftId} 
          template={fullTemplate} 
          initialValues={initialValues} 
          pendingChildRecords={pendingChildRecords}
          onSubmit={handleCreate} 
          onCancel={() => { 
            const isFireSafety = template?.name?.includes('כיבויים');
            if (isFireSafety) {
              window.history.back();
              const returnDraftId = localStorage.getItem('returnToDraftId');
              if (returnDraftId) {
                handleContinueDraft(returnDraftId);
                localStorage.removeItem('returnToDraftId');
              } else {
                setIsAdding(false);
              }
            } else {
              setIsAdding(false); 
              const url = new URL(window.location.href);
              url.searchParams.delete('parentRowId');
              window.history.pushState({}, '', url.toString());
              loadDrafts(); 
            }
          }} 
          onSwitchDraft={handleContinueDraft} 
          onAction={async (type, payload) => {
            if (type === 'REDIRECT_FORM') {
              localStorage.setItem('returnToDraftId', activeDraftId);
              const { field, currentData, targetFormId } = payload as any;
              
              // Step 1 (The Check): Robustly find the target ID
              let targetId = targetFormId || 
                             field?.navigation_config?.targetFormId || 
                             field?.targetFormId || 
                             (field?.options as any)?.targetFormId ||
                             (field?.options as any)?.targetTemplateId;

              // Fallback logic if no explicit ID found
              if (!targetId) {
                 const extTemplate = availableTemplates.find(t => 
                   t.name.includes('מטפים') || t.name.includes('Extinguisher')
                 );
                 if (extTemplate) targetId = extTemplate.id;
              }

              if (!targetId) {
                 alert('תבנית יעד לא הוגדרה עבור כפתור זה.');
                 return;
              }

              // Step 2 (The Storage - ONLY ON CLICK)
              if (currentData) {
                localStorage.setItem('parentFormData', JSON.stringify(currentData));
              }

              // Try to find ANY valid ID
              const recordId = currentData?.ROWID || 
                               currentData?.id || 
                               currentData?.inspectionSerialNumber || 
                               currentData?._id ||
                               // Sometimes ID might be at the root if currentData is nested
                               (payload as any)?.id;
              
              if (recordId) {
                localStorage.setItem('pendingParentRowId', recordId);
                
                // Also update URL for consistency
                const url = new URL(window.location.href);
                url.searchParams.set('parentRowId', recordId);
                window.history.pushState({}, '', url.toString());
              }

              // Step 3 (The Navigation)
              handleStartNew(InspectionType.OTHER, targetId);
            }
          }}
          contextData={contextData} 
          currentUser={user} 
          draftId={activeDraftId} 
          editingInspectionId={editingInspectionId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 md:p-6 rounded-3xl border shadow-sm gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="חיפוש ביקורת..." className="w-full pr-12 pl-4 py-3 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold min-h-[44px]" />
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {availableTemplates.length > 0 ? (
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {availableTemplates.filter(t => t.navigation_config?.showAsButton).map(t => (
                <button 
                  key={t.id}
                  onClick={() => {
                    const isAnnual = t.formKey.includes('ANNUAL') || t.name.includes('שנתית') || t.name.includes('Annual');
                    const isSemi = t.formKey.includes('SEMI') || t.name.includes('חצי שנתית');
                    handleStartNew(isAnnual ? InspectionType.ANNUAL : (isSemi ? InspectionType.SEMI_ANNUAL : InspectionType.OTHER), t.id);
                  }} 
                  className="flex-1 md:flex-none px-4 md:px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs md:text-sm hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-2 active:scale-95 min-h-[44px]"
                >
                  <Plus size={18} /> <span className="truncate">{t.name}</span>
                </button>
              ))}
              {availableTemplates.filter(t => !t.navigation_config?.showAsButton).length > 0 && (
                <select 
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const t = availableTemplates.find(tmp => tmp.id === e.target.value);
                    if (t) {
                      const isAnnual = t.formKey.includes('ANNUAL') || t.name.includes('שנתית') || t.name.includes('Annual');
                      const isSemi = t.formKey.includes('SEMI') || t.name.includes('חצי שנתית');
                      handleStartNew(isAnnual ? InspectionType.ANNUAL : (isSemi ? InspectionType.SEMI_ANNUAL : InspectionType.OTHER), t.id);
                    }
                    e.target.value = "";
                  }}
                  className="flex-1 md:flex-none px-4 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-xs md:text-sm outline-none border-none min-h-[44px]"
                  defaultValue=""
                >
                  <option value="" disabled>ביקורות נוספות...</option>
                  {availableTemplates.filter(t => !t.navigation_config?.showAsButton).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button onClick={() => handleStartNew(InspectionType.SEMI_ANNUAL)} className="flex-1 md:flex-none px-4 md:px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-xs md:text-sm hover:bg-slate-200 transition-all active:scale-95 min-h-[44px]">ביקורת חצי שנתית</button>
              <button onClick={() => handleStartNew(InspectionType.ANNUAL)} className="flex-1 md:flex-none px-4 md:px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs md:text-sm hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-2 active:scale-95 min-h-[44px]"><Plus size={18} /> ביקורת שנתית</button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {drafts.length > 0 && (
          <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 px-1"><Clock size={20} className="text-orange-500"/> טיוטות פתוחות</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {drafts.map(draft => (
                <div key={draft.id} className="bg-white p-6 rounded-3xl border shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-full -mr-12 -mt-12 opacity-50" />
                   <div className="flex justify-between items-start mb-4 relative z-10">
                     <span className="text-[10px] font-black uppercase text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">טיוטה פעילה</span>
                     <button onClick={async () => { 
                       if (draft.isSupabase) {
                         try {
                           await supabase.from('inspection_drafts').delete().eq('id', draft.id);
                           loadDrafts();
                         } catch (e) { console.error('Error deleting draft', e); }
                       }
                     }} className="text-slate-300 hover:text-red-600 transition-all"><Trash2 size={18} /></button>
                   </div>
                   <h4 className="text-lg font-black text-slate-800 mb-2 truncate relative z-10">{draft.templateName}</h4>
                   <div className="space-y-2 mb-4 relative z-10">
                      <div className="flex items-center gap-2 text-slate-600"><Building size={14}/><span className="text-sm font-bold truncate">{draft.customerName}</span></div>
                      <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black"><Clock size={12}/>{new Date(draft.updatedAt).toLocaleString('he-IL')}</div>
                   </div>
                   <button onClick={() => handleContinueDraft(draft.id)} className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 relative z-10 active:scale-95"><Zap size={16} /> המשך מילוי</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 md:p-6 bg-slate-50/50 border-b flex items-center gap-2"><ClipboardList className="text-blue-600" size={20} /><h3 className="font-black text-slate-800">היסטוריית ביקורות</h3></div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto scrollbar-thin">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b"><tr><th className="p-4">מס' ביקורת</th><th className="p-4">לקוח</th><th className="p-4">תאריך</th><th className="p-4">סטטוס</th><th className="p-4 text-center">פעולות</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {inspections.map(i => (
                  <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono font-bold text-blue-600">{i.inspectionSerialNumber}</td>
                    <td className="p-4 font-bold text-slate-700">{(customers.find(c => c.id === i.customerId))?.name || '---'}</td>
                    <td className="p-4 text-slate-500 font-medium">{i.inspectionDate}</td>
                    <td className="p-4"><span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase">בוצע</span></td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-2 text-slate-300 hover:text-blue-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" title="צפייה">
                          <Eye size={18} />
                        </button>
                        {user.role !== UserRole.USER && (
                          <>
                            <button onClick={() => handleEdit(i)} className="p-2 text-slate-300 hover:text-emerald-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" title="עריכה">
                              <Edit2 size={18} />
                            </button>
                            <button onClick={() => handleDelete(i.id, i.inspectionSerialNumber)} className="p-2 text-slate-300 hover:text-red-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" title="מחיקה">
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {inspections.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-400 font-bold italic">לא נמצאו ביקורות במערכת</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100">
            {inspections.map(i => (
              <div key={i.id} className="p-4 space-y-3 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-800 text-base">{(customers.find(c => c.id === i.customerId))?.name || '---'}</h4>
                    <p className="font-mono font-bold text-blue-600 text-sm mt-1">{i.inspectionSerialNumber}</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase">בוצע</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-1 text-slate-500 text-xs font-medium">
                    <Calendar size={14} />
                    {i.inspectionDate}
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-50 rounded-lg" title="צפייה">
                      <Eye size={18} />
                    </button>
                    {user.role !== UserRole.USER && (
                      <>
                        <button onClick={() => handleEdit(i)} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-50 rounded-lg" title="עריכה">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(i.id, i.inspectionSerialNumber)} className="p-2 text-slate-400 hover:text-red-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-50 rounded-lg" title="מחיקה">
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {inspections.length === 0 && (
              <div className="p-12 text-center text-slate-400 font-bold italic">לא נמצאו ביקורות במערכת</div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirmation && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">האם אתה בטוח?</h3>
            <p className="text-slate-500 font-bold mb-8">האם אתה בטוח שברצונך למחוק את ביקורת {deleteConfirmation.serial}? פעולה זו אינה ניתנת לביטול.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmation(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all">ביטול</button>
              <button onClick={confirmDelete} className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 shadow-lg shadow-red-100 transition-all">כן, מחק</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inspections;
