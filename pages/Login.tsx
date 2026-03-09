
import React from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { Loader2, ShieldCheck } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = React.useState(() => localStorage.getItem('last_login_email') || 'admin@fireguard.co.il');
  const [password, setPassword] = React.useState('123456');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await authService.login(email, password);
      if (user) {
        localStorage.setItem('last_login_email', email);
        onLogin(user);
      } else {
        setError('פרטי התחברות שגויים או משתמש לא פעיל');
      }
    } catch (err) {
      setError('שגיאת תקשורת עם השרת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 md:p-6" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden border border-slate-700/50">
        <div className="bg-blue-600 p-6 md:p-10 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 opacity-50"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="p-3 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
              <ShieldCheck size={32} className="md:w-10 md:h-10 text-white" />
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight">FireGuard</h1>
            <p className="mt-2 text-blue-100 opacity-90 font-medium text-xs md:text-base">ניהול מערכות גילוי אש בישראל</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest block px-1">דואר אלקטרוני</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 md:py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none text-right focus:border-blue-500 focus:bg-white transition-all font-bold"
              placeholder="name@company.co.il"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest block px-1">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 md:py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none text-right focus:border-blue-500 focus:bg-white transition-all font-bold"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 md:py-4 px-4 rounded-xl md:rounded-2xl font-black text-base md:text-lg hover:bg-blue-700 flex justify-center items-center shadow-xl shadow-blue-200 transition-all active:scale-95 disabled:opacity-70 min-h-[44px]"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'כניסה למערכת'}
            </button>
          </div>

          <p className="text-center text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest mt-4">
            © {new Date().getFullYear()} FireGuard Israel. All Rights Reserved.
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
