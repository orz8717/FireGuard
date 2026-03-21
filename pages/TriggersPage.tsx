import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { dbService } from '../services/dbService';
import { supabase, supabaseAdmin } from '../services/supabaseClient';
import { 
  Zap, Plus, Settings2, History, Play, CheckCircle2, XCircle, 
  Clock, Database, Activity, X, Save, Trash2, GitBranch, 
  Mail, MessageSquare, FileText, Globe, Edit3, ListPlus, 
  FolderOutput, ShieldAlert, ChevronDown, ChevronRight,
  Terminal, Code2, Loader2, HelpCircle, ShieldCheck, AlertTriangle
} from 'lucide-react';

interface TriggersPageProps {
  user: User;
}

type EventType = 'DATA_CHANGE' | 'SCHEDULED';
type DataChangeType = 'ADDS' | 'UPDATES' | 'DELETES' | 'ALL';
type ScheduleType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'FOR_EACH_ROW';
type StepType = 'RUN_TASK' | 'BRANCH' | 'WAIT' | 'CALL_PROCESS';
type TaskType = 'EMAIL' | 'SMS' | 'SET_VALUES' | 'EXECUTE_ROWS' | 'ADD_ROW' | 'FILE' | 'WEBHOOK';

interface BotTask {
  type: TaskType;
  // Email
  to?: string; cc?: string; bcc?: string; subject?: string; body?: string; attachment?: boolean; attachmentName?: string;
  googleDocTemplateId?: string; templateId?: string;
  // SMS
  message?: string;
  // Set Values / Add Row
  updates?: { column: string; value: string }[];
  addRowTable?: string;
  // Execute Rows
  refTable?: string; refRowsFormula?: string; refAction?: string;
  // File
  fileType?: 'PDF' | 'CSV' | 'EXCEL'; template?: string; filePath?: string;
  // Webhook
  url?: string; method?: string; headers?: { key: string; value: string }[]; bodyTemplate?: string;
}

interface BotStep {
  id: string;
  name: string;
  type: StepType;
  condition?: string; // For Branch
  trueSteps?: BotStep[]; // For Branch
  falseSteps?: BotStep[]; // For Branch
  task?: BotTask; // For Run Task
}

interface BotEvent {
  type: EventType;
  targetTable: string;
  dataChangeType?: DataChangeType;
  scheduleType?: ScheduleType;
  scheduleTime?: string;
  conditionFormula: string;
  bypassSecurity: boolean;
}

interface Bot {
  id: string;
  name: string;
  isActive: boolean;
  event: BotEvent;
  steps: BotStep[];
  lastExecuted: string | null;
  templateId?: string;
  linked_child_tables?: string[];
}

interface TriggerHistory {
  id: string; botName: string; executedAt: string; status: 'SUCCESS' | 'FAILED'; details: string;
}

const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx9Aprjm7RISvTet4j6xip62QlaUPeEnAy5cWDj6JKexwmifRyqDQ0PjuDP0Y3cB9Cg/exec';

import { usePermissions } from '../src/context/PermissionContext';

