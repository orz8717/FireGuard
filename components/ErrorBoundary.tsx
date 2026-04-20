import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-slate-50 p-8" dir="rtl">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center border border-red-100">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-red-600 mb-2">אירעה שגיאה בלתי צפויה</h1>
            <p className="text-slate-500 text-sm mb-6">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-bold"
            >
              רענן עמוד
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
