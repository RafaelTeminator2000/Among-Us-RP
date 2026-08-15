'use client';

import React, { useState, useEffect } from 'react';
import { Zap, CheckCircle2, X, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

interface BreakerMinigameProps {
  onComplete: () => void;
  onClose: () => void;
}

interface BreakerState {
  id: number;
  label: string;
  isOn: boolean;
}

const INITIAL_BREAKERS: BreakerState[] = [
  { id: 1, label: 'Luzes - Setor Norte', isOn: false },
  { id: 2, label: 'Alimentação Central', isOn: true },
  { id: 3, label: 'Luzes - Reator/Motor', isOn: false },
  { id: 4, label: 'Disjuntor de Emergência', isOn: false },
  { id: 5, label: 'Subestação Auxiliar', isOn: false },
];

export function BreakerMinigame({ onComplete, onClose }: BreakerMinigameProps) {
  const [breakers, setBreakers] = useState<BreakerState[]>(() => {
    // Garantir que pelo menos 3 disjuntores comecem desligados
    return INITIAL_BREAKERS.map((b) => ({
      ...b,
      isOn: Math.random() > 0.6,
    }));
  });

  const [isCompleted, setIsCompleted] = useState(false);
  const onCompleteRef = React.useRef(onComplete);
  const hasTriggeredRef = React.useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Verificar se todos os disjuntores estão LIGADOS (ON)
  useEffect(() => {
    const allOn = breakers.every((b) => b.isOn);
    if (allOn && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      setIsCompleted(true);

      // Vibração festiva de sucesso
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([40, 60, 40, 60, 100]);
      }

      setTimeout(() => {
        onCompleteRef.current();
      }, 800);
    }
  }, [breakers]);

  const toggleBreaker = (id: number) => {
    if (isCompleted) return;

    // Feedback háptico tátil no celular
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(20);
    }

    setBreakers((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isOn: !b.isOn } : b))
    );
  };

  const activeCount = breakers.filter((b) => b.isOn).length;
  const totalCount = breakers.length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
      {/* Container Principal do Painel de Disjuntores */}
      <div className="w-full max-w-md bg-slate-900 border-2 border-slate-700/80 rounded-3xl p-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col gap-5">
        {/* Glow de fundo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full bg-slate-800/60 hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 shrink-0">
            <Zap className="w-6 h-6 fill-yellow-400/20" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-wide text-white flex items-center gap-2">
              DISJUNTORES DE ENERGIA
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Reative todas as 5 chaves para religar a iluminação
            </p>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Circuito Elétrico Principal</span>
            <span className={activeCount === totalCount ? 'text-emerald-400 font-bold' : 'text-yellow-400 font-bold'}>
              {activeCount} / {totalCount} ON
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                activeCount === totalCount
                  ? 'bg-gradient-to-r from-emerald-500 to-green-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                  : 'bg-gradient-to-r from-amber-500 to-yellow-400'
              }`}
              style={{ width: `${(activeCount / totalCount) * 100}%` }}
            />
          </div>
        </div>

        {/* Feedback de Sucesso */}
        {isCompleted && (
          <div className="bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 px-4 py-3 rounded-2xl flex items-center justify-center gap-2.5 animate-pulse shadow-[0_0_30px_rgba(16,185,129,0.3)]">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <span className="font-bold text-sm">ENERGIA RESTABELECIDA COM SUCESSO!</span>
          </div>
        )}

        {/* Lista de Disjuntores (Switches) */}
        <div className="flex flex-col gap-3 my-1">
          {breakers.map((breaker) => (
            <div
              key={breaker.id}
              onClick={() => toggleBreaker(breaker.id)}
              className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.99] ${
                breaker.isOn
                  ? 'bg-slate-800/80 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* LED Status e Label */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                    breaker.isOn
                      ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                      : 'bg-red-500/40 border border-red-500'
                  }`}
                />
                <div className="flex flex-col">
                  <span className="text-xs font-mono font-bold text-slate-200">
                    {breaker.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    CIRCUITO_0{breaker.id}
                  </span>
                </div>
              </div>

              {/* Botão / Lever do Disjuntor */}
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    breaker.isOn
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}
                >
                  {breaker.isOn ? 'ON' : 'OFF'}
                </span>

                {/* Lever Switch visual */}
                <div
                  className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 relative ${
                    breaker.isOn ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                      breaker.isOn ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Rodapé informativo */}
        <div className="text-center text-[11px] text-slate-500 font-mono">
          {isCompleted ? 'Enviando sinal para a rede...' : 'Toque nos disjuntores em OFF para ligá-los'}
        </div>
      </div>
    </div>
  );
}