const TriggersPage: React.FC<TriggersPageProps> = ({ user }) => {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('triggers', 'canView');
  const canEdit = hasPermission('triggers', 'canEdit');
  const canDelete = hasPermission('triggers', 'canDelete');
  const canCreate = hasPermission('triggers', 'canCreate');

  const [activeTab, setActiveTab] = useState<'bots' | 'history' | 'schema'>('bots');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [tables, setTables] = useState<{ id: string; label: string }[]>([]);
  const [tableColumns, setTableColumns] = useState<{ column_name: string; data_type: string }[]>([]);
  const [showAssistant, setShowAssistant] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  
  const [bots, setBots] = useState<Bot[]>([]);
  
  const [history, setHistory] = useState<TriggerHistory[]>([
    { id: '101', botName: 'עדכון סטטוס ביקורת', executedAt: new Date().toISOString(), status: 'SUCCESS', details: 'נשלח אימייל ללקוח בהצלחה' }
  ]);

  const [editingBot, setEditingBot] = useState<Bot | null>(null);
  const [testRecordId, setTestRecordId] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);

  const [schemaResults, setSchemaResults] = useState<any[]>([]);
  const [checkingSchema, setCheckingSchema] = useState(false);

  const runSchemaCheck = async () => {
    setCheckingSchema(true);
    try {
      const results = await dbService.checkSchemaIntegrity();
      setSchemaResults(results);
    } catch (err) {
      console.error('Schema check failed:', err);
    } finally {
      setCheckingSchema(false);
    }
  };

  const handleGenerateTemplate = async (stepId: string) => {
    if (!editingBot?.event.targetTable) {
      alert('אנא בחר טבלת יעד תחילה');
      return;
    }

    setGeneratingTemplate(true);
    try {
      const columns = await dbService.getTableColumns(editingBot.event.targetTable);
      const columnNames = columns.map(c => c.column_name);

      const linkedTablesData = [];
      if (editingBot.linked_child_tables && editingBot.linked_child_tables.length > 0) {
        for (const tableName of editingBot.linked_child_tables) {
          const cols = await dbService.getTableColumns(tableName);
          linkedTablesData.push({
            tableName,
            columns: cols.map(c => c.column_name)
          });
        }
      }

      const payload = {
        action: 'generate_template',
        tableName: editingBot.event.targetTable,
        columns: columnNames,
        linkedTables: linkedTablesData
      };

      console.log("[Automation Debug] Requesting Template Generation URL:", GAS_WEB_APP_URL);
      console.log("[Automation Debug] Requesting Template Generation Payload:", payload);

      await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });

      alert('בקשת יצירת השבלונה נשלחה. השבלונה החדשה תיווצר ב-Google Drive שלך. אנא העתק את ה-ID של המסמך החדש והדבק אותו בשדה השבלונה.');
      
    } catch (err: any) {
      console.error('Template generation error:', err);
      alert('הנתונים נשמרו ב-Supabase אך האוטומציה נכשלה עקב חסימת דפדפן');
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!editingBot || !testRecordId) {
      alert('נא להזין מזהה רשומה לבדיקה');
      return;
    }

    setSimulating(true);
    setSimulationLogs([`[${new Date().toLocaleTimeString()}] Starting simulation for bot: ${editingBot.name}`]);

    try {
      setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Fetching record ${testRecordId} from ${editingBot.event.targetTable}...`]);
      
      const { data: rowData, error: fetchError } = await supabase
        .from(editingBot.event.targetTable)
        .select('*')
        .eq('ROWID', testRecordId)
        .single();

      if (fetchError || !rowData) {
        throw new Error(`Failed to fetch record: ${fetchError?.message || 'Record not found'}`);
      }

      setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Record fetched successfully.`]);

      for (const step of editingBot.steps) {
        if (step.type === 'RUN_TASK' && step.task) {
          setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Executing Step: ${step.name} (${step.task?.type})...`]);
          
          if (step.task.type === 'EMAIL') {
            if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.includes('YOUR_SCRIPT_URL')) {
              const msg = "Configuration Required: Please add the Script URL.";
              alert(msg);
              setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: ${msg}`]);
              continue;
            }

            const childData: Record<string, any[]> = {};
            if (editingBot.linked_child_tables) {
              const parentId = rowData.id || rowData.ROWID || rowData.inspectionSerialNumber;
              
              for (const tableName of editingBot.linked_child_tables) {
                setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Fetching child records from ${tableName} using Parent ID: ${parentId}...`]);
                
                // Try to match by parent_id (UUID) or ROWID
                const { data: children, error: childError } = await supabase
                  .from(tableName)
                  .select('*')
                  .or(`parent_id.eq."${parentId}",ROWID.eq."${parentId}"`);
                
                if (childError) {
                  console.warn(`[Simulation] Error fetching children for ${tableName}:`, childError);
                  // Fallback to simple fetch by parent_id
                  const { data: fallbackChildren } = await supabase
                    .from(tableName)
                    .select('*')
                    .eq('parent_id', parentId);
                  childData[tableName] = fallbackChildren || [];
                } else {
                  childData[tableName] = children || [];
                }
                
                setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Found ${childData[tableName].length} child records in ${tableName}.`]);
              }
            }

            // --- NEW: 1:1 Dynamic Flattening Protocol (Indexed & Strict) ---
            const combinedData: Record<string, string> = {};
            const formatValue = (val: any) => (val === null || val === undefined) ? "" : String(val);
            const cleanKey = (k: string) => k.replace(/[\[\]<>]/g, '');

            // 1. Flatten Parent Data
            Object.entries(rowData).forEach(([key, value]) => {
              if (key === 'temp_child_data' || key.startsWith('_')) return;
              combinedData[cleanKey(key)] = formatValue(value);
            });

            // 2. Process Child & Grandchild Data
            const allChildren: any[] = [];
            Object.values(childData).forEach(records => {
              if (Array.isArray(records)) {
                allChildren.push(...records);
              }
            });

            if (rowData.temp_child_data) {
              const tcd = typeof rowData.temp_child_data === 'string' ? JSON.parse(rowData.temp_child_data) : rowData.temp_child_data;
              Object.values(tcd).forEach((config: any) => {
                if (config.records && Array.isArray(config.records)) {
                  allChildren.push(...config.records);
                }
              });
            }

            // Flatten all discovered children with indices
            allChildren.forEach((childRecord, index) => {
              const displayIndex = index + 1;
              
              // Flatten Child
              Object.entries(childRecord).forEach(([cKey, cValue]) => {
                if (cKey === 'temp_child_data' || cKey.startsWith('_')) return;
                combinedData[`${cleanKey(cKey)}_${displayIndex}`] = formatValue(cValue);
              });

              // Flatten Nested Grandchild
              if (childRecord.temp_child_data) {
                const gcd = typeof childRecord.temp_child_data === 'string' ? JSON.parse(childRecord.temp_child_data) : childRecord.temp_child_data;
                Object.values(gcd).forEach((gConfig: any) => {
                  if (gConfig.records && Array.isArray(gConfig.records)) {
                    gConfig.records.forEach((gRecord: any) => {
                      Object.entries(gRecord).forEach(([gKey, gValue]) => {
                        if (gKey === 'temp_child_data' || gKey.startsWith('_')) return;
                        combinedData[`${cleanKey(gKey)}_${displayIndex}`] = formatValue(gValue);
                      });
                    });
                  }
                });
              }
            });

            // Helper to replace placeholders in strings
            const replacePlaceholders = (str: string | undefined) => {
              if (!str) return str;
              let result = str;
              Object.entries(combinedData).forEach(([key, value]) => {
                // Strict Format: <<key>>
                const regex = new RegExp(`<<${key}>>`, 'g');
                result = result.replace(regex, value);
              });
              return result;
            };

            const processedTask = {
              ...step.task,
              to: replacePlaceholders(step.task.to),
              subject: replacePlaceholders(step.task.subject),
              body: replacePlaceholders(step.task.body)
            };

            // Execute the backend logic via GAS
            const payload = {
              templateId: step.task.googleDocTemplateId || step.task.templateId || editingBot.templateId,
              task: processedTask,
              combinedData: combinedData,
              rowData: rowData,
              childData: childData
            };
            
            console.log("[Automation Debug] Sending Payload to GAS URL:", GAS_WEB_APP_URL);
            console.log("[Automation Debug] Sending Payload to GAS:", payload);
            setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Sending payload to Google Apps Script...`]);
            setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Combined Data Fields: ${Object.keys(combinedData).length}`]);

            try {
              // In simulation mode, we WANT to wait for the response to see logs.
              // Note: If CORS is not configured in GAS, this might show an error in console, 
              // but the script will still execute.
              const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
              });

              if (response.ok || response.type === 'opaque') {
                if (response.type === 'opaque') {
                  setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] SENT: Request dispatched. (Opaque response - server logs hidden by CORS)`]);
                } else {
                  const result = await response.json();
                  if (result.logs && Array.isArray(result.logs)) {
                    setSimulationLogs(prev => [...prev, ...result.logs.map((l: string) => `[SERVER] ${l}`)]);
                  }
                  if (result.status === 'success') {
                    setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] SUCCESS: Bot executed successfully.`]);
                  } else {
                    setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: ${result.message}`]);
                  }
                }
              }
            } catch (fetchErr: any) {
              console.error("[Automation Debug] Fetch Error:", fetchErr);
              setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: הנתונים נשמרו ב-Supabase אך האוטומציה נכשלה עקב חסימת דפדפן`]);
              alert('הנתונים נשמרו ב-Supabase אך האוטומציה נכשלה עקב חסימת דפדפן');
            }

            const successMsg = `הסימולציה הסתיימה. בדוק את הלוגים למטה לפרטים נוספים.`;
            alert(successMsg);
          } else {
            setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Task type ${step.task.type} simulation complete.`]);
          }
        }
      }

      setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Simulation Complete. SUCCESS.`]);
    } catch (error: any) {
      console.error('Simulation error:', error);
      setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: ${error.message}`]);
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      window.location.href = '/';
      return;
    }
    fetchTables();
    fetchBots();
  }, [canView]);

  const fetchBots = async () => {
    try {
      const data = await dbService.getBots();
      const mappedBots: Bot[] = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        isActive: d.is_active,
        lastExecuted: null,
        event: d.action_config?.event || { type: d.event_type, targetTable: d.table_name, conditionFormula: d.condition_formula, bypassSecurity: false },
        steps: d.action_config?.steps || [],
        linked_child_tables: d.action_config?.linked_child_tables || [],
        templateId: d.template_id
      }));
      setBots(mappedBots);
    } catch (err) {
      console.error("Error fetching bots:", err);
    }
  };

  useEffect(() => {
    if (editingBot?.event.targetTable) {
      dbService.getTableColumns(editingBot.event.targetTable).then(cols => setTableColumns(cols));
    } else {
      setTableColumns([]);
    }
  }, [editingBot?.event.targetTable]);

  const fetchTables = async () => {
    try {
      const fetchedTables = await dbService.getTablesList();
      setTables(fetchedTables);
    } catch (err) {}
  };

  const openNewBotWizard = () => {
    setEditingBot({
      id: crypto.randomUUID(),
      name: 'בוט חדש',
      isActive: true,
      lastExecuted: null,
      event: { type: 'DATA_CHANGE', targetTable: '', dataChangeType: 'ALL', conditionFormula: '', bypassSecurity: false },
      steps: [],
      linked_child_tables: []
    });
    setIsWizardOpen(true);
  };

  const saveBot = async () => {
    if (!editingBot?.name || !editingBot.event.targetTable) {
      alert('נא למלא שם וטבלת יעד');
      return;
    }

    // Validation: Check if Google Doc Template ID is missing for Email tasks
    const emailSteps = editingBot.steps.filter(s => s.type === 'RUN_TASK' && s.task?.type === 'EMAIL');
    for (const step of emailSteps) {
      if (!step.task?.googleDocTemplateId) {
        alert('אנא הזן מזהה שבלונה (Google Doc Template ID) כדי שהאוטומציה תוכל לפעול.');
        return;
      }
    }

    try {
      const payload: any = {
        ...editingBot,
        action_config: { 
          event: editingBot.event, 
          steps: editingBot.steps,
          linked_child_tables: editingBot.linked_child_tables || []
        }
      };
      const savedData = await dbService.saveBot(payload);
      const mappedBot: Bot = {
        id: savedData.id,
        name: savedData.name,
        isActive: savedData.is_active,
        lastExecuted: editingBot.lastExecuted,
        event: savedData.action_config.event,
        steps: savedData.action_config.steps,
        linked_child_tables: savedData.action_config.linked_child_tables || [],
        templateId: savedData.template_id
      };
      
      setBots(prev => {
        const exists = prev.find(b => b.id === mappedBot.id || b.id === editingBot.id);
        if (exists) return prev.map(b => (b.id === mappedBot.id || b.id === editingBot.id) ? mappedBot : b);
        return [mappedBot, ...prev];
      });
      setIsWizardOpen(false);
    } catch (error) {
      console.error("Error saving bot:", error);
      alert("שגיאה בשמירת הבוט");
    }
  };

  const toggleBotStatus = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const botToToggle = bots.find(b => b.id === id);
    if (!botToToggle) return;
    
    const newStatus = !botToToggle.isActive;
    setBots(prev => prev.map(b => b.id === id ? { ...b, isActive: newStatus } : b));
    
    try {
      await dbService.updateBotStatus(id, newStatus);
    } catch (error) {
      console.error("Error toggling status:", error);
      setBots(prev => prev.map(b => b.id === id ? { ...b, isActive: !newStatus } : b));
    }
  };

  const deleteBot = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    if (!window.confirm('האם אתה בטוח שברצונך למחוק בוט זה?')) return;

    try {
      if (!canDelete) {
        alert('שגיאת הרשאה: אין לך הרשאה למחוק בוטים.');
        return;
      }

      await dbService.deleteBot(id);
      
      // 3. Update local React state immediately
      setBots(prev => prev.filter(b => b.id !== id));
      
    } catch (error: any) {
      console.error('Error deleting bot:', error);
      alert(`אירעה שגיאה במחיקת הבוט: ${error.message || 'שגיאה לא ידועה'}`);
    }
  };

  const addStep = () => {
    if (!editingBot) return;
    const newStep: BotStep = {
      id: `step_${Date.now()}`,
      name: 'שלב חדש',
      type: 'RUN_TASK',
      task: { type: 'EMAIL' }
    };
    setEditingBot({ ...editingBot, steps: [...editingBot.steps, newStep] });
  };

  const updateStep = (stepId: string, updates: Partial<BotStep>) => {
    if (!editingBot) return;
    const newSteps = editingBot.steps.map(s => s.id === stepId ? { ...s, ...updates } : s);
    setEditingBot({ ...editingBot, steps: newSteps });
  };

  const removeStep = (stepId: string) => {
    if (!editingBot) return;
    setEditingBot({ ...editingBot, steps: editingBot.steps.filter(s => s.id !== stepId) });
  };

  if (!canView) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Zap className="text-blue-600" size={28} />
            Automation Engine
          </h1>
          <p className="text-slate-500 mt-1 font-medium">בניית בוטים ותהליכי אוטומציה מתקדמים</p>
        </div>
          {canCreate && (
            <button 
              onClick={openNewBotWizard}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-200"
            >
              <Plus size={20} />
              צור בוט חדש
            </button>
          )}
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="flex border-b">
          <button onClick={() => setActiveTab('bots')} className={`flex-1 py-4 font-bold text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'bots' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Settings2 size={18} /> בוטים פעילים
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 py-4 font-bold text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}>
            <History size={18} /> היסטוריית ריצות
          </button>
          <button onClick={() => setActiveTab('schema')} className={`flex-1 py-4 font-bold text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'schema' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}>
            <ShieldCheck size={18} /> תקינות מסד נתונים
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'bots' && (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-500">שם הבוט</th>
                    <th className="px-4 py-3 font-bold text-slate-500">אירוע</th>
                    <th className="px-4 py-3 font-bold text-slate-500">טבלת יעד</th>
                    <th className="px-4 py-3 font-bold text-slate-500">שלבים</th>
                    <th className="px-4 py-3 font-bold text-slate-500">סטטוס</th>
                    <th className="px-4 py-3 font-bold text-slate-500">הרצה אחרונה</th>
                    <th className="px-4 py-3 font-bold text-slate-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bots.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-400 font-medium">לא נמצאו בוטים.</td></tr>
                  ) : (
                    bots.map(bot => (
                      <tr key={bot.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { setEditingBot(bot); setIsWizardOpen(true); }}>
                        <td className="px-4 py-4 font-bold text-slate-800">{bot.name}</td>
                        <td className="px-4 py-4">
                          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                            {bot.event.type === 'DATA_CHANGE' ? bot.event.dataChangeType : bot.event.scheduleType}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-mono text-sm text-blue-600">{bot.event.targetTable}</td>
                        <td className="px-4 py-4 text-slate-600 font-medium">{bot.steps.length} שלבים</td>
                        <td className="px-4 py-4">
                          <button 
                            onClick={(e) => canEdit && toggleBotStatus(e, bot.id)} 
                            disabled={!canEdit}
                            className={`w-12 h-6 rounded-full relative transition-all ${bot.isActive ? 'bg-emerald-500' : 'bg-slate-300'} ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${bot.isActive ? 'left-7' : 'left-1'}`} />
                          </button>
                        </td>
                        <td className="px-4 py-4 text-slate-500 text-sm">{bot.lastExecuted ? new Date(bot.lastExecuted).toLocaleString('he-IL') : 'טרם הורץ'}</td>
                        <td className="px-4 py-4 text-left">
                          {canDelete && (
                            <button onClick={(e) => deleteBot(e, bot.id)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
                              <Trash2 size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-500">זמן ריצה</th>
                    <th className="px-4 py-3 font-bold text-slate-500">בוט</th>
                    <th className="px-4 py-3 font-bold text-slate-500">סטטוס</th>
                    <th className="px-4 py-3 font-bold text-slate-500">פרטים</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map(h => (
                    <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 text-slate-600 font-medium text-sm">{new Date(h.executedAt).toLocaleString('he-IL')}</td>
                      <td className="px-4 py-4 font-bold text-slate-800">{h.botName}</td>
                      <td className="px-4 py-4">
                        {h.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-xs font-bold"><CheckCircle2 size={14} /> הצלחה</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-md text-xs font-bold"><XCircle size={14} /> שגיאה</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-500 text-sm">{h.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black text-slate-800">בדיקת תקינות מסד הנתונים</h3>
                  <p className="text-sm text-slate-500">וודא שכל הטבלאות מוגדרות נכון עבור שמירה אטומית ואוטומציות.</p>
                </div>
                <button 
                  onClick={runSchemaCheck}
                  disabled={checkingSchema}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {checkingSchema ? <Loader2 className="animate-spin" size={18} /> : <><ShieldCheck size={18} /> הרץ בדיקה</>}
                </button>
              </div>

              {schemaResults.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {schemaResults.map((res, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border ${res.errors.length > 0 ? 'border-red-200 bg-red-50/30' : 'border-emerald-200 bg-emerald-50/30'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-slate-800">{res.table}</div>
                        {res.errors.length === 0 ? (
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded uppercase">תקין</span>
                        ) : (
                          <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded uppercase">שגיאה</span>
                        )}
                      </div>
                      <div className="space-y-1 mb-3">
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${res.hasTempChildData ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <span className="text-slate-600">עמודת temp_child_data</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${res.hasTrgChildSync ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <span className="text-slate-600">טריגר trg_child_sync</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${res.hasParentId ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <span className="text-slate-600">עמודת parent_id</span>
                        </div>
                      </div>
                      {res.errors.length > 0 && (
                        <div className="mt-2 p-2 bg-white/50 rounded-lg border border-red-100">
                          {res.errors.map((err: string, i: number) => (
                            <div key={i} className="text-[10px] text-red-600 flex items-center gap-1">
                              <AlertTriangle size={10} /> {err}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                  <div className="text-slate-400 mb-2"><ShieldCheck size={48} className="mx-auto opacity-20" /></div>
                  <div className="text-slate-500 font-medium">לחץ על "הרץ בדיקה" כדי לוודא שכל הטבלאות מוכנות לאוטומציה.</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bot Builder Wizard */}
      {isWizardOpen && editingBot && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col h-[90vh] animate-in zoom-in duration-300">
            
            {/* Header */}
            <div className="p-4 md:p-6 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <div className="flex items-center gap-4 w-1/2">
                <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200"><Zap size={24} /></div>
                <input 
                  type="text" 
                  value={editingBot.name} 
                  onChange={e => setEditingBot({...editingBot, name: e.target.value})}
                  className="text-xl font-black text-slate-800 bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-100 rounded-lg px-2 w-full"
                  placeholder="שם הבוט..."
                />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setTestModalOpen(true)} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition-all text-sm">
                  <Terminal size={16} /> Test Bot
                </button>
                <button onClick={saveBot} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2">
                  <Save size={18} /> שמור
                </button>
                <button onClick={() => setIsWizardOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-all"><X size={24} /></button>
              </div>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              
              {/* Left Sidebar: Visual Flowchart */}
              <div className="w-1/4 bg-slate-50 border-l border-slate-200 p-6 overflow-y-auto hidden md:block">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">זרימת הבוט (Flow)</h3>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                  
                  {/* Event Node */}
                  <div className="relative flex items-center justify-center">
                    <div className="bg-white border-2 border-blue-500 rounded-xl p-3 shadow-sm z-10 w-full text-center">
                      <div className="text-[10px] font-bold text-blue-500 uppercase">Event</div>
                      <div className="font-black text-slate-700 text-sm truncate">{editingBot.event.type === 'DATA_CHANGE' ? 'Data Change' : 'Schedule'}</div>
                    </div>
                  </div>

                  {/* Steps Nodes */}
                  {editingBot.steps.map((step, idx) => (
                    <div key={step.id} className="relative flex items-center justify-center">
                      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm z-10 w-full text-center group hover:border-blue-400 transition-colors">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{step.type}</div>
                        <div className="font-black text-slate-700 text-sm truncate">{step.name}</div>
                      </div>
                    </div>
                  ))}

                  {/* Add Step Node */}
                  <div className="relative flex items-center justify-center">
                    <button onClick={addStep} className="bg-blue-50 border border-blue-200 text-blue-600 rounded-full p-2 shadow-sm z-10 hover:bg-blue-100 transition-colors">
                      <Plus size={20} />
                    </button>
                  </div>

                </div>
              </div>

              {/* Main Content: Configuration */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-white relative">
                
                {/* Expression Assistant Toggle */}
                <button 
                  onClick={() => setShowAssistant(!showAssistant)}
                  className="absolute top-4 left-4 p-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors flex items-center gap-2 text-xs font-bold z-20"
                >
                  <Code2 size={16} />
                  {showAssistant ? 'הסתר עוזר נוסחאות' : 'הצג עוזר נוסחאות'}
                </button>

                {/* Event Configuration */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Activity className="text-blue-500" size={20} />
                    <h2 className="text-lg font-black text-slate-800">1. אירוע מפעיל (Triggering Event)</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">סוג אירוע</label>
                      <select 
                        value={editingBot.event.type} 
                        onChange={e => setEditingBot({...editingBot, event: {...editingBot.event, type: e.target.value as EventType}})}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold appearance-none"
                      >
                        <option value="DATA_CHANGE">שינוי נתונים (Data Change)</option>
                        <option value="SCHEDULED">מתוזמן (Scheduled)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">טבלת יעד</label>
                      <select 
                        value={editingBot.event.targetTable} 
                        onChange={e => setEditingBot({...editingBot, event: {...editingBot.event, targetTable: e.target.value}})}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold appearance-none font-mono text-sm"
                      >
                        <option value="">בחר טבלה...</option>
                        {tables.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2 col-span-full">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1 flex items-center gap-2">
                        <ListPlus size={14} /> טבלאות בן מקושרות (Linked Child Tables)
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        {tables.filter(t => t.id !== editingBot.event.targetTable).map(t => (
                          <label key={t.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer group">
                            <input 
                              type="checkbox"
                              checked={editingBot.linked_child_tables?.includes(t.id)}
                              onChange={e => {
                                const current = editingBot.linked_child_tables || [];
                                if (e.target.checked) {
                                  setEditingBot({...editingBot, linked_child_tables: [...current, t.id]});
                                } else {
                                  setEditingBot({...editingBot, linked_child_tables: current.filter(id => id !== t.id)});
                                }
                              }}
                              className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{t.label}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium px-1">בחר את הטבלאות המכילות נתונים מקושרים (לפי ROWID) שברצונך לכלול בדוח.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">בחר תבנית (Select Template)</label>
                      <select 
                        value={editingBot.templateId || ''} 
                        onChange={e => setEditingBot({...editingBot, templateId: e.target.value})}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold appearance-none"
                      >
                        <option value="">ללא תבנית</option>
                        <option value="Annual Inspection">Annual Inspection</option>
                        <option value="Semi-Annual Inspection">Semi-Annual Inspection</option>
                        <option value="Form 4">Form 4</option>
                        <option value="Form 5">Form 5</option>
                        <option value="Form 6">Form 6</option>
                      </select>
                    </div>

                    {editingBot.event.type === 'DATA_CHANGE' && (
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">סוג שינוי</label>
                        <select 
                          value={editingBot.event.dataChangeType} 
                          onChange={e => setEditingBot({...editingBot, event: {...editingBot.event, dataChangeType: e.target.value as DataChangeType}})}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold appearance-none"
                        >
                          <option value="ADDS">הוספות בלבד (Adds)</option>
                          <option value="UPDATES">עדכונים בלבד (Updates)</option>
                          <option value="DELETES">מחיקות בלבד (Deletes)</option>
                          <option value="ALL">כל השינויים (Adds, Updates, Deletes)</option>
                        </select>
                      </div>
                    )}

                    {editingBot.event.type === 'SCHEDULED' && (
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1">תדירות</label>
                        <select 
                          value={editingBot.event.scheduleType} 
                          onChange={e => setEditingBot({...editingBot, event: {...editingBot.event, scheduleType: e.target.value as ScheduleType}})}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold appearance-none"
                        >
                          <option value="DAILY">יומי</option>
                          <option value="WEEKLY">שבועי</option>
                          <option value="MONTHLY">חודשי</option>
                          <option value="FOR_EACH_ROW">עבור כל שורה בטבלה (ForEachRow)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1 flex items-center justify-between">
                      <span>תנאי הפעלה (Condition)</span>
                      <span className="text-[10px] text-blue-500 font-mono bg-blue-50 px-2 py-0.5 rounded">[_THISROW_BEFORE] / [_THISROW_AFTER]</span>
                    </label>
                    <textarea 
                      value={editingBot.event.conditionFormula} 
                      onChange={e => setEditingBot({...editingBot, event: {...editingBot.event, conditionFormula: e.target.value}})}
                      placeholder='לדוגמה: [_THISROW_BEFORE].[status] <> [_THISROW_AFTER].[status]' 
                      className="w-full p-4 bg-slate-900 text-emerald-400 border-2 border-slate-800 rounded-2xl outline-none focus:border-blue-500 transition-all font-mono text-sm min-h-[80px] resize-none" 
                      dir="ltr"
                    />
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <ShieldAlert className="text-orange-500" size={24} />
                    <div className="flex-1">
                      <h4 className="font-black text-slate-800 text-sm">עקיפת הרשאות אבטחה (Bypass Security Filters)</h4>
                      <p className="text-xs text-slate-500">הפעל בוט זה בהרשאות מערכת מלאות, ללא התחשבות בהרשאות המשתמש המפעיל.</p>
                    </div>
                    <button 
                      onClick={() => setEditingBot({...editingBot, event: {...editingBot.event, bypassSecurity: !editingBot.event.bypassSecurity}})}
                      className={`w-12 h-6 rounded-full relative transition-all ${editingBot.event.bypassSecurity ? 'bg-orange-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingBot.event.bypassSecurity ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                {/* Process Steps Configuration */}
                <div className="space-y-6 pt-6 border-t">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2">
                      <Settings2 className="text-blue-500" size={20} />
                      <h2 className="text-lg font-black text-slate-800">2. תהליך ושלבים (Process & Steps)</h2>
                    </div>
                    <button onClick={addStep} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg">
                      <Plus size={16} /> הוסף שלב
                    </button>
                  </div>

                  <div className="space-y-6">
                    {editingBot.steps.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 font-medium">
                        לא הוגדרו שלבים. לחץ על "הוסף שלב" כדי להתחיל.
                      </div>
                    ) : (
                      editingBot.steps.map((step, index) => (
                        <div key={step.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                          <div className="bg-slate-50 p-4 border-b flex items-center justify-between">
                            <div className="flex items-center gap-3 w-1/2">
                              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs shrink-0">{index + 1}</div>
                              <input 
                                type="text" 
                                value={step.name} 
                                onChange={e => updateStep(step.id, { name: e.target.value })}
                                className="font-black text-slate-800 bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-100 rounded px-2 w-full text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <select 
                                value={step.type} 
                                onChange={e => updateStep(step.id, { type: e.target.value as StepType })}
                                className="p-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-bold text-xs appearance-none"
                              >
                                <option value="RUN_TASK">הפעל משימה (Run Task)</option>
                                <option value="BRANCH">תנאי (Branch/If-Then)</option>
                                <option value="WAIT">המתן (Wait for Condition)</option>
                                <option value="CALL_PROCESS">קרא לתהליך (Call Process)</option>
                              </select>
                              <button onClick={() => removeStep(step.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                            </div>
                          </div>
                          
                          <div className="p-6">
                            {step.type === 'RUN_TASK' && step.task && (
                              <div className="space-y-6">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">סוג משימה</label>
                                  <select 
                                    value={step.task.type} 
                                    onChange={e => updateStep(step.id, { task: { ...step.task, type: e.target.value as TaskType } })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold text-sm appearance-none"
                                  >
                                    <optgroup label="Communication">
                                      <option value="EMAIL">שלח אימייל (Email)</option>
                                      <option value="SMS">שלח הודעה (Push/SMS)</option>
                                    </optgroup>
                                    <optgroup label="Data Actions">
                                      <option value="SET_VALUES">עדכן ערכים בשורה (Set Column Values)</option>
                                      <option value="EXECUTE_ROWS">הפעל על שורות (Execute Action on Rows)</option>
                                      <option value="ADD_ROW">הוסף שורה חדשה (Add a Row)</option>
                                    </optgroup>
                                    <optgroup label="Files & External">
                                      <option value="FILE">צור קובץ (Generate PDF/CSV)</option>
                                      <option value="WEBHOOK">קריאת רשת (Webhook)</option>
                                    </optgroup>
                                  </select>
                                </div>

                                {/* Task Specific Configurations */}
                                {step.task.type === 'EMAIL' && (
                                  <div className="space-y-4 animate-in fade-in">
                                    <div className="space-y-2">
                                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest block px-1 flex items-center gap-2">
                                        Google Doc Template ID
                                        <div className="group relative">
                                          <HelpCircle size={14} className="text-slate-400 cursor-help" />
                                          <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
                                            העתק את המזהה מכתובת ה-URL של ה-Google Doc (המחרוזת שבין /d/ לבין /edit). ניתן גם להדביק את הכתובת המלאה והמערכת תחלץ את המזהה אוטומטית.
                                          </div>
                                        </div>
                                      </label>
                                      <input 
                                        type="text" 
                                        placeholder="e.g. 1A2B3C4D5E6F7G8H9I0J..." 
                                        value={step.task.googleDocTemplateId || ''} 
                                        onChange={e => {
                                          let val = e.target.value;
                                          // Smart Extraction: Extract ID from URL if pasted
                                          const match = val.match(/\/d\/(.*?)(\/|$)/);
                                          if (match && match[1]) {
                                            val = match[1];
                                          }
                                          updateStep(step.id, { task: { ...step.task, googleDocTemplateId: val } });
                                        }} 
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:border-blue-500 outline-none transition-all" 
                                        dir="ltr" 
                                      />
                                      <button
                                        onClick={() => handleGenerateTemplate(step.id)}
                                        disabled={generatingTemplate}
                                        className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors disabled:opacity-50"
                                      >
                                        {generatingTemplate ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                        {generatingTemplate ? 'מייצר שבלונה...' : 'צור שבלונה אוטומטית (Generate Template)'}
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <input type="text" placeholder="אל (To): <<[EmailColumn]>>" value={step.task.to || ''} onChange={e => updateStep(step.id, { task: { ...step.task, type: 'EMAIL', to: e.target.value } })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono" dir="ltr" />
                                      <input type="text" placeholder="נושא (Subject)" value={step.task.subject || ''} onChange={e => updateStep(step.id, { task: { ...step.task, type: 'EMAIL', subject: e.target.value } })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" />
                                    </div>
                                    <textarea placeholder="תוכן ההודעה (Body)... תומך ב-<<[ColumnName]>>" value={step.task.body || ''} onChange={e => updateStep(step.id, { task: { ...step.task, type: 'EMAIL', body: e.target.value } })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono min-h-[100px]" dir="ltr" />
                                    <div className="flex flex-col gap-3">
                                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                                        <input type="checkbox" checked={step.task.attachment || false} onChange={e => updateStep(step.id, { task: { ...step.task, type: 'EMAIL', attachment: e.target.checked } })} className="w-4 h-4 rounded text-blue-600" />
                                        צרף קובץ PDF של הרשומה
                                      </label>
                                      
                                      {step.task.attachment && (
                                        <div className="pl-6 space-y-2 animate-in slide-in-from-left-2 duration-300">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">שם קובץ מצורף (Attachment Name)</label>
                                          <input 
                                            type="text" 
                                            placeholder="e.g. Report_<<[Customer_Name]>>.pdf" 
                                            value={step.task.attachmentName || ''} 
                                            onChange={e => updateStep(step.id, { task: { ...step.task, attachmentName: e.target.value } })} 
                                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:border-blue-500 outline-none"
                                            dir="ltr"
                                          />
                                          <p className="text-[10px] text-slate-400">ניתן להשתמש ב-&lt;&lt;[ColumnName]&gt;&gt; בשם הקובץ.</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {step.task.type === 'SET_VALUES' && (
                                  <div className="space-y-4 animate-in fade-in bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div className="text-sm font-bold text-slate-700 mb-2">ערכים לעדכון:</div>
                                    {(step.task.updates || []).map((update, uIdx) => (
                                      <div key={uIdx} className="flex gap-2">
                                        <input type="text" placeholder="Column Name" value={update.column} onChange={e => { const newUpdates = [...(step.task?.updates || [])]; newUpdates[uIdx].column = e.target.value; updateStep(step.id, { task: { ...step.task, type: 'SET_VALUES', updates: newUpdates } }); }} className="w-1/3 p-2 border rounded-lg font-mono text-xs" dir="ltr" />
                                        <input type="text" placeholder="Value Formula (e.g. [_THISROW].[Price] * 2)" value={update.value} onChange={e => { const newUpdates = [...(step.task?.updates || [])]; newUpdates[uIdx].value = e.target.value; updateStep(step.id, { task: { ...step.task, type: 'SET_VALUES', updates: newUpdates } }); }} className="flex-1 p-2 border rounded-lg font-mono text-xs" dir="ltr" />
                                      </div>
                                    ))}
                                    <button onClick={() => updateStep(step.id, { task: { ...step.task, type: 'SET_VALUES', updates: [...(step.task?.updates || []), { column: '', value: '' }] } })} className="text-xs font-bold text-blue-600 hover:underline">+ הוסף עמודה</button>
                                  </div>
                                )}

                                {step.task.type === 'WEBHOOK' && (
                                  <div className="space-y-4 animate-in fade-in">
                                    <div className="flex gap-2">
                                      <select value={step.task.method || 'POST'} onChange={e => updateStep(step.id, { task: { ...step.task, type: 'WEBHOOK', method: e.target.value } })} className="w-24 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm">
                                        <option>POST</option><option>GET</option><option>PUT</option>
                                      </select>
                                      <input type="text" placeholder="URL (e.g. https://api.example.com/hook)" value={step.task.url || ''} onChange={e => updateStep(step.id, { task: { ...step.task, type: 'WEBHOOK', url: e.target.value } })} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono" dir="ltr" />
                                    </div>
                                    <textarea placeholder="JSON Body Template..." value={step.task.bodyTemplate || ''} onChange={e => updateStep(step.id, { task: { ...step.task, type: 'WEBHOOK', bodyTemplate: e.target.value } })} className="w-full p-3 bg-slate-900 text-emerald-400 border border-slate-800 rounded-xl text-sm font-mono min-h-[100px]" dir="ltr" />
                                  </div>
                                )}
                                
                                {/* Add other task type UIs as needed, keeping it concise for this implementation */}
                                {['SMS', 'EXECUTE_ROWS', 'ADD_ROW', 'FILE'].includes(step.task.type) && (
                                  <div className="p-4 bg-orange-50 text-orange-700 rounded-xl text-sm font-bold border border-orange-100">
                                    ממשק הגדרות עבור סוג משימה זה זמין בגרסה המלאה.
                                  </div>
                                )}

                              </div>
                            )}

                            {step.type === 'BRANCH' && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">תנאי (If this is true...)</label>
                                  <input type="text" placeholder="לדוגמה: [Total] > 1000" value={step.condition || ''} onChange={e => updateStep(step.id, { condition: e.target.value })} className="w-full p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-sm outline-none" dir="ltr" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-4 border border-emerald-200 bg-emerald-50/30 rounded-xl">
                                    <div className="text-xs font-black text-emerald-600 mb-2">Then (True)</div>
                                    <button className="text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-lg w-full">+ הוסף שלב</button>
                                  </div>
                                  <div className="p-4 border border-red-200 bg-red-50/30 rounded-xl">
                                    <div className="text-xs font-black text-red-600 mb-2">Else (False)</div>
                                    <button className="text-xs font-bold text-red-600 bg-red-100 px-3 py-1.5 rounded-lg w-full">+ הוסף שלב</button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Right Sidebar: Expression Assistant */}
              {showAssistant && (
                <div className="w-1/4 bg-slate-900 text-slate-300 border-r border-slate-800 p-4 overflow-y-auto animate-in slide-in-from-left-8 hidden lg:block">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Code2 size={16}/> Expression Assistant</h3>
                    <button onClick={() => setShowAssistant(false)} className="text-slate-500 hover:text-white"><X size={16}/></button>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Table Columns</div>
                      <div className="space-y-1">
                        {tableColumns.length === 0 ? (
                          <div className="text-xs text-slate-500 italic">בחר טבלת יעד כדי לראות עמודות</div>
                        ) : (
                          tableColumns.map(c => (
                            <div key={c.column_name} className="flex justify-between items-center p-2 hover:bg-slate-800 rounded cursor-pointer group">
                              <span className="text-xs font-mono text-emerald-400">[{c.column_name}]</span>
                              <span className="text-[10px] text-slate-600 uppercase">{c.data_type}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">System Variables</div>
                      <div className="space-y-1">
                        {['[_THISROW_BEFORE]', '[_THISROW_AFTER]', 'USEREMAIL()', 'NOW()', 'TODAY()'].map(v => (
                          <div key={v} className="p-2 hover:bg-slate-800 rounded cursor-pointer text-xs font-mono text-blue-400">{v}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Debugger / Test Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2"><Terminal size={18} className="text-emerald-500"/> Bot Debugger</h3>
              <button onClick={() => setTestModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-slate-400 block mb-2">Select ROWID to Test:</label>
                <input 
                  type="text" 
                  value={testRecordId}
                  onChange={e => setTestRecordId(e.target.value)}
                  placeholder="e.g. 0GPP5TJZ5..." 
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm text-white font-mono outline-none focus:border-emerald-500" 
                />
              </div>
              <button 
                onClick={handleRunSimulation}
                disabled={simulating}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {simulating ? <Loader2 className="animate-spin" size={18} /> : <><Play size={18} fill="currentColor" /> Run Simulation</>}
              </button>
              
              <div className="mt-4 p-4 bg-black rounded-xl border border-slate-800 font-mono text-xs text-slate-300 h-48 overflow-y-auto space-y-2">
                {simulationLogs.length === 0 ? (
                  <div className="text-slate-500 italic">לחץ על "Run Simulation" כדי להתחיל בבדיקה...</div>
                ) : (
                  simulationLogs.map((log, i) => (
                    <div key={i} className={log.includes('ERROR') ? 'text-red-400' : log.includes('SUCCESS') ? 'text-emerald-400' : 'text-slate-300'}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TriggersPage;
