
import React from 'react';
import { Inspection, InspectionType, InspectionStatus, Customer, User, UserRole, FormTemplate, FieldType } from '../types';
import { dbService } from '../services/dbService';
import { supabase } from '../services/supabaseClient';
import { Plus, Search, Eye, Edit2, Loader2, ClipboardList, Clock, Trash2, Zap, Building, CreditCard, Fingerprint, FileCheck } from 'lucide-react';
import DynamicForm from '../components/DynamicForm';

interface CertificatesProps {
  user: User;
}

const Certificates: React.FC<CertificatesProps> = ({ user }) => {
  const GLOBAL_DRAFTS_KEY = `inspection_drafts`;
  
  const [loading, setLoading] = React.useState(true);
  const [inspections, setInspections] = React.useState<Inspection[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [availableTemplates, setAvailableTemplates] = React.useState<FormTemplate[]>([]);
  const [dynamicTableData, setDynamicTableData] = React.useState<Record<string, any[]>>({});
  const [drafts, setDrafts] = React.useState<any[]>([]);
  
  const [activeDraftId, setActiveDraftId] = React.useState<string | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const [selectedType, setSelectedType] = React.useState<InspectionType>(InspectionType.ANNUAL);
  const [template, setTemplate] = React.useState<FormTemplate | null>(null);
  const [initialValues, setInitialValues] = React.useState<Record<string, any>>({});

  React.useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allI, allC, allU, allT] = await Promise.all([
        dbService.getInspections(),
        dbService.getCustomers(),
        dbService.getUsers(),
        dbService.getFormTemplates()
      ]);
      const filtered = user.role === UserRole.USER ? allI.filter(i => i.technicianId === user.id) : allI;
      // Filter only inspections whose template name starts with "אישור"
      setInspections(filtered.filter(i => i.templateName?.startsWith('אישור')));
      setCustomers(allC);
      setUsers(allU);
      setAvailableTemplates(allT.filter(t => t.name.startsWith('אישור')));
      
      // Fetch dynamic table data for formulas (LOOKUPs to Excel-imported tables)
      await fetchDynamicSchema();
      
      loadDrafts();
    } catch (err) { } finally { setLoading(false); }
  };

  const fetchDynamicSchema = async () => {
    try {
      const dtd = await dbService.getDynamicSchema(user.name);
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
          id: d.id,
          templateId: d.table_name,
          templateName: d.data?.templateName || 'טיוטה',
          customerName: d.data?.customerName || 'לקוח לא ידוע',
          data: d.data,
          updatedAt: d.last_updated || d.updated_at || new Date().toISOString(),
          editingInspectionId: d.data?.editingInspectionId || null,
          isSupabase: true
        }));
      }

      const saved = localStorage.getItem(GLOBAL_DRAFTS_KEY);
      const localDrafts = saved ? JSON.parse(saved) : [];
      
      const allDrafts = [...supabaseDrafts, ...localDrafts]
        .filter((d: any) => d.templateName?.startsWith('אישור'))
        .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        
      setDrafts(allDrafts);
    } catch (err) {
      console.error('Error loading drafts:', err);
      const saved = localStorage.getItem(GLOBAL_DRAFTS_KEY);
      if (!saved) {
        setDrafts([]);
        return;
      }
      const allDrafts = JSON.parse(saved);
      setDrafts(allDrafts.filter((d: any) => d.templateName?.startsWith('אישור')).sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    }
  };

  const handleStartNew = async (type: InspectionType, templateId?: string) => {
    setLoading(true);
    try {
      let t: FormTemplate | null = null;
      if (templateId) {
        t = availableTemplates.find(tmp => tmp.id === templateId) || null;
      } else {
        const formKey = type === InspectionType.ANNUAL ? 'ANNUAL_INSPECTION' : 'SEMI_ANNUAL_INSPECTION';
        t = await dbService.getFormTemplate(formKey);
      }
      
      if (!t || !t.fields || t.fields.length === 0) {
        alert("שגיאה: לא נמצאה תבנית פעילה עבור סוג זה.");
        return;
      }

      setSelectedType(type);
      setTemplate(t);
      // Logic Activation: Pre-fill technicianId so system lookups like [technicianId] work
      setInitialValues({ technicianId: user.id }); 
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
    
    const saved = localStorage.getItem(GLOBAL_DRAFTS_KEY);
    if (saved) {
      const allDrafts = JSON.parse(saved);
      draft = allDrafts.find((d: any) => d.id === draftId);
    }
    
    if (!draft) {
      draft = drafts.find(d => d.id === draftId);
    }
    
    if (!draft) {
      try {
        const { data } = await supabase
          .from('inspection_drafts')
          .select('*')
          .eq('id', draftId)
          .single();
          
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

      setSelectedType(foundTemplate.formKey === 'ANNUAL_INSPECTION' ? InspectionType.ANNUAL : InspectionType.SEMI_ANNUAL);
      setTemplate(foundTemplate);
      setInitialValues(draft.data);
      setActiveDraftId(draft.id);
      setIsAdding(true);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: Record<string, any>) => {
    setLoading(true);
    try {
      const serial = await dbService.generateInspectionSerialNumber(selectedType);
      
      const parentSavePromise = dbService.addInspection({
        inspectionSerialNumber: serial,
        inspectionType: selectedType,
        templateName: template?.name,
        customerId: data.customerId || '',
        technicianId: user.id,
        inspectionDate: new Date().toISOString().split('T')[0],
        status: InspectionStatus.SUBMITTED,
        data: data
      });

      // Certificates currently don't have child records in this view, 
      // but we use the utility for consistency and handshake verification.
      const childSyncFn = async (parentData: any) => {
        const parentDataObj = Array.isArray(parentData) ? parentData[0] : parentData;
        const parentFriendlyId = parentDataObj.serial_number || parentDataObj.inspectionSerialNumber || parentDataObj.id;
        
        await dbService.logActivity(
          user.name,
          'CREATE_CERTIFICATE',
          `הונפק אישור חדש: ${parentFriendlyId} (${template?.name})`
        );
      };

      const savedParent = await dbService.safeSequentialSave('inspections', parentSavePromise, childSyncFn);
      
      const parentData = Array.isArray(savedParent) ? savedParent[0] : savedParent;
      const parentFriendlyId = parentData.ROWID || parentData.serial_number || parentData.inspectionSerialNumber || parentData.id;

      // TRIGGER AUTOMATION BOTS
      console.log(`[Automation] Triggering bots for inspections with ID: ${parentFriendlyId}`);
      dbService.triggerBots('inspections', parentFriendlyId, 'ADDS');

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
      }
      await loadData();
    } catch (err: any) {
      console.error(`Error in certificate save:`, err);
      alert(`שגיאה בשמירת האישור: ${err.message || 'שגיאה לא ידועה'}`);
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

  if (isAdding && fullTemplate && activeDraftId) {
    return (
      <div className="bg-white p-6 rounded-3xl border shadow-sm max-w-4xl mx-auto animate-in zoom-in duration-300">
        <DynamicForm 
          key={activeDraftId} 
          template={fullTemplate} 
          initialValues={initialValues} 
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
              loadDrafts(); 
            }
          }} 
          onSwitchDraft={handleContinueDraft} 
          onAction={async (type, payload) => {
            if (type === 'REDIRECT_FORM') {
              localStorage.setItem('returnToDraftId', activeDraftId);
              const { field, currentData, targetFormId } = payload as any;
              
              // Save parent data to localStorage for child form use
              if (currentData) {
                localStorage.setItem('parentFormData', JSON.stringify(currentData));
                
                // Also save ID for backward compatibility
                const recordId = currentData.ROWID || currentData.id || currentData.inspectionSerialNumber;
                if (recordId) {
                  localStorage.setItem('pendingParentRowId', recordId);
                }
              }

              const targetId = targetFormId || field?.targetFormId || field?.navigation_config?.targetFormId;
              
              if (targetId) {
                handleStartNew(InspectionType.OTHER, targetId);
              } else {
                const extTemplate = availableTemplates.find(t => 
                  t.name.includes('מטפים') || t.name.includes('Extinguisher')
                );
                if (extTemplate) {
                  handleStartNew(InspectionType.OTHER, extTemplate.id);
                } else {
                  alert('תבנית יעד לא הוגדרה עבור כפתור זה.');
                }
              }
            }
          }}
          contextData={contextData} 
          currentUser={user} 
          draftId={activeDraftId} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 md:p-6 rounded-3xl border shadow-sm gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="חיפוש אישור..." className="w-full pr-12 pl-4 py-3 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold min-h-[44px]" />
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {availableTemplates.length > 0 ? (
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {availableTemplates.slice(0, 2).map(t => (
                <button 
                  key={t.id}
                  onClick={() => handleStartNew(InspectionType.OTHER, t.id)} 
                  className="flex-1 md:flex-none px-4 md:px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs md:text-sm hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-2 active:scale-95 min-h-[44px]"
                >
                  <Plus size={18} /> <span className="truncate">{t.name}</span>
                </button>
              ))}
              {availableTemplates.length > 2 && (
                <select 
                  onChange={(e) => {
                    const t = availableTemplates.find(tmp => tmp.id === e.target.value);
                    if (t) handleStartNew(InspectionType.OTHER, t.id);
                  }}
                  className="flex-1 md:flex-none px-4 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-xs md:text-sm outline-none border-none min-h-[44px]"
                >
                  <option value="">אישורים נוספים...</option>
                  {availableTemplates.slice(2).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="text-slate-400 text-sm font-bold italic w-full text-right">להפקת אישור חדש, יש לבחור תבנית מתאימה מהמערכת.</div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {drafts.length > 0 && (
          <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 px-1"><Clock size={20} className="text-orange-500"/> טיוטות אישורים</h3>
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
                       } else {
                         const s = localStorage.getItem(GLOBAL_DRAFTS_KEY); 
                         if(s) { 
                           const f = JSON.parse(s).filter((d:any)=>d.id!==draft.id); 
                           localStorage.setItem(GLOBAL_DRAFTS_KEY, JSON.stringify(f)); 
                           loadDrafts(); 
                         } 
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
          <div className="p-4 md:p-6 bg-slate-50/50 border-b flex items-center gap-2"><FileCheck className="text-blue-600" size={20} /><h3 className="font-black text-slate-800">היסטוריית אישורים</h3></div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto scrollbar-thin">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b"><tr><th className="p-4">מס' אישור</th><th className="p-4">לקוח</th><th className="p-4">סוג אישור</th><th className="p-4">תאריך</th><th className="p-4">סטטוס</th><th className="p-4 text-center">פעולות</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {inspections.map(i => (
                  <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono font-bold text-blue-600">{i.inspectionSerialNumber}</td>
                    <td className="p-4 font-bold text-slate-700">{(customers.find(c => c.id === i.customerId))?.name || '---'}</td>
                    <td className="p-4 text-slate-600 font-bold">{i.templateName}</td>
                    <td className="p-4 text-slate-500 font-medium">{i.inspectionDate}</td>
                    <td className="p-4"><span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase">מאושר</span></td>
                    <td className="p-4 text-center"><button className="p-2 text-slate-300 hover:text-blue-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"><Eye size={18} /></button></td>
                  </tr>
                ))}
                {inspections.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400 font-bold italic">לא נמצאו אישורים במערכת</td>
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
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase">מאושר</span>
                </div>
                <div className="text-sm font-bold text-slate-600">{i.templateName}</div>
                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-1 text-slate-500 text-xs font-medium">
                    <Clock size={14} />
                    {i.inspectionDate}
                  </div>
                  <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-50 rounded-lg">
                    <Eye size={18} />
                  </button>
                </div>
              </div>
            ))}
            {inspections.length === 0 && (
              <div className="p-12 text-center text-slate-400 font-bold italic">לא נמצאו אישורים במערכת</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Certificates;
