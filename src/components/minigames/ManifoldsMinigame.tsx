'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';

interface ManifoldsMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
}

// Frequências das 10 notas musicais ascendentes (Escala C4 a E5)
const NOTE_FREQUENCIES = [
  261.63, // 1: C4
  293.66, // 2: D4
  329.63, // 3: E4
  349.23, // 4: F4
  392.00, // 5: G4
  440.00, // 6: A4
  493.88, // 7: B4
  523.25, // 8: C5
  587.33, // 9: D5
  659.25, // 10: E5
];

export const ManifoldsMinigame: React.FC<ManifoldsMinigameProps> = ({ onComplete, onCancel }) => {
  const [numbers, setNumbers] = useState<number[]>([]);
  const [nextExpected, setNextExpected] = useState<number>(1);
  const [errorFlash, setErrorFlash] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Embaralhar números de 1 a 10 no carregamento
  useEffect(() => {
    const shuffled = Array.from({ length: 10 }, (_, i) => i + 1).sort(() => 0.5 - Math.random());
    setNumbers(shuffled);
  }, []);

  // Sintetizador WebAudio de notas musicais ascendentes
  const playTone = useCallback((freq: number, type: OscillatorType = 'triangle', duration = 0.15) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }, []);

  const handleNumberClick = (num: number) => {
    if (isCompleted || errorFlash) return;

    if (num === nextExpected) {
      // Nota musical correspondente ao número
      playTone(NOTE_FREQUENCIES[num - 1] || 440, 'triangle', 0.15);

      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate(25);
      }

      if (num === 10) {
        setNextExpected(11);
        setIsCompleted(true);
        setTimeout(() => playTone(880, 'sine', 0.3), 150);
        if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
          navigator.vibrate([40, 80, 40, 80, 150]);
        }
        setTimeout(() => onComplete(), 700);
      } else {
        setNextExpected((prev) => prev + 1);
      }
    } else {
      // Erro: tom grave de buzzer, vibração e piscar em vermelho
      playTone(150, 'sawtooth', 0.3);
      setErrorFlash(true);
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }

      setTimeout(() => {
        setErrorFlash(false);
        setNextExpected(1);
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console Metálico de Coletores */}
      <div className="w-full max-w-sm bg-slate-800 border-4 border-slate-600 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col items-center gap-4">
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
            <KeyRound className="w-5 h-5 text-cyan-400" />
            <span>DESBLOQUEAR COLETORES</span>
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-400">
            Pressione os botões na ordem crescente de 1 a 10
          </p>
        </div>

        {/* Display de Status do Reator */}
        <div
          className={`w-full py-2.5 px-4 rounded-2xl border text-center font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-inner ${
            isCompleted
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : errorFlash
              ? 'bg-red-500/20 text-red-400 border-red-500 animate-shake'
              : 'bg-[#020617] text-slate-300 border-slate-800'
          }`}
        >
          {isCompleted ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>COLETORES DESBLOQUEADOS COM SUCESSO!</span>
            </>
          ) : errorFlash ? (
            <>
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>SEQUÊNCIA INCORRETA! REINICIANDO DO 1...</span>
            </>
          ) : (
            <span>
              STATUS: <span className="text-cyan-400 font-black">{nextExpected - 1} / 10 ATIVADOS</span>
            </span>
          )}
        </div>

        {/* Grade 5x2 de Botões de Acrílico Azul 3D */}
        <div
          className={`grid grid-cols-5 gap-2.5 w-full bg-[#020617] p-3.5 rounded-2xl border-2 transition-all shadow-2xl ${
            errorFlash
              ? 'border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.3)] animate-shake'
              : isCompleted
              ? 'border-emerald-500/80 shadow-[0_0_30px_rgba(16,185,129,0.3)]'
              : 'border-slate-800'
          }`}
        >
          {numbers.map((num) => {
            const isPressed = num < nextExpected;

            return (
              <button
                key={num}
                type="button"
                disabled={isPressed || isCompleted || errorFlash}
                onClick={() => handleNumberClick(num)}
                className={`aspect-square rounded-xl font-mono text-xl font-black flex items-center justify-center transition-all select-none ${
                  isPressed
                    ? 'bg-emerald-500 text-slate-950 border-2 border-emerald-300 shadow-[0_0_12px_#10b981] scale-95 opacity-90'
                    : errorFlash
                    ? 'bg-red-600 text-white border-2 border-red-400 opacity-80'
                    : 'bg-gradient-to-b from-cyan-400 to-cyan-600 hover:from-cyan-300 hover:to-cyan-500 text-slate-950 border-2 border-cyan-300 border-b-4 border-b-cyan-800 shadow-lg active:translate-y-1 active:border-b-2 cursor-pointer'
                }`}
              >
                {isPressed ? '✓' : num}
              </button>
            );
          })}
        </div>

        {/* Rodapé informativo */}
        <div className="flex items-center justify-between w-full px-2 text-[11px] font-mono text-slate-400">
          <span>Próximo número:</span>
          <span className="text-sm font-black text-cyan-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
            {nextExpected <= 10 ? nextExpected : 'CONCLUÍDO'}
          </span>
        </div>
      </div>
    </div>
  );
};
