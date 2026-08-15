'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Zap, AlertTriangle, QrCode, Flashlight } from 'lucide-react';

interface DarknessOverlayProps {
  onOpenGenerator?: () => void;
  generatorLocationName?: string;
}

export function DarknessOverlay({
  onOpenGenerator,
  generatorLocationName = 'Gerador Principal (POINT_01)',
}: DarknessOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Inicializar no centro da viewport
    const setLightPosition = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      container.style.setProperty('--light-x', `${x}px`);
      container.style.setProperty('--light-y', `${y}px`);
    };

    // Centralizar inicialmente
    setLightPosition(window.innerWidth / 2, window.innerHeight / 2);

    const handlePointerMove = (e: PointerEvent) => {
      setLightPosition(e.clientX, e.clientY);
      if (!hasInteracted) setHasInteracted(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        setLightPosition(touch.clientX, touch.clientY);
        if (!hasInteracted) setHasInteracted(true);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [hasInteracted]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 select-none overflow-hidden touch-none"
      style={
        {
          '--light-x': '50vw',
          '--light-y': '50vh',
          background:
            'radial-gradient(circle 95px at var(--light-x, 50%) var(--light-y, 50%), transparent 0%, rgba(2, 6, 23, 0.985) 85%, rgba(2, 6, 23, 0.995) 100%), rgba(2, 6, 23, 0.98)',
        } as React.CSSProperties
      }
    >
      {/* Halo de brilho da lanterna em volta da posição do toque */}
      <div
        className="pointer-events-none absolute w-[190px] h-[190px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-500/20 bg-cyan-400/5 shadow-[0_0_50px_rgba(6,182,212,0.15)] transition-transform duration-75"
        style={{
          left: 'var(--light-x, 50%)',
          top: 'var(--light-y, 50%)',
        }}
      />

      {/* Dica visual de lanterna (some após primeiro movimento) */}
      {!hasInteracted && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 text-cyan-400 animate-bounce"
          style={{
            left: 'var(--light-x, 50%)',
            top: 'var(--light-y, 50%)',
          }}
        >
          <Flashlight className="w-8 h-8 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
          <span className="text-[11px] font-mono tracking-wider bg-slate-900/90 text-cyan-300 px-2.5 py-1 rounded-full border border-cyan-500/40">
            Arraste para iluminar
          </span>
        </div>
      )}

      {/* Alerta de topo animado */}
      <div className="absolute top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <div className="flex items-center gap-2.5 bg-red-950/90 border border-red-500/60 text-red-300 px-4 py-2.5 rounded-full shadow-[0_0_30px_rgba(239,68,68,0.4)] backdrop-blur-md animate-pulse">
          <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400 animate-bounce" />
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-widest uppercase text-red-200">
              ⚡ ENERGIA APAGADA!
            </span>
            <span className="text-[10px] text-red-300/80 font-mono">
              Visão de Crewmate limitada
            </span>
          </div>
          <AlertTriangle className="w-4 h-4 text-red-400 ml-1" />
        </div>
      </div>

      {/* Rodapé fixo com instruções e botão de resolução do gerador */}
      <div className="absolute bottom-6 left-0 right-0 z-50 px-4 flex flex-col items-center gap-3 pointer-events-auto">
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 text-slate-300 px-3.5 py-1.5 rounded-full text-xs font-medium backdrop-blur-md shadow-lg">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span>Localize: <strong className="text-cyan-300 font-semibold">{generatorLocationName}</strong></span>
        </div>

        {onOpenGenerator && (
          <button
            onClick={onOpenGenerator}
            className="w-full max-w-xs flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 active:scale-95 text-slate-950 font-bold text-sm py-3.5 px-6 rounded-2xl shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all"
          >
            <QrCode className="w-5 h-5 stroke-[2.5]" />
            <span>Escanear Disjuntor / Gerador</span>
          </button>
        )}
      </div>
    </div>
  );
}
