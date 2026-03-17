
import React from 'react';
import { FormTemplate, User, UserRole } from '../types';
import { dbService } from '../services/dbService';
import { Database, Search, Loader2, ClipboardList, ArrowLeft } from 'lucide-react';
import DynamicForm from '../components/DynamicForm';
import { useSync } from '../src/context/SyncContext';

interface TableUpdatesProps {
  user: User;
}

const TableUpdates: React.FC<TableUpdatesProps> = ({ user }) => {
  const { syncData } = useSync();
  const [loading, setLoading] = React.useState(true);
  const [availableTemplates, setAvailableTemplates] = React.useState<FormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = React.useState<FormTemplate | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [savingStatus, setSavingStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const allTemplates = await dbService.getFormTemplates();
      // Filter templates that start with "עדכון טבלת"
      const filtered = allTemplates.filter(t => 
        t.isActive && t.name.startsWith('עדכון טבלת')
      );
      setAvailableTemplates(filtered);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (values: Record<string, any>) => {
    if (!selectedTemplate) return;
    
    setSavingStatus('שומר נתונים...');
    try {
      const tableName = selectedTemplate.tableName || 'inspections';
      
      // If it's a custom table update, we use addInspection which handles custom tables
      await dbService.addInspection({
        templateName: selectedTemplate.name,
        technicianId: user.id,
        inspectionDate: new Date().toISOString(),
        status: 'COMPLETED' as any,
        data: values
      }, tableName);

      setSavingStatus('הנתונים נשמרו בהצלחה!');
      setTimeout(() => {
        setSavingStatus(null);
        setSelectedTemplate(null);
      }, 2000);
    } catch (err: any) {
      setSavingStatus(`שגיאה בשמירה: ${err.message}`);
    }
  };

  const filteredTemplates = availableTemplates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedTemplate) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSelectedTemplate(null)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{selectedTemplate.name}</h2>
              <p className="text-sm text-slate-500">{selectedTemplate.description}</p>
            </div>
          </div>
        </div>

        {savingStatus && (
          <div className={`p-4 rounded-xl border ${savingStatus.includes('שגיאה') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'} animate-in zoom-in duration-300`}>
            <div className="flex items-center gap-3">
              {savingStatus.includes('שומר') ? <Loader2 size={20} className="animate-spin" /> : <Database size={20} />}
              <span className="font-medium">{savingStatus}</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <DynamicForm 
            template={selectedTemplate}
            onSubmit={handleFormSubmit}
            onCancel={() => setSelectedTemplate(null)}
            currentUser={user}
            draftId={`table_update_${selectedTemplate.id}`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Database className="text-blue-600" />
            עדכון טבלאות
          </h1>
          <p className="text-slate-500 mt-1">בחר טופס לעדכון נתונים בטבלאות המערכת</p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="חיפוש טופס..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
          <Loader2 size={40} className="text-blue-600 animate-spin mb-4" />
          <p className="text-slate-500 font-medium">טוען טפסים זמינים...</p>
        </div>
      ) : filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t)}
              className="group flex flex-col items-start p-6 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all text-right"
            >
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <ClipboardList size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{t.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-4">{t.description || 'אין תיאור זמין'}</p>
              <div className="mt-auto flex items-center gap-2 text-blue-600 font-semibold text-sm">
                <span>פתח טופס</span>
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4">
            <Search size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">לא נמצאו טפסים</h3>
          <p className="text-slate-500">לא נמצאו טפסים המתחילים במילים "עדכון טבלת"</p>
        </div>
      )}
    </div>
  );
};

export default TableUpdates;
