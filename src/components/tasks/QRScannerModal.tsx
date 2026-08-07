"use client";

import React, { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Camera, X, AlertCircle } from "lucide-react";

interface QRScannerModalProps {
  onScanSuccess: (qrToken: string) => void;
  onClose: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ onScanSuccess, onClose }) => {
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Inicializa o leitor de QR Code na div com id "qr-reader"
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      /* verbose= */ false
    );

    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        // Sucesso na leitura do token impresso na parede
        if (scannerRef.current) {
          scannerRef.current.clear()
            .then(() => {
              onScanSuccess(decodedText);
            })
            .catch((error) => {
              console.error("Erro ao limpar scanner pós-sucesso:", error);
              onScanSuccess(decodedText); // Prossegue mesmo se houver erro ao limpar
            });
        } else {
          onScanSuccess(decodedText);
        }
      },
      (error) => {
        // Erros comuns de varredura (frame vazio / sem QR code visível) são ignorados
        // para não poluir a interface do usuário com avisos a cada milissegundo.
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((error) => {
          console.error("Falha ao desmontar o scanner:", error);
        });
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-lg z-50 p-6 flex flex-col justify-between max-w-md mx-auto select-none font-sans border-x border-slate-800 shadow-2xl">
      {/* Glow Background Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header do Scanner */}
      <header className="flex justify-between items-center border-b border-slate-800 pb-4 z-10 relative">
        <div className="space-y-0.5">
          <h2 className="text-base font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
            <Camera className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span>Escanear Task</span>
          </h2>
          <p className="text-xs text-slate-400">Aponte para o QR Code físico no ambiente</p>
        </div>
        <button
          onClick={onClose}
          className="bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-300 w-10 h-10 rounded-2xl font-bold flex items-center justify-center hover:bg-slate-800 transition active:scale-95 shadow-md"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Caixa de Exibição da Câmera HTML5 */}
      <main className="my-auto space-y-4 z-10 relative">
        <div 
          id="qr-reader" 
          className="w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-inner flex flex-col justify-center [&_video]:rounded-2xl [&_video]:object-cover" 
        />
        
        {scanError && (
          <div className="bg-red-950/80 border border-red-500/50 text-red-200 text-xs p-3 rounded-2xl text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{scanError}</span>
          </div>
        )}
      </main>

      {/* Instrução ao Jogador */}
      <footer className="text-center pb-2 z-10 relative">
        <p className="text-xs text-slate-400 bg-slate-900/60 border border-slate-850 py-2.5 px-4 rounded-2xl italic">
          Mantenha o celular firme e centralizado no QR Code para a leitura.
        </p>
      </footer>
    </div>
  );
};
