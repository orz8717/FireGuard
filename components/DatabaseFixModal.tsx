import React from 'react';
import { X, Copy, Check } from 'lucide-react';

interface DatabaseFixModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: string;
}

export const DatabaseFixModal: React.FC<DatabaseFixModalProps> = ({ isOpen, onClose, error }) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const sqlScript = `-- Run this in Supabase SQL Editor to fix the user creation error

-- 1. Drop the broken trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Create a safe handler function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'USER'),
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. Re-create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-6 bg-red-50 border-b border-red-100 flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-red-800 flex items-center gap-2">
              ⚠️ שגיאת מסד נתונים (Database Error)
            </h3>
            <p className="text-red-600 mt-1 text-sm">
              המערכת זיהתה בעיה בטריגרים של Supabase שמונעת יצירת משתמשים חדשים.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm font-mono text-gray-700 break-all">
            {error}
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-gray-900">כיצד לתקן?</h4>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm">
              <li>פתח את <a href="https://supabase.com/dashboard/project/_/sql" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-medium">Supabase SQL Editor</a></li>
              <li>העתק את הסקריפט למטה</li>
              <li>הדבק אותו בעורך ה-SQL והרץ אותו (Run)</li>
            </ol>
          </div>

          <div className="relative group">
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 hover:bg-white text-gray-700 text-xs font-medium rounded-lg shadow-sm border border-gray-200 transition-all"
              >
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                {copied ? 'הועתק!' : 'העתק סקריפט'}
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-50 p-4 rounded-xl text-xs overflow-x-auto font-mono leading-relaxed border border-slate-800">
              {sqlScript}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl transition-all shadow-sm active:scale-95"
          >
            הבנתי, סגור
          </button>
        </div>
      </div>
    </div>
  );
};
