'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Check, CheckCircle2 } from 'lucide-react';

interface KeypadMinigameProps {
  onComplete: () => void;
  onClose: () => void;
  targetCode?: string;
}

export function KeypadMinigame({ onComplete, onClose, targetCode }: KeypadMinigameProps) {
  // Gerar código aleatório de 5 dígitos
  const [code] = useState<string>(() => {
    if (targetCode && targetCode.length === 5) return targetCode;
    return Math.floor(10000 + Math.random() * 90000).toString();
  });

  const [inputCode, setInputCode] = useState<string>('');
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleDigitPress = (digit: string) => {
    if (isCompleted || inputCode.length >= 5) return;

    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(20);
    }

    setHasError(false);
    setInputCode((prev) => prev + digit);
  };

  const handleClear = () => {
    if (isCompleted) return;
    setInputCode('');
    setHasError(false);
  };

  const handleSubmit = () => {
    if (isCompleted) return;

    if (inputCode === code) {
      setIsCompleted(true);
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([40, 80, 40, 80, 120]);
      }
      setTimeout(() => {
        onCompleteRef.current();
      }, 900);
    } else {
      setHasError(true);
      setInputCode('');
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
      {/* Console do Teclado */}
      <div className="w-full max-w-sm bg-slate-400 border-4 border-slate-600 rounded-3xl p-5 shadow-2xl relative overflow-visible flex flex-col items-center">
        {/* Botão Fechar (Posicionado no topo esquerdo para não cobrir o Post-it do código) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 left-3.5 text-slate-800 hover:text-black p-1.5 rounded-full bg-slate-300 border border-slate-500 transition-colors z-20 cursor-pointer shadow active:scale-95"
          title="Fechar Minigame"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Post-it Amarelo com o Código do Dia (Topo Direito totalmente desobstruído) */}
        <div className="absolute -top-4 -right-3 bg-amber-300 text-slate-900 px-4 py-2.5 rounded-lg shadow-2xl rotate-6 border border-amber-400 z-10 select-none">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-900">
            today's code:
          </div>
          <div
            style={{ fontFamily: 'var(--font-mono), Space Mono, monospace' }}
            className="text-xl font-black tracking-widest text-slate-950 mt-0.5"
          >
            {code}
          </div>
        </div>

        {/* Título do Terminal */}
        <div className="pt-1 pb-3 w-full pl-12 pr-28 text-left">
          <h2
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
            className="text-lg uppercase tracking-wider text-slate-900 drop-shadow-sm leading-tight"
          >
            CÓDIGO DE ACESSO
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-700">
            Digite o código do dia
          </p>
        </div>

        {/* Visor LCD Escuro */}
        <div className="w-full bg-[#020617] h-16 rounded-xl border-2 border-slate-700 flex items-center justify-center p-3 mb-4 shadow-inner">
          <span
            style={{ fontFamily: 'var(--font-mono), Space Mono, monospace' }}
            className={`text-3xl font-black tracking-widest ${
              hasError
                ? 'text-red-500 animate-shake'
                : isCompleted
                ? 'text-emerald-400'
                : 'text-cyan-400'
            }`}
          >
            {hasError
              ? 'ERRO'
              : inputCode
              ? inputCode.padEnd(5, '_')
              : '_____'}
          </span>
        </div>

        {/* Grid de Teclas 3D (1-9, ✕, 0, ✓) */}
        <div className="grid grid-cols-3 gap-2.5 w-full bg-slate-300 p-3.5 rounded-2xl border-2 border-slate-500 shadow-inner">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitPress(digit)}
              className="h-14 rounded-xl bg-slate-200 border-2 border-slate-400 border-b-4 border-b-slate-600 text-2xl font-black text-slate-800 font-mono shadow active:translate-y-1 active:border-b-2 transition-all cursor-pointer flex items-center justify-center"
            >
              {digit}
            </button>
          ))}

          {/* Botão Limpar (X Vermelho) */}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-xl bg-red-600 border-2 border-red-500 border-b-4 border-b-red-800 text-white font-black shadow active:translate-y-1 active:border-b-2 transition-all cursor-pointer flex items-center justify-center"
          >
            <X className="w-6 h-6 stroke-[3]" />
          </button>

          {/* Dígito 0 */}
          <button
            type="button"
            onClick={() => handleDigitPress('0')}
            className="h-14 rounded-xl bg-slate-200 border-2 border-slate-400 border-b-4 border-b-slate-600 text-2xl font-black text-slate-800 font-mono shadow active:translate-y-1 active:border-b-2 transition-all cursor-pointer flex items-center justify-center"
          >
            0
          </button>

          {/* Botão Confirmar (Check Amarelo/Verde) */}
          <button
            type="button"
            onClick={handleSubmit}
            className="h-14 rounded-xl bg-yellow-500 hover:bg-yellow-400 border-2 border-yellow-400 border-b-4 border-b-yellow-700 text-slate-950 font-black shadow active:translate-y-1 active:border-b-2 transition-all cursor-pointer flex items-center justify-center"
          >
            <Check className="w-7 h-7 stroke-[3]" />
          </button>
        </div>

        {/* Status de Conclusão */}
        {isCompleted && (
          <div className="w-full mt-3 py-2.5 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>CÓDIGO ACEITO COM SUCESSO!</span>
          </div>
        )}
      </div>
    </div>
  );
}
