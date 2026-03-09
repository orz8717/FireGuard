
import React from 'react';
import { authService } from '../services/authService';
import { Shield, UserPlus, Mail, Lock, Phone, User as UserIcon, Loader2, ArrowRight } from 'lucide-react';

interface RegisterProps {
  onBackToLogin: () => void;
  onRegisterSuccess: () => void;
  backButtonText?: string;
}

const Register: React.FC<RegisterProps> = ({ onBackToLogin, onRegisterSuccess, backButtonText }) => {
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }

    if (formData.password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: signUpError } = await authService.signUp(
        formData.email,
        formData.password,
        formData.name,
        formData.phone
      );

      if (signUpError) {
        setError(signUpError);
      } else {
        setSuccess(true);
        setTimeout(() => {
          onRegisterSuccess();
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'אירעה שגיאה בתהליך ההרשמה');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
            <Shield size={40} />
          </div>
          <h2 className="text-3xl font-bold text-slate-800">ההרשמה הצליחה!</h2>
          <p className="text-slate-600">
            החשבון שלך נוצר בהצלחה. במידה והגדרת אימות אימייל, יש לאשר את ההרשמה במייל ששלחנו אליך.
            <br />
            מעביר אותך לדף ההתחברות...
          </p>
          <div className="flex justify-center">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500">
        <div className="bg-blue-600 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <Shield className="w-64 h-64 -translate-x-20 -translate-y-20 rotate-12" />
          </div>
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <UserPlus size={32} />
            </div>
            <h1 className="text-3xl font-bold">יצירת חשבון</h1>
            <p className="text-blue-100 mt-2">הצטרף למערכת ניהול גילוי אש</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex items-center gap-3 animate-in shake duration-300">
              <Shield size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <UserIcon className="absolute right-3 top-3 text-slate-400" size={20} />
              <input
                type="text"
                name="name"
                required
                placeholder="שם מלא"
                value={formData.name}
                onChange={handleChange}
                className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div className="relative">
              <Mail className="absolute right-3 top-3 text-slate-400" size={20} />
              <input
                type="email"
                name="email"
                required
                placeholder="כתובת אימייל"
                value={formData.email}
                onChange={handleChange}
                className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div className="relative">
              <Phone className="absolute right-3 top-3 text-slate-400" size={20} />
              <input
                type="tel"
                name="phone"
                placeholder="מספר טלפון"
                value={formData.phone}
                onChange={handleChange}
                className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="absolute right-3 top-3 text-slate-400" size={20} />
              <input
                type="password"
                name="password"
                required
                placeholder="סיסמה (מינימום 6 תווים)"
                value={formData.password}
                onChange={handleChange}
                className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="absolute right-3 top-3 text-slate-400" size={20} />
              <input
                type="password"
                name="confirmPassword"
                required
                placeholder="אימות סיסמה"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                <span>הרשמה למערכת</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-slate-500 hover:text-blue-600 text-sm font-medium transition-colors"
            >
              {backButtonText || 'כבר יש לך חשבון? התחבר כאן'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
