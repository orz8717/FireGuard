import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.PDF_417,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

interface BarcodeScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
}

const SCANNER_ID = 'barcode-scanner-region';

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onResult, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(SCANNER_ID, {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 280, height: 110 },
            experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          } as any,
          (decodedText) => {
            stopScanner().then(() => onResult(decodedText));
          },
          () => {}
        );

        setIsCameraReady(true);
      } catch (err: any) {
        const denied = err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied');
        setError(denied
          ? 'גישה למצלמה נדחתה. אפשר גישה למצלמה בהגדרות הדפדפן.'
          : 'לא ניתן לגשת למצלמה. ודא שאין אפליקציה אחרת שמשתמשת בה.');
      }
    };

    startScanner();
    return () => { stopScanner(); };
  }, []);

  const stopScanner = async () => {
    const s = scannerRef.current;
    if (s?.isScanning) {
      try { await s.stop(); s.clear(); } catch {}
    }
  };

  const handleClose = async () => { await stopScanner(); onClose(); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">

        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <Camera size={18} />
            </div>
            <h3 className="font-black text-slate-800">סריקת ברקוד</h3>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <X size={24} />
          </button>
        </div>

        {/* Camera area — fixed height so library doesn't double */}
        <div className="relative bg-black overflow-hidden" style={{ height: 320 }}>

          {/* Library mounts here — we constrain it strictly */}
          <div id={SCANNER_ID} style={{ width: '100%', height: '100%' }} />

          {/* Loading overlay */}
          {!isCameraReady && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white z-10">
              <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-3" />
              <p className="text-sm text-slate-400">מאתחל מצלמה...</p>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-white z-10">
              <AlertCircle size={40} className="text-red-400 mb-3" />
              <p className="font-bold mb-1">שגיאת מצלמה</p>
              <p className="text-slate-400 text-sm">{error}</p>
              <button onClick={handleClose} className="mt-4 px-5 py-2 bg-white text-slate-900 rounded-xl font-bold text-sm">
                סגור
              </button>
            </div>
          )}

          {/* Scan frame overlay — drawn on top, pointer-events-none */}
          {isCameraReady && !error && (
            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
              {/* dark mask top */}
              <div className="absolute inset-x-0 top-0 bg-black/50" style={{ height: 'calc(50% - 55px)' }} />
              {/* dark mask bottom */}
              <div className="absolute inset-x-0 bottom-0 bg-black/50" style={{ height: 'calc(50% - 55px)' }} />
              {/* dark mask left */}
              <div className="absolute left-0 bg-black/50" style={{ top: 'calc(50% - 55px)', height: 110, width: 'calc(50% - 140px)' }} />
              {/* dark mask right */}
              <div className="absolute right-0 bg-black/50" style={{ top: 'calc(50% - 55px)', height: 110, width: 'calc(50% - 140px)' }} />

              {/* bright scan box */}
              <div className="relative border-2 border-purple-400 rounded-lg" style={{ width: 280, height: 110 }}>
                <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-4 border-l-4 border-purple-500 rounded-tl" />
                <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-4 border-r-4 border-purple-500 rounded-tr" />
                <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-4 border-l-4 border-purple-500 rounded-bl" />
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-4 border-r-4 border-purple-500 rounded-br" />
                <div className="absolute inset-x-0 h-0.5 bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-[scanline_1.8s_ease-in-out_infinite]" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 text-center">
          <p className="text-xs text-slate-500">כוון את הברקוד לתוך המסגרת</p>
        </div>
      </div>

      <style>{`
        @keyframes scanline {
          0%, 100% { top: 8%; }
          50% { top: 85%; }
        }
        #${SCANNER_ID} > div { display: none !important; }
        #${SCANNER_ID} video {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        #${SCANNER_ID} canvas {
          position: absolute !important;
          left: -9999px !important;
          visibility: hidden !important;
        }
        #${SCANNER_ID} img { display: none !important; }
      `}</style>
    </div>
  );
};

export default BarcodeScanner;
