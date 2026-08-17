'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle2, Fuel, ArrowRight } from 'lucide-react';

interface RefuelEngineMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
}

type RefuelStage =
  | 'FILL_CANISTER_1' // 1: Encher o galão no Depósito de Combustível
  | 'POUR_UPPER_ENGINE' // 2: Despejar no Motor Superior
  | 'FILL_CANISTER_2' // 3: Recarregar o galão no Depósito
  | 'POUR_LOWER_ENGINE'; // 4: Despejar no Motor Inferior

export const RefuelEngineMinigame: React.FC<RefuelEngineMinigameProps> = ({
  onComplete,
  onCancel,
}) => {
  const [stage, setStage] = useState<RefuelStage>('FILL_CANISTER_1');
  const [level, setLevel] = useState<number>(0); // 0 a 100%
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const animFrameRef = useRef<number | null>(null);

  // Síntese de áudio de motor de bomba de combustível
  const playPumpSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }, []);

  const playDing = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }, []);

  // Loop de bombeamento enquanto o botão é mantido pressionado
  useEffect(() => {
    if (!isHolding || isCompleted) return;

    playPumpSound();

    const loop = () => {
      setLevel((prev) => {
        const next = Math.min(100, prev + 0.85);

        if (next >= 100) {
          playDing();
          if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
            navigator.vibrate([40, 80, 40, 80, 150]);
          }

          // Transição entre as 4 etapas bifásicas
          if (stage === 'FILL_CANISTER_1') {
            setTimeout(() => {
              setStage('POUR_UPPER_ENGINE');
              setLevel(0);
              setIsHolding(false);
            }, 600);
          } else if (stage === 'POUR_UPPER_ENGINE') {
            setTimeout(() => {
              setStage('FILL_CANISTER_2');
              setLevel(0);
              setIsHolding(false);
            }, 600);
          } else if (stage === 'FILL_CANISTER_2') {
            setTimeout(() => {
              setStage('POUR_LOWER_ENGINE');
              setLevel(0);
              setIsHolding(false);
            }, 600);
          } else if (stage === 'POUR_LOWER_ENGINE') {
            setIsCompleted(true);
            setTimeout(() => onComplete(), 750);
          }
        }

        return next;
      });

      if (!isCompleted) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isHolding, isCompleted, stage, onComplete, playDing, playPumpSound]);

  const handleStartHold = () => {
    if (isCompleted) return;
    setIsHolding(true);
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(25);
    }
  };

  const handleEndHold = () => {
    if (isCompleted) return;
    setIsHolding(false);
  };

  // Título e Descrição de cada Etapa
  const stageInfo = {
    FILL_CANISTER_1: {
      title: 'DEPÓSITO: ENCHER GALÃO (1/2)',
      desc: 'Bombeie combustível para abastecer o galão portátil',
      targetName: 'GALÃO PORTÁTIL',
      pourTarget: 'GALÃO',
      color: '#f59e0b',
    },
    POUR_UPPER_ENGINE: {
      title: 'MOTOR SUPERIOR: ABASTECER',
      desc: 'Transfira o combustível do galão para o Motor Superior',
      targetName: 'MOTOR SUPERIOR',
      pourTarget: 'MOTOR SUPERIOR',
      color: '#06b6d4',
    },
    FILL_CANISTER_2: {
      title: 'DEPÓSITO: RECARREGAR GALÃO (2/2)',
      desc: 'Recarregue o galão para o segundo motor',
      targetName: 'GALÃO PORTÁTIL',
      pourTarget: 'GALÃO',
      color: '#f59e0b',
    },
    POUR_LOWER_ENGINE: {
      title: 'MOTOR INFERIOR: ABASTECER',
      desc: 'Transfira o combustível final para o Motor Inferior',
      targetName: 'MOTOR INFERIOR',
      pourTarget: 'MOTOR INFERIOR',
      color: '#10b981',
    },
  }[stage];

  const stageStepNumber =
    stage === 'FILL_CANISTER_1'
      ? 1
      : stage === 'POUR_UPPER_ENGINE'
      ? 2
      : stage === 'FILL_CANISTER_2'
      ? 3
      : 4;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console de Abastecimento */}
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

        {/* Título do Terminal com Badge da Etapa Atual */}
        <div className="text-center pt-1 pb-1 pl-10 pr-2 w-full">
          <h2
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
            className="text-lg uppercase tracking-wider text-slate-100 flex items-center justify-center gap-2"
          >
            <Fuel className="w-5 h-5 text-yellow-400" />
            <span>{stageInfo.title}</span>
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-400">
            {stageInfo.desc}
          </p>
        </div>

        {/* Stepper de 4 Etapas do Fluxo Bifásico */}
        <div className="flex items-center justify-between w-full px-2 gap-1">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`flex-1 h-2 rounded-full transition-all duration-300 ${
                step < stageStepNumber || isCompleted
                  ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                  : step === stageStepNumber
                  ? 'bg-yellow-400 animate-pulse'
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Tanque de Combustível Central com Animação de Fluxo */}
        <div className="w-full bg-[#020617] p-4 rounded-2xl border-2 border-slate-700 shadow-inner flex flex-col items-center gap-3">
          {/* Luz de Status e Nível Numérico */}
          <div className="flex items-center justify-between w-full px-2 text-[10px] font-mono font-bold">
            <span className="text-slate-400">ALVO: {stageInfo.targetName}</span>
            <div className="flex items-center gap-2">
              <div
                className={`w-3.5 h-3.5 rounded-full border border-black transition-all ${
                  level >= 100
                    ? 'bg-emerald-400 shadow-[0_0_12px_#10b981]'
                    : isHolding
                    ? 'bg-yellow-400 animate-pulse'
                    : 'bg-slate-900'
                }`}
              />
              <span className={level >= 100 ? 'text-emerald-400 font-black' : 'text-slate-300'}>
                {Math.round(level)}%
              </span>
            </div>
          </div>

          {/* Tanque Transparente com Cano e Efeito de Fluxo Despejando */}
          <div className="relative w-full h-44 bg-slate-950 rounded-xl border-4 border-slate-800 overflow-hidden shadow-inner flex flex-col justify-end">
            {/* Vidro com Reflexo */}
            <div className="absolute inset-0 bg-cyan-500/5 pointer-events-none z-20" />

            {/* Bico / Cano Superior de Injeção */}
            <div className="absolute top-0 inset-x-1/2 -translate-x-1/2 w-8 h-4 bg-slate-700 border-x-2 border-b-2 border-slate-600 rounded-b-md z-20" />

            {/* Linha Máxima de Abastecimento (100%) */}
            <div className="absolute top-4 inset-x-2 border-t-2 border-dashed border-red-500/80 flex items-center justify-end pr-2 z-20">
              <span className="text-[8px] font-mono font-black text-red-400 bg-slate-950/80 px-1 rounded">
                NÍVEL MAX 100%
              </span>
            </div>

            {/* Jato de Fluxo de Combustível Caindo quando segurado */}
            {isHolding && level < 100 && (
              <div className="absolute top-4 inset-x-1/2 -translate-x-1/2 w-2.5 bottom-0 bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-500 opacity-90 z-15 animate-pulse shadow-[0_0_12px_#f59e0b]">
                <div className="w-full h-full bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:4px_8px] animate-bounce" />
              </div>
            )}

            {/* Fluido de Combustível Amarelo/Dourado no Fundo */}
            <div
              style={{ height: `${level}%` }}
              className="w-full bg-gradient-to-t from-amber-600 via-yellow-500 to-amber-400 relative transition-all duration-75 shadow-[0_0_20px_rgba(245,158,11,0.5)] z-10"
            >
              {/* Espuma / Ondulação Dinâmica na Superfície */}
              <div className="absolute top-0 inset-x-0 h-2 bg-yellow-200/80 animate-pulse" />
            </div>
          </div>

          {/* Botão Gigante de Bombeamento (Segurar) */}
          <button
            type="button"
            disabled={isCompleted || level >= 100}
            onMouseDown={handleStartHold}
            onMouseUp={handleEndHold}
            onMouseLeave={handleEndHold}
            onTouchStart={handleStartHold}
            onTouchEnd={handleEndHold}
            className={`w-full py-3.5 rounded-2xl border-2 font-mono font-black text-xs uppercase tracking-wider transition-all select-none touch-none cursor-pointer flex items-center justify-center gap-2 shadow-xl ${
              isCompleted
                ? 'bg-emerald-950 border-emerald-500 text-emerald-400 cursor-not-allowed opacity-90'
                : isHolding
                ? 'bg-yellow-500 border-yellow-300 text-slate-950 scale-95 shadow-[0_0_25px_#f59e0b]'
                : 'bg-gradient-to-b from-yellow-400 to-amber-600 hover:from-yellow-300 hover:to-amber-500 text-slate-950 border-yellow-300 border-b-4 border-b-amber-900 active:translate-y-1 active:border-b-2'
            }`}
          >
            <Fuel className="w-4 h-4" />
            <span>
              {isCompleted
                ? 'MOTORES TOTALMENTE ABASTECIDOS!'
                : level >= 100
                ? 'TRANSFERÊNCIA CONCLUÍDA...'
                : isHolding
                ? `BOMBEANDO PARA ${stageInfo.pourTarget}...`
                : `SEGURE PARA ENCHER (${stageStepNumber}/4)`}
            </span>
          </button>
        </div>

        {/* Feedback de Status e Navegação */}
        {isCompleted ? (
          <div className="w-full py-2 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>MOTORES SUPERIOR E INFERIOR 100% ABASTECIDOS!</span>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-center gap-1">
            <span>Etapa {stageStepNumber} de 4:</span>
            <span className="text-cyan-400 font-bold">{stageInfo.title}</span>
          </div>
        )}
      </div>
    </div>
  );
};
