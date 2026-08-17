'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, X } from 'lucide-react';

interface BreakerMinigameProps {
  onComplete: () => void;
  onClose: () => void;
}

interface SwitchState {
  id: number;
  isOn: boolean;
}

export function BreakerMinigame({ onComplete, onClose }: BreakerMinigameProps) {
  // 5 interruptores mecânicos (alguns começam desligados)
  const [switches, setSwitches] = useState<SwitchState[]>(() => [
    { id: 1, isOn: false },
    { id: 2, isOn: true },
    { id: 3, isOn: false },
    { id: 4, isOn: false },
    { id: 5, isOn: false },
  ]);

  const [isCompleted, setIsCompleted] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Verificar se todas as 5 chaves estão LIGADAS (ON)
  useEffect(() => {
    const allOn = switches.every((s) => s.isOn);
    if (allOn && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      setIsCompleted(true);

      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([50, 80, 50, 80, 150]);
      }

      setTimeout(() => {
        onCompleteRef.current();
      }, 900);
    }
  }, [switches]);

  const toggleSwitch = (id: number) => {
    if (isCompleted) return;

    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(25);
    }

    setSwitches((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isOn: !s.isOn } : s))
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
      {/* Moldura do Painel Elétrico de Luzes */}
      <div className="w-full max-w-sm bg-slate-400 border-4 border-slate-600 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col items-center">
        {/* Cabos elétricos entrando pelo topo */}
        <div className="absolute -top-3 left-8 flex gap-3 pointer-events-none">
          <div className="w-4 h-6 bg-red-600 rounded-b-lg shadow-md" />
          <div className="w-4 h-8 bg-yellow-500 rounded-b-lg shadow-md" />
          <div className="w-4 h-5 bg-amber-800 rounded-b-lg shadow-md" />
          <div className="w-4 h-7 bg-slate-900 rounded-b-lg shadow-md" />
        </div>

        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-800 hover:text-black p-1.5 rounded-full bg-slate-300 border border-slate-500 transition-colors z-20 cursor-pointer shadow"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Título do Painel */}
        <div className="text-center pt-2 pb-3">
          <h2
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
            className="text-xl uppercase tracking-wider text-slate-900 drop-shadow-sm"
          >
            REPARAR LUZES
          </h2>
          <p className="text-[11px] font-mono font-bold text-slate-700">
            Ligue todas as 5 chaves para restabelecer a energia
          </p>
        </div>

        {/* Telas Osciloscópio de Sinal Elétrico */}
        <div className="w-full space-y-2 mb-5">
          <div className="w-full h-14 bg-slate-950 rounded-xl border-2 border-slate-700 p-1 flex items-center justify-center overflow-hidden shadow-inner relative">
            <svg className="w-full h-full text-emerald-400 opacity-90 stroke-current fill-none stroke-2" viewBox="0 0 300 40">
              <path d="M 0 20 Q 20 5, 40 20 T 80 20 T 120 20 T 160 5 T 200 35 T 240 20 T 280 10 T 300 20" />
            </svg>
            <span className="absolute bottom-1 right-2 text-[9px] font-mono text-emerald-500/60 font-bold">
              FREQ 60Hz
            </span>
          </div>

          <div className="w-full h-10 bg-slate-950 rounded-xl border-2 border-slate-700 p-1 flex items-center justify-center overflow-hidden shadow-inner relative">
            <svg className="w-full h-full text-emerald-400 opacity-80 stroke-current fill-none stroke-1.5" viewBox="0 0 300 30">
              <path d="M 0 15 Q 30 12, 60 15 T 120 18 T 180 12 T 240 16 T 300 15" />
            </svg>
          </div>
        </div>

        {/* 5 Interruptores de Alavanca com Lâmpadas Verdes */}
        <div className="w-full bg-slate-300 p-4 rounded-2xl border-2 border-slate-500 shadow-inner flex justify-between items-center px-3 mb-4">
          {switches.map((s) => (
            <div
              key={s.id}
              onClick={() => toggleSwitch(s.id)}
              className="flex flex-col items-center gap-2 cursor-pointer transition-all active:scale-95 select-none"
            >
              {/* Alavanca Mecânica 3D */}
              <div className="w-10 h-16 bg-slate-800 rounded-xl border-2 border-slate-900 p-1 flex flex-col justify-between items-center shadow-lg relative">
                <div
                  className={`w-6 h-7 bg-gradient-to-b from-slate-200 to-slate-400 rounded-md border border-slate-700 shadow transition-all duration-200 ${
                    s.isOn ? '-translate-y-0.5' : 'translate-y-7'
                  }`}
                />
              </div>

              {/* Lâmpada Indicadora LED */}
              <div
                className={`w-4 h-4 rounded-full border-2 border-slate-800 transition-all duration-300 ${
                  s.isOn
                    ? 'bg-emerald-400 shadow-[0_0_12px_#10b981]'
                    : 'bg-slate-700 shadow-none'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Status de Conclusão */}
        {isCompleted ? (
          <div className="w-full py-2.5 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>LUZES RESTABELECIDAS!</span>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-800 font-bold">
            {switches.filter((s) => s.isOn).length}/5 Chaves Ligadas
          </div>
        )}
      </div>
    </div>
  );
}
