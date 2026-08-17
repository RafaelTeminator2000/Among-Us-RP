'use client';

import React, { useState } from 'react';
import { Gauge, X, CheckCircle2, Zap } from 'lucide-react';

interface CalibrateDistributorMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const CalibrateDistributorMinigame: React.FC<CalibrateDistributorMinigameProps> = ({
  onComplete,
  onCancel,
}) => {
  const [sliders, setSliders] = useState<number[]>([20, 10, 30]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const handleSliderChange = (index: number, val: number) => {
    if (isCompleted) return;

    const updated = [...sliders];
    updated[index] = val;
    setSliders(updated);

    if (updated.every((v) => v >= 95)) {
      setIsCompleted(true);
      setTimeout(() => onComplete(), 600);
    }
  };

  const channelLabels = ['CANAL A (N)', 'CANAL B (C)', 'CANAL C (S)'];

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 p-6 flex flex-col justify-between max-w-md mx-auto font-sans select-none animate-fade-in">
      <header className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-sm font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
            <Gauge className="w-4 h-4 text-amber-400" />
            <span>Calibrar Distribuidor</span>
          </h2>
          <p className="text-[10px] text-slate-400">Ajuste os 3 canais de energia para 100%</p>
        </div>
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-bold flex items-center justify-center hover:bg-slate-800 transition active:scale-90"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <main className="my-auto bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-2xl space-y-6">
        {/* Banner de Status */}
        <div
          className={`py-2 px-4 rounded-2xl border text-center font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            isCompleted
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'bg-slate-950 text-slate-400 border-slate-800'
          }`}
        >
          {isCompleted ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>CIRCUITO CALIBRADO E ESTABILIZADO ✓</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>SINCRONIZAÇÃO DE CARGA: {sliders.filter((v) => v >= 95).length} / 3 PRONTOS</span>
            </>
          )}
        </div>

        {/* Controles dos 3 Canais de Energia */}
        <div className="grid grid-cols-3 gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80">
          {sliders.map((value, idx) => {
            const isFull = value >= 95;

            return (
              <div key={idx} className="flex flex-col items-center space-y-3">
                <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-tight">
                  {channelLabels[idx]}
                </span>

                <span
                  className={`font-mono text-xs font-black transition-colors ${
                    isFull ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'text-slate-400'
                  }`}
                >
                  {value}%
                </span>

                <div className="relative flex justify-center items-center py-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={value}
                    disabled={isCompleted}
                    onChange={(e) => handleSliderChange(idx, Number(e.target.value))}
                    className="h-44 w-3 accent-amber-400 bg-slate-900 rounded-lg appearance-none cursor-pointer [writing-mode:vertical-lr] [direction:rtl] border border-slate-800 shadow-inner"
                  />
                </div>

                <div
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 ${
                    isFull
                      ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_10px_#10b981] animate-pulse'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </main>

      <footer className="text-center pb-4">
        <p className="text-[11px] text-slate-500 italic">
          Arraste todos os 3 sliders para o topo para concluir a transferência de energia.
        </p>
      </footer>
    </div>
  );
};
