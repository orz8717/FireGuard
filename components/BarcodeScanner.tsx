import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

interface BarcodeScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onResult, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerId = 'barcode-scanner-region';

  useEffect(() => {
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(scannerId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            // Success
            stopScanner().then(() => {
              onResult(decodedText);
            });
          },
          (errorMessage) => {
            // This is called for every frame where no code is found, 
            // so we don't want to log it or show it as an error.
          }
        );
        setIsCameraReady(true);
      } catch (err: any) {
        console.error("Camera access error:", err);
        if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
          setError("Camera permission denied. Please enable camera access in your browser settings.");
        } else {
          setError("Could not access camera. Please ensure no other app is using it.");
        }
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6">
      <div className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <Camera size={18} />
            </div>
            <h3 className="font-black text-slate-800">Scan Barcode</h3>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scanner Area */}
        <div className="relative flex-1 bg-black flex flex-center justify-center overflow-hidden min-h-[300px]">
          {!error && (
            <div id={scannerId} className="w-full h-full" />
          )}
          
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white bg-slate-900">
              <AlertCircle size={48} className="text-red-500 mb-4" />
              <p className="font-bold text-lg mb-2">Camera Error</p>
              <p className="text-slate-400 text-sm max-w-xs">{error}</p>
              <button 
                onClick={handleClose}
                className="mt-6 px-6 py-2 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {!isCameraReady && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-900">
              <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4" />
              <p className="text-slate-400 font-medium">Initializing camera...</p>
            </div>
          )}

          {isCameraReady && !error && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-purple-500 rounded-3xl relative">
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-purple-500 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-purple-500 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-purple-500 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-purple-500 rounded-br-lg" />
                
                {/* Scanning Line Animation */}
                <div className="absolute left-0 right-0 h-0.5 bg-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.5)] animate-[scan_2s_ease-in-out_infinite]" />
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-4 bg-slate-50 text-center">
          <p className="text-xs text-slate-500 font-medium">
            Position the barcode within the frame to scan
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
        #barcode-scanner-region video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}} />
    </div>
  );
};

export default BarcodeScanner;
