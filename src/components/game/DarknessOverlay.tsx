'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Zap, AlertTriangle, QrCode, Flashlight, Lightbulb, LightbulbOff, X } from 'lucide-react';

interface DarknessOverlayProps {
  onOpenGenerator?: () => void;
  generatorLocationName?: string;
}

export function DarknessOverlay({
  onOpenGenerator,
  generatorLocationName = 'Quadro de Luz (POINT_01)',
}: DarknessOverlayProps) {
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isTorchSupported, setIsTorchSupported] = useState<boolean>(true);
  const [torchError, setTorchError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  // Desligar lanterna e liberar câmera
  const stopTorch = useCallback(() => {
    try {
      if (trackRef.current) {
        // Tentar desligar o torch se possível
        try {
          (trackRef.current as any).applyConstraints({
            advanced: [{ torch: false }],
          });
        } catch {}
        trackRef.current.stop();
        trackRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setIsTorchOn(false);
    } catch (err) {
      console.warn('Erro ao desligar lanterna:', err);
    }
  }, []);

  // Ligar/Desligar lanterna real do celular
  const toggleTorch = async () => {
    if (typeof window === 'undefined') return;

    if (isTorchOn) {
      stopTorch();
      if (navigator.vibrate) navigator.vibrate(50);
      return;
    }

    try {
      setTorchError(null);
      if (navigator.vibrate) navigator.vibrate([60, 40, 80]);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Câmera/Lanterna não suportada neste dispositivo.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          advanced: [{ torch: true }] as any,
        },
      });

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      // Verificar suporte de hardware
      const capabilities = (track.getCapabilities && track.getCapabilities()) as any;
      if (capabilities && 'torch' in capabilities) {
        await (track as any).applyConstraints({
          advanced: [{ torch: true }],
        });
      } else {
        // Fallback: mesmo sem flag estrita, aplicar constraints
        try {
          await (track as any).applyConstraints({
            advanced: [{ torch: true }],
          });
        } catch {}
      }

      setIsTorchOn(true);
    } catch (err: any) {
      console.warn('Falha ao acionar lanterna de hardware:', err);
      // Fallback: modo de iluminação de tela
      setIsTorchOn(true);
      setTorchError('Lanterna de tela ativa');
      setIsTorchSupported(false);
    }
  };

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      stopTorch();
    };
  }, [stopTorch]);

  return (
    <>
      {/* Vinheta/Ambiente de escuridão sutil não-bloqueante na tela */}
      <div className="fixed inset-0 pointer-events-none z-20 shadow-[inset_0_0_90px_rgba(0,0,0,0.85)] border-4 border-amber-500/20" />

      {/* Banner Superior Fixo de Debuff de Luzes com Acesso Rápido à Lanterna e Reparo */}
      <div className="fixed top-2.5 inset-x-3 z-30 flex flex-col items-center gap-2 select-none animate-in fade-in slide-in-from-top-3">
        <div className="w-full max-w-md bg-[#0f1422]/95 border-2 border-amber-500/80 rounded-2xl p-2.5 shadow-[0_0_25px_rgba(245,158,11,0.35)] backdrop-blur-md flex items-center justify-between gap-2">
          {/* Informação do Debuff */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-xl bg-amber-950/90 border border-amber-500/60 text-yellow-400 shrink-0 animate-pulse">
              <Zap className="w-4 h-4 fill-yellow-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
                  className="text-xs uppercase tracking-wider text-amber-300 truncate"
                >
                  ⚡ APAGÃO: LUZES CORTADAS
                </span>
              </div>
              <p className="text-[10px] text-slate-300 font-mono truncate">
                Luzes físicas desligadas no ambiente
              </p>
            </div>
          </div>

          {/* Botões de Ação Rápida */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Botão de Ligar Lanterna Real */}
            <button
              type="button"
              onClick={toggleTorch}
              className={`px-3 py-2 rounded-xl border flex items-center gap-1.5 text-xs font-black uppercase transition-all active:scale-95 cursor-pointer shadow-md ${
                isTorchOn
                  ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 border-white shadow-[0_0_20px_rgba(250,204,21,0.8)] animate-pulse'
                  : 'bg-slate-900 border-slate-700 text-amber-400 hover:border-amber-400 hover:bg-slate-800'
              }`}
            >
              <Flashlight className="w-3.5 h-3.5" />
              <span>{isTorchOn ? 'LANTERNA ON' : 'LANTERNA'}</span>
            </button>

            {/* Botão de Escanear Disjuntor */}
            {onOpenGenerator && (
              <button
                type="button"
                onClick={onOpenGenerator}
                title="Escanear Disjuntor"
                className="p-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white border border-amber-400/50 active:scale-95 cursor-pointer shadow-md"
              >
                <QrCode className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
