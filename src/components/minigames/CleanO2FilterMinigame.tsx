'use client';

import React, { useState, useRef, useCallback } from 'react';
import { X, CheckCircle2, Wind } from 'lucide-react';

interface CleanO2FilterMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface Leaf {
  id: number;
  x: number; // Porcentagem (0-100)
  y: number; // Porcentagem (0-100)
  rotation: number;
  size: number;
}

const INITIAL_LEAVES: Leaf[] = [
  { id: 1, x: 50, y: 30, rotation: 15, size: 34 },
  { id: 2, x: 75, y: 40, rotation: -25, size: 38 },
  { id: 3, x: 60, y: 60, rotation: 40, size: 36 },
  { id: 4, x: 40, y: 70, rotation: -10, size: 32 },
  { id: 5, x: 80, y: 75, rotation: 55, size: 36 },
  { id: 6, x: 65, y: 25, rotation: -45, size: 34 },
];

export const CleanO2FilterMinigame: React.FC<CleanO2FilterMinigameProps> = ({
  onComplete,
  onCancel,
}) => {
  const [leaves, setLeaves] = useState<Leaf[]>(INITIAL_LEAVES);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);

  // Síntese de áudio de sucção de vento
  const playSwoosh = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {}
  }, []);

  const startDrag = (leaf: Leaf, clientX: number, clientY: number) => {
    if (isCompleted) return;
    setActiveDragId(leaf.id);
    dragStartRef.current = {
      clientX,
      clientY,
      startX: leaf.x,
      startY: leaf.y,
    };
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (activeDragId === null || !dragStartRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const deltaXPercent = ((clientX - dragStartRef.current.clientX) / rect.width) * 100;
    const deltaYPercent = ((clientY - dragStartRef.current.clientY) / rect.height) * 100;

    const newX = Math.max(5, Math.min(90, dragStartRef.current.startX + deltaXPercent));
    const newY = Math.max(10, Math.min(90, dragStartRef.current.startY + deltaYPercent));

    // Se arrastou para a fenda de sucção à esquerda (X < 20%)
    if (newX <= 20) {
      playSwoosh();
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate(25);
      }

      setLeaves((prev) => {
        const remaining = prev.filter((l) => l.id !== activeDragId);
        if (remaining.length === 0 && !isCompleted) {
          setIsCompleted(true);
          if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
            navigator.vibrate([40, 80, 40, 80, 150]);
          }
          setTimeout(() => onComplete(), 750);
        }
        return remaining;
      });

      setActiveDragId(null);
      dragStartRef.current = null;
      return;
    }

    setLeaves((prev) =>
      prev.map((l) => (l.id === activeDragId ? { ...l, x: newX, y: newY } : l))
    );
  };

  const endDrag = () => {
    setActiveDragId(null);
    dragStartRef.current = null;
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console do Filtro de O2 */}
      <div className="w-full max-w-sm bg-slate-800 border-4 border-slate-600 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden flex flex-col items-center gap-3">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 left-3 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-900 border border-slate-700 transition-colors z-20 cursor-pointer shadow active:scale-95"
          title="Fechar Minigame"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Título do Terminal */}
        <div className="text-center pt-1 pb-1 pl-10 pr-2 w-full">
          <h2
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
            className="text-xl uppercase tracking-wider text-slate-100 flex items-center justify-center gap-2"
          >
            <Wind className="w-5 h-5 text-cyan-400" />
            <span>LIMPAR FILTRO DE O2</span>
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-400">
            Arraste todas as folhas para o duto de sucção à esquerda
          </p>
        </div>

        {/* Câmara Circular de Ventilação */}
        <div
          ref={containerRef}
          onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
          onMouseUp={endDrag}
          onTouchMove={(e) => moveDrag(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={endDrag}
          className="relative w-full h-80 bg-slate-950 rounded-2xl border-2 border-slate-700 overflow-hidden shadow-inner touch-none"
        >
          {/* Hélice de Ventilação ao Fundo */}
          <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
            <div className="w-52 h-52 rounded-full border-4 border-slate-700 animate-spin [animation-duration:6s] flex items-center justify-center">
              <div className="w-full h-2 bg-slate-700 rotate-45" />
              <div className="w-full h-2 bg-slate-700 -rotate-45" />
            </div>
          </div>

          {/* Duto de Sucção de Ar à Esquerda */}
          <div className="absolute top-0 bottom-0 left-0 w-20 bg-gradient-to-r from-cyan-950/80 via-slate-900/60 to-transparent border-r-2 border-dashed border-cyan-500/40 flex flex-col items-center justify-center gap-1 pointer-events-none">
            <span className="text-[9px] font-mono font-black text-cyan-400 [writing-mode:vertical-lr] rotate-180 uppercase tracking-widest animate-pulse">
              ◀◀ SUCÇÃO DE AR
            </span>
          </div>

          {/* Folhas Secas Flutuantes */}
          {leaves.map((leaf) => (
            <div
              key={leaf.id}
              onMouseDown={(e) => startDrag(leaf, e.clientX, e.clientY)}
              onTouchStart={(e) => startDrag(leaf, e.touches[0].clientX, e.touches[0].clientY)}
              style={{
                left: `${leaf.x}%`,
                top: `${leaf.y}%`,
                fontSize: `${leaf.size}px`,
                transform: `translate(-50%, -50%) rotate(${leaf.rotation}deg)`,
              }}
              className="absolute cursor-grab active:cursor-grabbing hover:scale-110 active:scale-95 transition-transform select-none z-10 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
            >
              🍂
            </div>
          ))}
        </div>

        {/* Feedback de Status */}
        {isCompleted ? (
          <div className="w-full py-2 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>FILTRO DE OXIGÊNIO LIMPO COM SUCESSO!</span>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-400">
            Folhas restantes no filtro: <span className="text-cyan-400 font-bold">{leaves.length}</span>
          </div>
        )}
      </div>
    </div>
  );
};
