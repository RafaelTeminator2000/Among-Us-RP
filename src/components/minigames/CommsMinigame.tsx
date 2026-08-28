'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Radio, X, Check, Activity, Signal, Zap } from 'lucide-react';

interface CommsMinigameProps {
  onComplete: () => void;
  onClose: () => void;
}

export const CommsMinigame: React.FC<CommsMinigameProps> = ({
  onComplete,
  onClose,
}) => {
  // Frequência alvo aleatória entre 20 e 80
  const [targetFreq] = useState<number>(() => Math.floor(Math.random() * 60) + 20);
  const [playerFreq, setPlayerFreq] = useState<number>(50);
  const [lockProgress, setLockProgress] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const isAligned = Math.abs(playerFreq - targetFreq) <= 4;

  useEffect(() => {
    let interval: any;
    if (isAligned && !isCompleted) {
      interval = setInterval(() => {
        setLockProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsCompleted(true);
            if (typeof window !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([100, 50, 150]);
            }
            setTimeout(() => {
              onComplete();
            }, 800);
            return 100;
          }
          return prev + 12;
        });
      }, 100);
    } else if (!isAligned && !isCompleted) {
      setLockProgress((prev) => Math.max(0, prev - 15));
    }

    return () => clearInterval(interval);
  }, [isAligned, isCompleted, onComplete]);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-4 flex items-center justify-center select-none animate-in fade-in">
      <div className="w-full max-w-sm bg-[#0a0f1d] border-2 border-purple-600/70 rounded-3xl p-5 space-y-4 shadow-[0_0_40px_rgba(147,51,234,0.3)]">
        {/* Cabeçalho */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-purple-400">
            <Radio className="w-5 h-5 animate-pulse" />
            <div>
              <h3
                style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
                className="text-lg uppercase tracking-wider text-white"
              >
                SINTONIZAR COMUNICAÇÕES
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Alinhe a frequência para restabelecer o sinal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Display do Osciloscópio / Ondas */}
        <div className="relative h-36 bg-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between overflow-hidden shadow-inner font-mono">
          {/* Grade de fundo */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:16px_16px] opacity-30 pointer-events-none" />

          <div className="flex items-center justify-between z-10 text-[10px]">
            <span className="text-slate-500">SINAL DE RÁDIO: CH-04</span>
            <span
              className={`font-bold flex items-center gap-1 ${
                isAligned ? 'text-emerald-400' : 'text-purple-400'
              }`}
            >
              <Signal className="w-3 h-3" />
              {isAligned ? 'SINAL SINCRONIZANDO' : 'BUSCANDO FREQUÊNCIA'}
            </span>
          </div>

          {/* Ondas SVG dinâmicas */}
          <div className="relative h-16 w-full flex items-center justify-center">
            {/* Onda Alvo (Roxo) */}
            <svg className="absolute inset-0 w-full h-full stroke-purple-500/50 fill-none" viewBox="0 0 300 60">
              <path
                d={`M 0,30 Q 75,${10 + (targetFreq % 20)} 150,30 T 300,30`}
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />
            </svg>

            {/* Onda do Jogador (Ciano ou Verde se alinhado) */}
            <svg
              className={`absolute inset-0 w-full h-full fill-none transition-colors duration-200 ${
                isAligned ? 'stroke-emerald-400' : 'stroke-cyan-400'
              }`}
              viewBox="0 0 300 60"
            >
              <path
                d={`M 0,30 Q 75,${10 + (playerFreq % 20) + (isAligned ? 0 : 8)} 150,30 T 300,30`}
                strokeWidth="3"
              />
            </svg>
          </div>

          {/* Barra de Progresso de Bloqueio */}
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800 z-10">
            <div
              className={`h-full transition-all duration-150 ${
                isCompleted
                  ? 'bg-emerald-400'
                  : isAligned
                  ? 'bg-gradient-to-r from-purple-500 to-emerald-400'
                  : 'bg-slate-700'
              }`}
              style={{ width: `${lockProgress}%` }}
            />
          </div>
        </div>

        {/* Dial / Controle Deslizante de Frequência */}
        <div className="space-y-2 pt-1 font-mono">
          <div className="flex justify-between text-xs font-bold text-slate-300">
            <span>Frequência: {playerFreq.toFixed(1)} MHz</span>
            <span className={isAligned ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
              {isAligned ? 'EM SINTONIA' : 'DESALINHADO'}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="0.5"
            disabled={isCompleted}
            value={playerFreq}
            onChange={(e) => setPlayerFreq(parseFloat(e.target.value))}
            className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />

          <div className="flex justify-between text-[10px] text-slate-500">
            <span>0.0 MHz</span>
            <span>50.0 MHz</span>
            <span>100.0 MHz</span>
          </div>
        </div>

        {/* Status de Conclusão */}
        {isCompleted ? (
          <div className="py-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/80 text-emerald-300 text-center text-xs font-bold font-mono flex items-center justify-center gap-2 animate-bounce shadow-lg">
            <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
            <span>COMUNICAÇÕES REESTABELECIDAS!</span>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 text-center font-mono">
            Gire a frequência até a onda ciano se sobrepor à onda pontilhada roxa.
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono font-bold uppercase transition cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};
