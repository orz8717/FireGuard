
import React from 'react';
import { User, FormTemplate, InspectionType, InspectionStatus } from '../types';
import { dbService } from '../services/dbService';
import { LayoutGrid, Loader2, Search, ArrowRight, ClipboardList } from 'lucide-react';
import DynamicForm from '../components/DynamicForm';
import { useSync } from '../src/context/SyncContext';

interface UpdateTablesProps {
  user: User;
}

const UpdateTables: React.FC<UpdateTablesProps> = ({ user }) => {
  const { syncData } = useSync();
  const [loading, setLoading] = React.useState(true);
  const [templates, setTemplates] = React.useState<FormTemplate[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedTemplate, setSelectedTemplate] = React.useState<FormTemplate | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [dynamicTableData, setDynamicTableData] = React.useState<Record<string, any[]>>({});

  React.useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const allTemplates = await dbService.getFormTemplates();
      // Filter templates starting with "עדכון טבלת"
      const filtered = allTemplates.filter(t => 
        t.isActive && t.name.startsWith('עדכון טבלת')
      );
      setTemplates(filtered);
      
      // Load dynamic data for lookups
      const dtd = await syncData(user.name);
      setDynamicTableData(dtd);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (values: Record<string, any>) => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      const tableName = selectedTemplate.tableName || 'inspections';
      const serialNumber = await dbService.generateInspectionSerialNumber(InspectionType.OTHER, tableName);
      
      const payload = {
        inspectionSerialNumber: serialNumber,
        inspectionType: InspectionType.OTHER,
        templateName: selectedTemplate.name,
        customerId: values.customerId || null,
        technicianId: user.id,
        inspectionDate: new Date().toISOString(),
        status: InspectionStatus.SUBMITTED,
        data: values
      };

      await dbService.addInspection(payload, tableName);
      setSelectedTemplate(null);
      alert('הנתונים נשמרו בהצלחה');
    } catch (err) {
      console.error('Error saving form:', err);
      alert('שגיאה בשמירת הנתונים');
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedTemplate) {
    return (
      <div className="space-y-4 animate-in fade-in duration-500" dir="rtl">
        <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
          <button 
            onClick={() => setSelectedTemplate(null)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowRight size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{selectedTemplate.name}</h2>
            <p className="text-sm text-slate-500">{selectedTemplate.description}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <DynamicForm 
            template={selectedTemplate}
            onSubmit={handleFormSubmit}
            onCancel={() => setSelectedTemplate(null)}
            currentUser={user}
            contextData={dynamicTableData}
            draftId={`update_table_${selectedTemplate.id}`}
          />
        </div>

        {saving && (
          <div className="fixed inset-0 bg-slate-900/50 z-[300] flex items-center justify-center">
            <div className="bg-white p-6 rounded-2xl shadow-xl flex items-center gap-4">
              <Loader2 className="animate-spin text-blue-600" size={24} />
              <span className="font-bold">שומר נתונים...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <LayoutGrid className="text-blue-600" />
            עדכון טבלאות
          </h1>
          <p className="text-slate-500 mt-1">בחר טופס לעדכון נתונים בטבלאות המערכת</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="חיפוש טופס..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-blue-600">
          <Loader2 className="animate-spin mb-4" size={40} />
          <p className="font-bold">טוען טפסים...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center">
          <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">לא נמצאו טפסים</h3>
          <p className="text-slate-500">לא נמצאו טפסים המתחילים ב-"עדכון טבלת"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t)}
              className="flex flex-col items-start p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-right group"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <ClipboardList size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">{t.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-2">{t.description || 'אין תיאור זמין'}</p>
              <div className="mt-4 flex items-center gap-2 text-blue-600 font-bold text-sm">
                <span>פתח טופס</span>
                <ArrowRight size={16} className="rotate-180" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default UpdateTables;
