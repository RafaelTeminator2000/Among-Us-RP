'use client';

import React, { useState, useRef } from 'react';
import { CreditCard, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface SwipeCardMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const SwipeCardMinigame: React.FC<SwipeCardMinigameProps> = ({ onComplete, onCancel }) => {
  const [status, setStatus] = useState<'IDLE' | 'TOO_FAST' | 'TOO_SLOW' | 'ACCEPTED'>('IDLE');
  const [cardX, setCardX] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const startClientXRef = useRef(0);
  const startCardXRef = useRef(0);

  const startDrag = (clientX: number) => {
    if (status === 'ACCEPTED') return;
    isDraggingRef.current = true;
    startTimeRef.current = Date.now();
    startClientXRef.current = clientX;
    startCardXRef.current = cardX;
    setStatus('IDLE');
  };

  const moveDrag = (clientX: number, container: HTMLElement | null) => {
    if (!isDraggingRef.current || !container) return;

    const rect = container.getBoundingClientRect();
    const maxTravel = rect.width - 96; // 96px = w-24 do cartão
    const deltaX = clientX - startClientXRef.current;
    const newX = Math.max(0, Math.min(startCardXRef.current + deltaX, maxTravel));
    setCardX(newX);
  };

  const endDrag = (container: HTMLElement | null) => {
    if (!isDraggingRef.current || !startTimeRef.current) return;
    isDraggingRef.current = false;

    const duration = Date.now() - startTimeRef.current;
    const rect = container?.getBoundingClientRect();
    const maxTravel = rect ? rect.width - 110 : 150;

    // Se não arrastou até o final da fenda (pelo menos ~80% do percurso)
    if (cardX < maxTravel * 0.8) {
      setCardX(0);
      return;
    }

    if (duration < 300) {
      setStatus('TOO_FAST');
      setCardX(0);
    } else if (duration > 1200) {
      setStatus('TOO_SLOW');
      setCardX(0);
    } else {
      setStatus('ACCEPTED');
      setTimeout(() => onComplete(), 600);
    }
  };

  // Handlers para Touch (Mobile PWA)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    startDrag(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    moveDrag(e.touches[0].clientX, e.currentTarget.parentElement);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    endDrag(e.currentTarget.parentElement);
  };

  // Handlers para Mouse / Pointer (Desktop / Preview)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startDrag(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    moveDrag(e.clientX, e.currentTarget.parentElement);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignorar se já liberado
    }
    endDrag(e.currentTarget.parentElement);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 p-6 flex flex-col justify-between max-w-md mx-auto font-sans select-none animate-fade-in">
      <header className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-sm font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-cyan-400" />
            <span>Cartão de Acesso</span>
          </h2>
          <p className="text-[10px] text-slate-400">Passe o cartão na fenda do leitor</p>
        </div>
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-bold flex items-center justify-center hover:bg-slate-800 transition active:scale-90"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <main className="my-auto bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-2xl">
        {/* Visor digital */}
        <div
          className={`w-full py-3 text-center rounded-xl font-mono text-xs font-black tracking-wider transition-all flex items-center justify-center gap-2 ${
            status === 'ACCEPTED'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : status === 'TOO_FAST' || status === 'TOO_SLOW'
              ? 'bg-red-500/20 text-red-400 border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
              : 'bg-slate-950 text-slate-400 border border-slate-800'
          }`}
        >
          {status === 'IDLE' && 'POR FAVOR, PASSE O CARTÃO'}
          {status === 'TOO_FAST' && (
            <>
              <AlertCircle className="w-4 h-4 text-red-400 animate-bounce" />
              <span>MUITO RÁPIDO. TENTE NOVAMENTE.</span>
            </>
          )}
          {status === 'TOO_SLOW' && (
            <>
              <AlertCircle className="w-4 h-4 text-red-400 animate-bounce" />
              <span>MUITO LENTO. TENTE NOVAMENTE.</span>
            </>
          )}
          {status === 'ACCEPTED' && (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>ACESSO PERMITIDO ✓</span>
            </>
          )}
        </div>

        {/* Fenda do leitor */}
        <div className="relative w-full h-24 bg-slate-950 rounded-2xl border-2 border-slate-800 flex items-center px-2 overflow-hidden shadow-inner">
          <div className="absolute inset-x-0 h-3 bg-slate-800/80 top-1/2 -translate-y-1/2 shadow-inner" />

          {/* Cartão de identificação */}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ transform: `translateX(${cardX}px)` }}
            className={`w-24 h-16 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 rounded-xl shadow-2xl cursor-grab active:cursor-grabbing flex items-center justify-between px-3 text-slate-950 font-black text-xs z-10 touch-none transition-transform duration-75 border border-yellow-200/50 ${
              status === 'ACCEPTED' ? 'opacity-80' : ''
            }`}
          >
            <div className="flex flex-col">
              <span className="text-[11px] leading-tight font-black tracking-wider">CREW</span>
              <span className="text-[8px] font-mono opacity-80">ID-CARD</span>
            </div>
            <div className="w-4 h-10 bg-slate-900/40 rounded-sm border border-black/20" />
          </div>
        </div>
      </main>

      <footer className="text-center pb-4">
        <p className="text-[11px] text-slate-500 italic">
          Arraste o cartão da esquerda para a direita em velocidade moderada.
        </p>
      </footer>
    </div>
  );
};
