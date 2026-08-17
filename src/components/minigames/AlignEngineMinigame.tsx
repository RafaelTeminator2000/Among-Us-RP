'use client';

import React, { useState, useRef, useCallback } from 'react';
import { X, CheckCircle2, Compass } from 'lucide-react';

interface AlignEngineMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const AlignEngineMinigame: React.FC<AlignEngineMinigameProps> = ({
  onComplete,
  onCancel,
}) => {
  // Posição vertical do controle deslizante (0 a 100, onde 50 é o centro exato / alinhado)
  const [sliderPos, setSliderPos] = useState<number>(() => {
    return Math.random() > 0.5 ? 18 : 82; // Começa bem desalinhado
  });
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const sliderTrackRef = useRef<HTMLDivElement | null>(null);

  // Síntese de áudio para trava mecânica
  const playLockSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }, []);

  // Ângulo do ponteiro do motor baseado na posição (50 = 0 graus / horizontal)
  const currentAngle = (sliderPos - 50) * 0.8; // De -40° a +40°
  // Tolerância de alinhamento: entre 47 e 53 (±3%)
  const isAligned = sliderPos >= 47 && sliderPos <= 53;

  const updateSliderFromClientY = (clientY: number) => {
    if (isCompleted || !sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const percent = (relativeY / rect.height) * 100;
    const clamped = Math.max(0, Math.min(100, percent));
    setSliderPos(clamped);

    if (clamped >= 47 && clamped <= 53) {
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate(15);
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isCompleted) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateSliderFromClientY(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateSliderFromClientY(e.clientY);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    if (isAligned && !isCompleted) {
      setIsCompleted(true);
      playLockSound();
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([40, 80, 40, 80, 150]);
      }
      setTimeout(() => onComplete(), 750);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console do Motor */}
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
            <Compass className="w-5 h-5 text-amber-400" />
            <span>ALINHAMENTO DO MOTOR</span>
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-400">
            Ajuste a alavanca para alinhar a flecha com a linha central
          </p>
        </div>

        {/* Display Central: Mostrador do Motor + Alavanca Deslizante */}
        <div className="w-full flex items-center gap-4 bg-[#020617] p-4 rounded-2xl border-2 border-slate-700 shadow-inner">
          {/* Mostrador Osciloscópio Circular */}
          <div className="relative flex-1 aspect-square bg-slate-950 rounded-full border-4 border-slate-700 shadow-inner flex items-center justify-center overflow-hidden">
            {/* Grade Circular de Radar */}
            <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
            <div className="w-36 h-36 rounded-full border border-slate-800" />
            <div className="w-20 h-20 rounded-full border border-slate-800" />

            {/* Linha Guia Horizontal Central (0° / Alvo) */}
            <div
              className={`absolute inset-x-2 h-1 border-t-2 border-dashed transition-all duration-200 ${
                isAligned
                  ? 'border-emerald-400 shadow-[0_0_12px_#10b981]'
                  : 'border-cyan-500/50'
              }`}
            />

            {/* Flecha / Agulha Indicadora do Motor */}
            <div
              style={{
                transform: `rotate(${currentAngle}deg)`,
              }}
              className="relative w-full flex items-center justify-center transition-transform duration-75"
            >
              {/* Ponta da Flecha */}
              <div
                className={`w-36 h-2 rounded-full transition-all ${
                  isAligned
                    ? 'bg-emerald-400 shadow-[0_0_15px_#10b981]'
                    : 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                }`}
              />
              <div
                className={`absolute right-2 w-0 h-0 border-y-8 border-y-transparent border-l-12 transition-all ${
                  isAligned
                    ? 'border-l-emerald-400 drop-shadow-[0_0_8px_#10b981]'
                    : 'border-l-amber-400'
                }`}
              />
            </div>

            {/* Núcleo Central */}
            <div className="absolute w-6 h-6 rounded-full bg-slate-800 border-2 border-slate-600 shadow" />
          </div>

          {/* Trilho Vertical da Alavanca */}
          <div
            ref={sliderTrackRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-14 h-56 bg-slate-900 rounded-2xl border-2 border-slate-700 p-1 relative flex justify-center cursor-ns-resize touch-none shadow-inner select-none"
          >
            {/* Linha Guia Central no Slider */}
            <div className="absolute top-1/2 -translate-y-1/2 inset-x-1 h-0.5 bg-cyan-400/40" />

            {/* Trilho da fenda */}
            <div className="w-2 h-full bg-slate-950 rounded-full border border-slate-800" />

            {/* Manopla da Alavanca */}
            <div
              style={{
                top: `${sliderPos}%`,
                transform: 'translateY(-50%)',
              }}
              className={`absolute w-12 h-10 rounded-xl border-2 shadow-2xl flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors duration-100 ${
                isAligned
                  ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_15px_#10b981]'
                  : 'bg-slate-200 hover:bg-white border-slate-400'
              }`}
            >
              <div className="w-6 h-1 bg-slate-600 rounded-full" />
            </div>
          </div>
        </div>

        {/* Feedback de Status */}
        {isCompleted ? (
          <div className="w-full py-2 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>MOTOR ALINHADO E TRAVADO COM SUCESSO!</span>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-400">
            {isAligned ? 'Solte a alavanca para travar o motor!' : 'Deslize até coincidir com a linha central'}
          </div>
        )}
      </div>
    </div>
  );
};
