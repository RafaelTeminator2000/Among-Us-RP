'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Zap, AlertTriangle, QrCode, Flashlight, Lightbulb, LightbulbOff } from 'lucide-react';

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
        throw new Error('Câmera/Lanterna não suportada neste navegador.');
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
      setTorchError('Lanterna ativada em modo tela (brilho alto)');
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
    <div
      className={`fixed inset-0 z-40 select-none overflow-hidden flex flex-col justify-between p-4 transition-all duration-300 ${
        isTorchOn
          ? 'bg-slate-950/85 backdrop-blur-[2px]'
          : 'bg-[#020617]/98'
      }`}
    >
      {/* Luz ambiente / Halo caso a lanterna esteja ligada na tela */}
      {isTorchOn && (
        <div className="pointer-events-none absolute inset-0 bg-radial from-cyan-400/20 via-sky-500/10 to-transparent animate-pulse" />
      )}

      {/* Alerta de Topo: Energia Apagada */}
      <div className="z-10 pt-2 flex justify-center">
        <div className="flex items-center gap-2.5 bg-red-950/90 border border-red-500/70 text-red-200 px-4 py-2.5 rounded-full shadow-[0_0_30px_rgba(239,68,68,0.4)] backdrop-blur-md animate-pulse">
          <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400 animate-bounce" />
          <div className="flex flex-col">
            <span
              style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
              className="text-xs uppercase tracking-widest text-red-200"
            >
              ⚡ ENERGIA APAGADA!
            </span>
            <span className="text-[10px] text-red-300/80 font-mono">
              Luzes físicas cortadas no ambiente
            </span>
          </div>
          <AlertTriangle className="w-4 h-4 text-red-400 ml-1" />
        </div>
      </div>

      {/* Área Central: Botão Funcional de Lanterna do Celular */}
      <div className="z-10 my-auto flex flex-col items-center justify-center gap-4 text-center px-4">
        <button
          type="button"
          onClick={toggleTorch}
          className={`w-36 h-36 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer shadow-2xl active:scale-95 ${
            isTorchOn
              ? 'bg-gradient-to-b from-cyan-400 to-cyan-600 border-white text-slate-950 shadow-[0_0_60px_rgba(6,182,212,0.8)] animate-pulse'
              : 'bg-slate-900/90 border-slate-700 text-cyan-400 hover:border-cyan-500 hover:bg-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.8)]'
          }`}
        >
          {isTorchOn ? (
            <>
              <Lightbulb className="w-12 h-12 text-slate-950 fill-slate-950 drop-shadow-md animate-bounce" />
              <span
                style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
                className="text-xs uppercase tracking-wider mt-1 font-black"
              >
                LANTERNA ON
              </span>
            </>
          ) : (
            <>
              <Flashlight className="w-12 h-12 drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]" />
              <span
                style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
                className="text-xs uppercase tracking-wider mt-1 text-slate-200"
              >
                LIGAR LANTERNA
              </span>
            </>
          )}
        </button>

        <p className="text-xs text-slate-400 max-w-xs font-mono">
          {isTorchOn
            ? '🔦 Lanterna ativada! Use o foco de luz para se deslocar até o disjuntor.'
            : 'Toque no botão acima para acender o flash do seu celular no escuro.'}
        </p>

        {torchError && (
          <span className="text-[10px] text-amber-400 font-mono bg-amber-950/80 px-3 py-1 rounded-full border border-amber-800/60">
            {torchError}
          </span>
        )}
      </div>

      {/* Rodapé: Localizador e Botão de Leitura de QR Code */}
      <div className="z-10 pb-4 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-900/95 border border-slate-700 text-slate-300 px-4 py-2 rounded-full text-xs font-medium backdrop-blur-md shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
          <span>
            Localize no ambiente:{' '}
            <strong className="text-cyan-300 font-bold">{generatorLocationName}</strong>
          </span>
        </div>

        {onOpenGenerator && (
          <button
            type="button"
            onClick={onOpenGenerator}
            className="w-full max-w-sm h-[54px] rounded-2xl btn-3d-amber flex items-center justify-center gap-2.5 text-sm font-black uppercase tracking-wider cursor-pointer active:scale-95 shadow-2xl"
          >
            <QrCode className="w-5 h-5 stroke-[2.5]" />
            <span>ESCANEAR DISJUNTOR / LUZES</span>
          </button>
        )}
      </div>
    </div>
  );
}
