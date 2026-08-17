'use client';

import React, { useState, useEffect } from 'react';
import { KeyRound, X, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

interface ManifoldsMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const ManifoldsMinigame: React.FC<ManifoldsMinigameProps> = ({ onComplete, onCancel }) => {
  const [numbers, setNumbers] = useState<number[]>([]);
  const [nextExpected, setNextExpected] = useState<number>(1);
  const [errorFlash, setErrorFlash] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  useEffect(() => {
    // Embaralhar números de 1 a 10
    const shuffled = Array.from({ length: 10 }, (_, i) => i + 1).sort(() => 0.5 - Math.random());
    setNumbers(shuffled);
  }, []);

  const handleNumberClick = (num: number) => {
    if (isCompleted || errorFlash) return;

    if (num === nextExpected) {
      if (num === 10) {
        setNextExpected(11);
        setIsCompleted(true);
        setTimeout(() => onComplete(), 500);
      } else {
        setNextExpected((prev) => prev + 1);
      }
    } else {
      // Erro: pisca em vermelho e reseta para o 1
      setErrorFlash(true);
      setTimeout(() => {
        setErrorFlash(false);
        setNextExpected(1);
      }, 450);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 p-6 flex flex-col justify-between max-w-md mx-auto font-sans select-none animate-fade-in">
      <header className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-sm font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-cyan-400" />
            <span>Desbloquear Coletores</span>
          </h2>
          <p className="text-[10px] text-slate-400">Pressione os números em ordem crescente (1 ➔ 10)</p>
        </div>
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-bold flex items-center justify-center hover:bg-slate-800 transition active:scale-90"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <main className="my-auto space-y-6">
        {/* Status / Visor de Progresso */}
        <div
          className={`py-2 px-4 rounded-2xl border text-center font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            isCompleted
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : errorFlash
              ? 'bg-red-500/20 text-red-400 border-red-500 animate-shake'
              : 'bg-slate-900/90 text-slate-300 border-slate-800'
          }`}
        >
          {isCompleted ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>COLETORES DESBLOQUEADOS ✓</span>
            </>
          ) : errorFlash ? (
            <>
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>SEQUÊNCIA INCORRETA! REINICIANDO...</span>
            </>
          ) : (
            <span>
              STATUS DO REATOR: <span className="text-cyan-400 font-black">{nextExpected - 1} / 10 ATIVADOS</span>
            </span>
          )}
        </div>

        {/* Grade 5x2 de Botões Táteis */}
        <div
          className={`grid grid-cols-5 gap-3 bg-slate-900/90 p-5 rounded-3xl border-2 transition-all shadow-2xl ${
            errorFlash
              ? 'border-red-500/80 bg-red-950/20 shadow-[0_0_25px_rgba(239,68,68,0.2)]'
              : isCompleted
              ? 'border-emerald-500/80 bg-emerald-950/20 shadow-[0_0_25px_rgba(16,185,129,0.2)]'
              : 'border-slate-800'
          }`}
        >
          {numbers.map((num) => {
            const isPressed = num < nextExpected;

            return (
              <button
                key={num}
                disabled={isPressed || isCompleted || errorFlash}
                onClick={() => handleNumberClick(num)}
                className={`aspect-square rounded-2xl font-mono text-xl font-black flex items-center justify-center transition-all duration-150 ${
                  isPressed
                    ? 'bg-slate-950 text-slate-700 border border-slate-900/80 shadow-inner scale-95 opacity-50'
                    : 'bg-gradient-to-br from-cyan-400 to-cyan-600 hover:from-cyan-300 hover:to-cyan-500 text-slate-950 shadow-lg shadow-cyan-950/50 border border-cyan-300/40 active:scale-90 cursor-pointer'
                }`}
              >
                {isPressed ? '✓' : num}
              </button>
            );
          })}
        </div>
      </main>

      <footer className="text-center pb-4">
        <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 px-5 py-2 rounded-full text-xs font-mono text-slate-300 shadow-md">
          <span>Próximo número:</span>
          <strong className="text-cyan-400 text-sm font-black">
            {nextExpected <= 10 ? nextExpected : '✓'}
          </strong>
        </div>
      </footer>
    </div>
  );
};
