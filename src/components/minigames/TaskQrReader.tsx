"use client";

import React, { useState, useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { QrCode, Camera, Flashlight, AlertCircle, CheckCircle2, X, Keyboard } from "lucide-react";

interface TaskQrReaderProps {
  expectedToken?: string;
  onVerificationSuccess?: () => void;
  onScanSuccess?: (code: string) => void;
  onCancel?: () => void;
  expectedTaskTitle?: string;
  expectedTaskLocation?: string;
}

export const TaskQrReader: React.FC<TaskQrReaderProps> = ({
  expectedToken,
  onVerificationSuccess,
  onScanSuccess,
  onCancel,
  expectedTaskTitle,
  expectedTaskLocation,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>("");
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [isScanned, setIsScanned] = useState<boolean>(false);
  const [scannedCode, setScannedCode] = useState<string>("");

  // Sound feedback using Web Audio API
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio context might be restricted
    }
  };

  const triggerSuccess = (code: string) => {
    // Validação Phygital: Se expectedToken for especificado, verificar se o QR Code bate com o token do nó
    if (
      expectedToken &&
      code.trim().toUpperCase() !== expectedToken.trim().toUpperCase() &&
      !code.trim().toUpperCase().includes(expectedToken.trim().toUpperCase()) &&
      !expectedToken.trim().toUpperCase().includes(code.trim().toUpperCase())
    ) {
      setErrorMessage("QR Code incorreto! Você está no local errado para esta tarefa.");
      return;
    }

    setErrorMessage(null);
    setIsScanned(true);
    setScannedCode(code);
    playBeep();
    if ("vibrate" in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
    setTimeout(() => {
      if (onVerificationSuccess) onVerificationSuccess();
      if (onScanSuccess) onScanSuccess(code);
    }, 1200);
  };

  // Start Camera stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animId: number;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setHasPermission(false);
          setErrorMessage("Câmera não suportada neste navegador.");
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            if (err.name !== "AbortError") {
              console.error("Erro ao reproduzir stream de vídeo:", err);
            }
          });
          setHasPermission(true);
        }

        // Setup scan frame loop if BarcodeDetector is supported
        if ("BarcodeDetector" in window) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ["qr_code"],
          });

          const scanFrame = async () => {
            if (videoRef.current && videoRef.current.readyState === 4 && !isScanned) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  const codeValue = barcodes[0].rawValue;
                  if (codeValue) {
                    triggerSuccess(codeValue);
                    return;
                  }
                }
              } catch {
                // Ignore detector errors on frames
              }
            }
            if (!isScanned) {
              animId = requestAnimationFrame(scanFrame);
            }
          };

          animId = requestAnimationFrame(scanFrame);
        }
      } catch (err) {
        console.error("Erro ao acessar câmera:", err);
        setHasPermission(false);
        setErrorMessage("Permissão de câmera negada ou indisponível.");
      }
    };

    startCamera();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    triggerSuccess(manualCode.trim());
  };

  return (
    <div className="relative w-full max-w-md mx-auto h-[85vh] max-h-[700px] bg-slate-950 text-white rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl flex flex-col justify-between p-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between z-20 bg-slate-900/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <QrCode className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-cyan-400 uppercase tracking-wider">
              {expectedTaskTitle || "VALIDADOR PHY GITAL"}
            </h2>
            <p className="text-xs text-slate-400">
              {expectedTaskLocation ? `Local: ${expectedTaskLocation}` : "Aproxime o QR Code da Tarefa"}
            </p>
          </div>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 my-4 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
        {/* Camera Video Stream */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan Reticle & Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Dimmed background around frame */}
          <div className="absolute inset-0 bg-slate-950/40" />

          {/* Reticle Square */}
          <div className="relative w-64 h-64 rounded-2xl border-2 border-cyan-400/60 shadow-[0_0_25px_rgba(34,211,238,0.2)] bg-cyan-950/10 backdrop-blur-[1px] flex flex-col justify-between p-2">
            {/* HUD Corner Markers */}
            <div className="flex justify-between">
              <div className="w-5 h-5 border-t-4 border-l-4 border-cyan-400 rounded-tl" />
              <div className="w-5 h-5 border-t-4 border-r-4 border-cyan-400 rounded-tr" />
            </div>

            {/* Laser Line */}
            {!isScanned && (
              <div className="w-full h-0.5 bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-[scan_2s_ease-in-out_infinite]" />
            )}

            <div className="flex justify-between">
              <div className="w-5 h-5 border-b-4 border-l-4 border-cyan-400 rounded-bl" />
              <div className="w-5 h-5 border-b-4 border-r-4 border-cyan-400 rounded-br" />
            </div>
          </div>
        </div>

        {/* Permission / Error State */}
        {hasPermission === false && !showManualInput && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-30">
            <AlertCircle className="w-12 h-12 text-amber-400 mb-3 animate-bounce" />
            <h3 className="text-lg font-bold text-amber-400">Câmera Indisponível</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              {errorMessage || "Não foi possível acessar a câmera do dispositivo."}
            </p>
            <button
              onClick={() => setShowManualInput(true)}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs uppercase transition-all shadow-lg shadow-cyan-500/20"
            >
              Inserir Código Manualmente
            </button>
          </div>
        )}

        {/* Success Overlay */}
        {isScanned && (
          <div className="absolute inset-0 bg-cyan-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-40 animate-in fade-in zoom-in duration-200">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-3 animate-bounce" />
            <h3 className="text-xl font-extrabold text-emerald-400 uppercase tracking-widest">
              QR Code Validado!
            </h3>
            <p className="text-xs font-mono text-cyan-200 mt-2 bg-cyan-900/60 px-3 py-1.5 rounded-lg border border-cyan-700">
              CÓDIGO: {scannedCode}
            </p>
          </div>
        )}
      </div>

      {/* Manual Input Modal/Drawer */}
      {showManualInput && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-lg p-6 flex flex-col justify-center animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-sm text-cyan-400 uppercase">Entrada Manual</h3>
            </div>
            <button
              onClick={() => setShowManualInput(false)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Digite o Código Impresso no QR Code da Tarefa:
              </label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ex: TASK-ELEC-01"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-400 font-mono uppercase tracking-wider"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowManualInput(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 rounded-xl text-xs uppercase"
              >
                Voltar à Câmera
              </button>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="flex-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl text-xs uppercase shadow-lg shadow-cyan-500/20"
              >
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Footer Controls */}
      <div className="z-20 flex items-center justify-between gap-2 bg-slate-900/80 backdrop-blur-md p-2 rounded-2xl border border-slate-800">
        <button
          onClick={() => setShowManualInput(true)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs transition-colors"
        >
          <Keyboard className="w-4 h-4 text-cyan-400" />
          <span>Digitar Código</span>
        </button>

        <div className="flex items-center gap-1 text-[10px] text-slate-500 px-3">
          <Camera className="w-3.5 h-3.5" />
          <span>SCANNER ATIVO</span>
        </div>
      </div>
    </div>
  );
};
