'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle2, Trash2 } from 'lucide-react';

interface EmptyGarbageMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface TrashItem {
  id: number;
  label: string;
  emoji: string;
  x: number;
  y: number;
  rotation: number;
  size: number;
}

const INITIAL_TRASH: TrashItem[] = [
  { id: 1, label: 'Folha', emoji: '🍂', x: 25, y: 30, rotation: 12, size: 28 },
  { id: 2, label: 'Lata', emoji: '🥫', x: 60, y: 35, rotation: -20, size: 26 },
  { id: 3, label: 'Osso', emoji: '🦴', x: 40, y: 55, rotation: 45, size: 30 },
  { id: 4, label: 'Embalagem', emoji: '🍔', x: 70, y: 65, rotation: -15, size: 28 },
  { id: 5, label: 'Diamante', emoji: '💎', x: 20, y: 70, rotation: 30, size: 26 },
  { id: 6, label: 'Garrafa', emoji: '🍾', x: 50, y: 75, rotation: -35, size: 30 },
];

export const EmptyGarbageMinigame: React.FC<EmptyGarbageMinigameProps> = ({
  onComplete,
  onCancel,
}) => {
  // Posição da alavanca de 0 (topo / repouso) a 100 (base / ejetando)
  const [leverProgress, setLeverProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [trashItems, setTrashItems] = useState<TrashItem[]>(INITIAL_TRASH);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const leverTrackRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isSuctionActive = leverProgress >= 70;

  // Síntese de áudio de sucção de lixo
  const playSuctionSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }, []);

  // Loop de sucção do lixo quando a alavanca está puxada para a base (>= 70%)
  useEffect(() => {
    if (!isSuctionActive || isCompleted) return;

    playSuctionSound();

    const loop = () => {
      setTrashItems((prev) => {
        const updated = prev
          .map((item) => ({
            ...item,
            y: item.y + 2.2, // Sucção acelerada para o bocal
            x: item.x + (50 - item.x) * 0.06, // Afunilamento
            rotation: item.rotation + 5,
          }))
          .filter((item) => item.y < 125);

        if (updated.length === 0 && !isCompleted) {
          setIsCompleted(true);
          if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
            navigator.vibrate([40, 80, 40, 80, 150]);
          }
          setTimeout(() => onComplete(), 750);
        }

        return updated;
      });

      if (!isCompleted) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isSuctionActive, isCompleted, onComplete, playSuctionSound]);

  // Atualizar posição do arraste da alavanca
  const updateLeverFromClientY = (clientY: number) => {
    if (isCompleted || !leverTrackRef.current) return;
    const rect = leverTrackRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const progress = (relativeY / rect.height) * 100;
    const clamped = Math.max(0, Math.min(100, progress));
    setLeverProgress(clamped);

    if (clamped >= 70 && typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isCompleted) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateLeverFromClientY(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateLeverFromClientY(e.clientY);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    if (!isCompleted) {
      // Retorna elasticamente para o topo ao soltar
      setLeverProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console do Ejetor de Lixo */}
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
            <Trash2 className="w-5 h-5 text-amber-400" />
            <span>ESVAZIAR LIXO</span>
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-400">
            Arraste a alavanca para baixo e segure para ejetar
          </p>
        </div>

        {/* Compartimento Central: Tubo de Vidro + Trilho da Alavanca */}
        <div className="w-full flex items-center gap-3 bg-[#020617] p-3.5 rounded-2xl border-2 border-slate-700 shadow-inner">
          {/* Tubo de Lixo com Vidro e Itens Flutuantes */}
          <div className="flex-1 h-72 bg-slate-950 rounded-xl border-2 border-slate-800 relative overflow-hidden flex flex-col justify-between p-2 shadow-inner">
            {/* Vidro com Reflexo */}
            <div className="absolute inset-0 bg-cyan-500/5 pointer-events-none" />
            <div className="absolute top-0 inset-x-0 h-1/3 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

            {/* Itens de Lixo Flutuando */}
            {trashItems.map((item) => (
              <div
                key={item.id}
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  fontSize: `${item.size}px`,
                  transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                }}
                className="absolute transition-transform select-none pointer-events-none"
              >
                {item.emoji}
              </div>
            ))}

            {/* Bocal de Ejeção Inferior */}
            <div className="absolute bottom-0 inset-x-0 h-6 bg-slate-900 border-t-2 border-slate-700 flex items-center justify-center">
              <span
                className={`text-[9px] font-mono font-bold transition-colors ${
                  isSuctionActive ? 'text-emerald-400 animate-pulse' : 'text-slate-600'
                }`}
              >
                {isSuctionActive ? 'BOCAL ABERTO (SUCÇÃO ATIVA)' : 'BOCAL FECHADO'}
              </span>
            </div>
          </div>

          {/* Trilho da Alavanca Mecânica Arrastável */}
          <div
            ref={leverTrackRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-16 h-72 bg-slate-900 rounded-xl border-2 border-slate-700 p-2 flex flex-col items-center justify-between relative shadow-inner cursor-ns-resize touch-none select-none"
          >
            <span className="text-[8px] font-mono font-bold text-slate-500 uppercase pointer-events-none">
              ABRIR
            </span>

            {/* Fenda da Alavanca */}
            <div className="w-3 h-52 bg-slate-950 rounded-full border border-slate-800 relative flex justify-center">
              {/* Manopla da Alavanca (Arrastável) */}
              <div
                style={{
                  top: `${leverProgress}%`,
                  transform: 'translateY(-50%)',
                  transition: isDragging ? 'none' : 'top 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                className={`absolute w-12 h-12 rounded-2xl border-2 cursor-grab active:cursor-grabbing shadow-2xl flex items-center justify-center select-none touch-none ${
                  isSuctionActive
                    ? 'bg-red-600 border-red-300 shadow-[0_0_25px_#ef4444] scale-105'
                    : 'bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 border-red-400 shadow-md'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white/40 shadow-inner" />
              </div>
            </div>

            <span className="text-[8px] font-mono font-bold text-slate-500 uppercase pointer-events-none">
              EJETAR
            </span>
          </div>
        </div>

        {/* Feedback de Status */}
        {isCompleted ? (
          <div className="w-full py-2 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>LIXO EJETADO COM SUCESSO!</span>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-400">
            {isSuctionActive ? 'Esvaziando compartimento...' : 'Arraste a manopla vermelha para baixo'}
          </div>
        )}
      </div>
    </div>
  );
};
