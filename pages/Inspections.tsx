import React from 'react';
import { Inspection, InspectionType, InspectionStatus, Customer, User, UserRole, FormTemplate, FieldType } from '../types';
import { waitUntilReady } from '../src/lib/connectionGuard';
import { dbService } from '../services/dbService';
import { nestChildRecords } from '../utils/dataUtils';
import { generateUUID, generateROWID } from '../src/utils/idGenerators';
import { supabase } from '../src/lib/supabase';
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
      const ready = await waitUntilReady();
      if (!ready) {
          console.warn('[Inspections] Connection not ready, loading from local cache.');
      }

      const [allI, allC, allU, allT] = await Promise.all([
        dbService.getInspections(),
        dbService.getCustomers(),
        dbService.getUsers(),
        dbService.getFormTemplates()
      ]);
      const filtered = user.role === UserRole.USER ? allI.filter(i => i.technicianId === user.id) : allI;
      setInspections(filtered);
      setCustomers(allC);
      setUsers(allU);
      setAvailableTemplates(allT.filter(t => t.isActive));
      
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
      const data = await dbService.getInspectionDrafts(user.id);
        
      let allDrafts: any[] = [];
      if (data) {
        allDrafts = data
          .map(d => ({
            id: d.id || d.ROWID,
            templateId: d.table_name,
            templateName: d.data?.templateName || 'טיוטה',
            customerName: d.data?.customerName || 'לקוח לא ידוע',
            data: d.data,
            updatedAt: d.last_updated || d.updated_at || new Date().toISOString(),
            editingInspectionId: d.data?.editingInspectionId || null,
            isSupabase: true
          }))
          .filter(d => !d.templateName.startsWith('עדכון טבלת'));
      }

      allDrafts = allDrafts.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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

      if (!isAdding) {
        localStorage.removeItem('returnToDraftId');
      }
      const isChildNavigation = !!localStorage.getItem('returnToDraftId');
      const newInitialValues: Record<string, any> = { technicianId: user.id };

      t.fields.forEach(field => {
        const formula = (field.calculationFormula || field.defaultValue || '').toUpperCase();
        if (formula.includes('UNIQUEID()')) {
          newInitialValues[field.fieldKey] = Math.random().toString(36).substring(2, 11).toUpperCase();
        } else if (formula.includes('UNIQUEID_V4()')) {
          newInitialValues[field.fieldKey] = crypto.randomUUID().toUpperCase();
        }
      });

      if (!newInitialValues['id']) {
        newInitialValues['id'] = generateUUID();
      }
      
      if (!newInitialValues['ROWID']) {
        newInitialValues['ROWID'] = generateROWID();
      }

      if (!isChildNavigation) {
        localStorage.removeItem('pendingParentRowId');
        localStorage.removeItem('parentFormData');
        
        localStorage.setItem('pendingParentRowId', newInitialValues['id']);
        
        setPendingChildRecords({});

        const url = new URL(window.location.href);
        if (url.searchParams.has('parentRowId')) {
          url.searchParams.delete('parentRowId');
          window.history.pushState({}, '', url.toString());
        } else if (url.hash.includes('parentRowId=')) {
          const [hashPath, hashQuery] = url.hash.split('?');
          if (hashQuery) {
            const hashParams = new URLSearchParams(hashQuery);
            hashParams.delete('parentRowId');
            const newHash = hashParams.toString() ? `${hashPath}?${hashParams.toString()}` : hashPath;
            url.hash = newHash;
            window.history.pushState({}, '', url.toString());
          }
        }
      }

      setSelectedType(type);
      setTemplate(null);
      setInitialValues({});
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
    
    draft = drafts.find(d => d.id === draftId);
    
    if (!draft) {
      try {
        const allDrafts = await dbService.getInspectionDrafts(user.id);
        
        let data = null;
        if (draftId.startsWith('insp_')) {
          const parts = draftId.split('_');
          if (parts.length >= 2) {
            const templateId = parts[1];
            data = allDrafts.find(d => d.table_name === templateId);
          } else {
            return;
          }
        } else {
          data = allDrafts.find(d => d.id === draftId);
        }

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
        console.error('Error fetching draft:', e);
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

      const draftParentId = draft.data?.id || draft.data?.ROWID;
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
          const merged: Record<string, any[]> = {};
          
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
              const draftIds = new Set(merged[sanitizedTable].map((r: any) => r.id));
              const newLocal = prev[table].filter(r => !draftIds.has(r.id));
              merged[sanitizedTable] = [...merged[sanitizedTable], ...newLocal];
            }
          });
          return merged;
        });
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

      const parentRowId = inspection.id || inspection.data?.id || inspection.data?.ROWID || inspection.inspectionSerialNumber;
      localStorage.setItem('pendingParentRowId', parentRowId);

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
    // Ensure timestamps are formatted for Supabase
    const now = new Date().toISOString();
    const fieldsToUpdate = ['created_at', 'last_modified_client', 'updated_at'];
    const processedData = { ...data };
    fieldsToUpdate.forEach(field => {
      if (!processedData[field] || processedData[field] === "") {
        processedData[field] = now;
      }
    });

    let targetTable = template?.tableName || 'inspections';
    if (targetTable === 'כיבויים_הצי_שנתי' || targetTable === 'הצי_שנתי') {
      targetTable = 'כיבויים_חצי_שנתי';
    }
    
    const isChildForm = !!localStorage.getItem('returnToDraftId');
    
    if (isChildForm) {
      console.log(`[Local Save] Saving child record for table: ${targetTable}`);
      let parentRowId = localStorage.getItem('pendingParentRowId');
      
      if (!parentRowId && (processedData.id || processedData.ROWID)) {
        parentRowId = processedData.id || processedData.ROWID;
        localStorage.setItem('pendingParentRowId', parentRowId);
      }

      if (!parentRowId) {
        alert("שגיאה: לא נמצא מזהה רשומה עליונה. אנא וודא שהרשומה העליונה נפתחה כראוי.");
        return;
      }

      const resolvedCustomerId = processedData.customer_id || processedData.customerId || localStorage.getItem('lastActiveCustomerId');
      
      const newChildRecord = {
        ...processedData,
        parent_id: parentRowId,
        customer_id: resolvedCustomerId,
        customerId: resolvedCustomerId,
        ROWID: processedData.ROWID || generateROWID(),
        id: processedData.id || generateUUID(),
        created_at: new Date().toISOString(),
        _is_pending: true,
        _target_table: targetTable
      };

      const updatedPending = {
        ...pendingChildRecords,
        [targetTable]: [...(pendingChildRecords[targetTable] || []), newChildRecord]
      };
      
      setPendingChildRecords(updatedPending);

      const returnDraftId = localStorage.getItem('returnToDraftId');
      if (returnDraftId) {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const parentRowIdFromUrl = urlParams.get('parentRowId');
          
          const drafts = await dbService.getInspectionDrafts(user.id);
          const draft = drafts.find(d => d.id === returnDraftId || d.data?.id === parentRowIdFromUrl);
          
          if (draft) {
            const finalCustomerId = resolvedCustomerId || draft.data.customer_id || draft.data.customerId;
            if (!finalCustomerId) {
                console.warn("[Child Save] customer_id is missing! Context restoration failed.");
                alert("שגיאה: מזהה לקוח חסר. לא ניתן לשמור את הרשומה.");
                return;
            }

            let tempChildData = [];
            try {
              const existingData = draft.data?.TEMP_CHILD_DATA;
              if (typeof existingData === 'string') {
                tempChildData = JSON.parse(existingData);
              } else if (Array.isArray(existingData)) {
                tempChildData = existingData;
              }
            } catch (e) {
              console.warn('[Draft Sync] Failed to parse existing TEMP_CHILD_DATA, starting fresh');
            }

            const updatedTempChildData = [...tempChildData, {
              ...newChildRecord,
              customer_id: finalCustomerId,
              customerId: finalCustomerId,
              templateName: template?.name || 'נתוני טופס',
              inspectionSerialNumber: 'טיוטה מקומית',
              inspectionDate: new Date().toLocaleDateString('he-IL')
            }];

            await dbService.saveInspectionDraft({
              ...draft,
              data: {
                ...draft.data,
                customer_id: finalCustomerId,
                customerId: finalCustomerId,
                pendingChildRecords: updatedPending,
                // ✅ שמור גם uppercase וגם lowercase כדי לכסות את שני המקרים
                TEMP_CHILD_DATA: updatedTempChildData,
                temp_child_data: JSON.stringify(updatedTempChildData)
              }
            });

            if (parentRowId) {
              localStorage.setItem(`summary_${parentRowId}`, JSON.stringify(updatedTempChildData));
            }
          }
        } catch (e) {
          console.error('[Draft Sync] Failed to update parent draft with child data:', e);
        }
      }

      return;
    }

    console.log(`Initiating Atomic Final Save... Target Table: ${targetTable}`);
    setSavingStatus(`שומר נתונים באופן אטומי...`);
    setLoading(true);
    
    try {
      const tempParentId = localStorage.getItem('pendingParentRowId');
      // Inject Status: 'סיום' to ensure bots recognize this as a final save
      let finalData = { ...processedData, Status: 'סיום', status: 'סיום' };
      
      let serial = processedData.inspectionSerialNumber || processedData.serial_number;
      if (!serial) {
        serial = await dbService.generateInspectionSerialNumber(selectedType, template?.tableName);
      }

      const bundledChildData = nestChildRecords(pendingChildRecords, tempParentId || '');

      const saveResult = editingInspectionId 
        ? await dbService.updateInspection(editingInspectionId, {
            customerId: processedData.customerId || '',
            technicianId: user.id,
            inspectionDate: new Date().toISOString().split('T')[0],
            data: finalData
          }, targetTable, bundledChildData)
        : await dbService.addInspection({
            inspectionSerialNumber: serial,
            inspectionType: selectedType,
            templateName: template?.name,
            customerId: processedData.customerId || '',
            technicianId: user.id,
            inspectionDate: new Date().toISOString().split('T')[0],
            status: InspectionStatus.SUBMITTED,
            data: finalData
          }, targetTable, bundledChildData);

      const parentData = Array.isArray(saveResult) ? saveResult[0] : saveResult;
      const parentFriendlyId = parentData.ROWID || parentData.serial_number || parentData.inspectionSerialNumber || parentData.id;

      localStorage.removeItem('pendingParentRowId');
      localStorage.removeItem('parentFormData');
      if (tempParentId) {
        localStorage.removeItem(`summary_${tempParentId}`);
      }

      await dbService.logActivity(user.name, 'CREATE_INSPECTION', `נוצרה ביקורת אטומית: ${parentFriendlyId}`);

      if (navigator.onLine && typeof (window as any).triggerAppsScript === 'function') {
        (window as any).triggerAppsScript(parentFriendlyId);
      }

      if (activeDraftId) {
        try {
          const drafts = await dbService.getInspectionDrafts(user.id);
          const draftToDelete = drafts.find(d => 
            d.id === activeDraftId || d.table_name === template?.id
          );
          if (draftToDelete) {
            await dbService.deleteInspectionDraft(draftToDelete.id);
          }
        } catch (cleanupErr) {
          console.error('Error deleting draft after save:', cleanupErr);
        }
      }

      alert(`הנתונים נשמרו בהצלחה (שמירה אטומית)!`);
      setSavingStatus(null);
      setIsAdding(false);
      setEditingInspectionId(null);
      setInitialValues({});
      setTemplate(null); 
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

  const contextData = React.useMemo(() => ({
    ...dynamicTableData,
    Customers: customers.map(c => {
      let nObj: Record<string, any> = {}; 
      try { nObj = JSON.parse(c.notes || '{}'); } catch{}
      return { 
        ...nObj, 
        id: c.id, 
        customerNumber: c.customerNumber, 
        customer_number: c.customerNumber,
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

  // ============================================================
  // handleReturnToParent — חזרה לטופס האב לאחר onAction של REDIRECT_FORM
  // מטופל כאן ב-Inspections.tsx ולא ב-DynamicForm
  // ============================================================
  const handleReturnToParent = React.useCallback(async (templateId: string, rowId: string) => {
  console.log("Navigating BACK to parent. Template:", templateId, "Row:", rowId);

  const url = new URL(window.location.href);
  url.searchParams.delete('parentRowId');
  url.searchParams.delete('parentTemplateId');
  window.history.replaceState({}, '', url.toString());

  localStorage.removeItem('returnToDraftId');
  localStorage.removeItem('parentFormData');
  localStorage.removeItem('pendingParentRowId');
  localStorage.removeItem('pendingParentTemplateId');

  try {
    const allDrafts = await dbService.getInspectionDrafts(user.id);
    
    const parentDraft = allDrafts.find(d => 
      d.data?.id === rowId || 
      d.data?.ROWID === rowId || 
      d.table_name === templateId
    );

    if (parentDraft) {
      console.log("Found parent draft with TEMP_CHILD_DATA:", parentDraft.data?.TEMP_CHILD_DATA);
      await handleContinueDraft(parentDraft.id);
      return;
    }
  } catch (e) {
    console.error("Error finding parent draft:", e);
  }

  // אם לא נמצאה טיוטה — פתח את התבנית עם ה-rowId כ-initialValues
  console.log("No parent draft found, loading template directly:", templateId);
  await handleStartNew(InspectionType.OTHER, templateId);
}, [user.id]);

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
            const returnDraftId = localStorage.getItem('returnToDraftId');
            localStorage.removeItem('returnToDraftId');
            localStorage.removeItem('parentFormData');
            localStorage.removeItem('pendingParentRowId');
            
            if (isFireSafety) {
              window.history.back();
              if (returnDraftId) {
                handleContinueDraft(returnDraftId);
              } else {
                setIsAdding(false);
              }
            } else {
              if (returnDraftId) {
                handleContinueDraft(returnDraftId);
              } else {
                setIsAdding(false); 
                const url = new URL(window.location.href);
                if (url.searchParams.has('parentRowId')) {
                  url.searchParams.delete('parentRowId');
                  window.history.pushState({}, '', url.toString());
                } else if (url.hash.includes('parentRowId=')) {
                  const [hashPath, hashQuery] = url.hash.split('?');
                  if (hashQuery) {
                    const hashParams = new URLSearchParams(hashQuery);
                    hashParams.delete('parentRowId');
                    const newHash = hashParams.toString() ? `${hashPath}?${hashParams.toString()}` : hashPath;
                    url.hash = newHash;
                    window.history.pushState({}, '', url.toString());
                  }
                }
                loadDrafts(); 
              }
            }
          }} 
          onSwitchDraft={handleContinueDraft} 
          onAction={async (type, payload) => {
            const EXIT_ACTION_TYPES = ['CANCEL', 'SAVE_REVIEW'];

            if (EXIT_ACTION_TYPES.includes(type)) {
              const parentRowId = payload?.parentRowId || localStorage.getItem('pendingParentRowId');
              const parentTemplateId = payload?.parentTemplateId || localStorage.getItem('pendingParentTemplateId');

              if (parentRowId && parentTemplateId) {
                console.log(`!!! FORCE REDIRECT DETECTED !!! Action: ${type}. Returning to parent: ${parentRowId}`);
                await handleReturnToParent(parentTemplateId, parentRowId);
                return;
              }

              // Fallback if no parent info found - use same logic as onCancel
              const isFireSafety = template?.name?.includes('כיבויים');
              const returnDraftId = localStorage.getItem('returnToDraftId');
              localStorage.removeItem('returnToDraftId');
              localStorage.removeItem('parentFormData');
              localStorage.removeItem('pendingParentRowId');
              localStorage.removeItem('pendingParentTemplateId');
              
              if (isFireSafety) {
                window.history.back();
                if (returnDraftId) {
                  handleContinueDraft(returnDraftId);
                } else {
                  setIsAdding(false);
                }
              } else {
                if (returnDraftId) {
                  handleContinueDraft(returnDraftId);
                } else {
                  setIsAdding(false); 
                  const url = new URL(window.location.href);
                  if (url.searchParams.has('parentRowId')) {
                    url.searchParams.delete('parentRowId');
                    window.history.pushState({}, '', url.toString());
                  }
                  loadDrafts(); 
                }
              }
              return;
            }

            if (type === 'REDIRECT_FORM') {
              const { templateId, rowId, targetFormId, field, currentData, parentRowId } = payload as any;

              // ============================================================
              // פתיחת טופס בן
              // LINK_BUTTON או navigation_config שולחים targetFormId
              // ============================================================
              localStorage.setItem('returnToDraftId', activeDraftId);
              
              let targetId = targetFormId || 
                             field?.navigation_config?.targetFormId || 
                             field?.targetFormId || 
                             (field?.options as any)?.targetFormId ||
                             (field?.options as any)?.targetTemplateId;

              if (!targetId) {
                 const extTemplate = availableTemplates.find(t => 
                   t.name.includes('מטפים') || t.name.includes('Extinguisher')
                 );
                 if (extTemplate) targetId = extTemplate.id;
              }

              if (!targetId) {
                 console.error("REDIRECT_FORM: no targetFormId and no templateId+rowId", payload);
                 alert('תבנית יעד לא הוגדרה עבור כפתור זה.');
                 return;
              }

              // שמור נתוני האב לפני מעבר לבן
              if (currentData) {
                // Ensure timestamps are formatted for Supabase
                const now = new Date().toISOString();
                const fieldsToUpdate = ['created_at', 'last_modified_client', 'updated_at'];
                const processedCurrentData = { ...currentData };
                fieldsToUpdate.forEach(field => {
                  if (!processedCurrentData[field] || processedCurrentData[field] === "") {
                    processedCurrentData[field] = now;
                  }
                });

                localStorage.setItem('parentFormData', JSON.stringify(processedCurrentData));
                if (processedCurrentData.customer_id) {
                    localStorage.setItem('lastActiveCustomerId', processedCurrentData.customer_id);
                }
                
                if (activeDraftId) {
                    const draft = drafts.find(d => d.id === activeDraftId);
                    if (draft) {
                        await dbService.saveInspectionDraft({
                            ...draft,
                            data: { ...draft.data, ...processedCurrentData }
                        });
                    }
                }
              }

              const recordId = currentData?.id || 
                               currentData?.ROWID || 
                               currentData?.inspectionSerialNumber || 
                               currentData?._id ||
                               (payload as any)?.id;
              
              if (recordId) {
                localStorage.setItem('pendingParentRowId', recordId);
                
                const url = new URL(window.location.href);
                url.searchParams.set('parentRowId', recordId);
                window.history.pushState({}, '', url.toString());
              }

              console.log("REDIRECT_FORM → opening child form. Template:", targetId);
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
                           await dbService.deleteInspectionDraft(draft.id);
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