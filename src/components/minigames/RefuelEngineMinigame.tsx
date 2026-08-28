'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle2, Fuel } from 'lucide-react';

export type RefuelStage =
  | 'FILL_CANISTER_1' // 1: Encher o galão no Depósito
  | 'POUR_UPPER_ENGINE' // 2: Despejar no Motor Superior
  | 'FILL_CANISTER_2' // 3: Recarregar o galão no Depósito
  | 'POUR_LOWER_ENGINE'; // 4: Despejar no Motor Inferior

interface RefuelEngineMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
  singleStage?: RefuelStage;
}

const STAGE_DURATION_MS = 3800; // 3.8 segundos exatos de bombeamento por etapa (oficial do Among Us)

export const RefuelEngineMinigame: React.FC<RefuelEngineMinigameProps> = ({
  onComplete,
  onCancel,
  singleStage,
}) => {
  const [stage, setStage] = useState<RefuelStage>(singleStage || 'FILL_CANISTER_1');
  const [level, setLevel] = useState<number>(0); // 0 a 100%
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [isStageDone, setIsStageDone] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const animFrameRef = useRef<number | null>(null);
  const isHoldingRef = useRef<boolean>(false);
  const isTransitioningRef = useRef<boolean>(false);
  const isCompletedRef = useRef<boolean>(false);
  const lastTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    isHoldingRef.current = isHolding;
  }, [isHolding]);

  // Síntese de áudio de motor de bomba de combustível
  const playPumpSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(85, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
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
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  }, []);

  // Transição segura entre as 4 etapas
  const advanceToNextStage = useCallback((currentStage: RefuelStage) => {
    if (isCompletedRef.current) return;

    if (singleStage) {
      isCompletedRef.current = true;
      setIsCompleted(true);
      setTimeout(() => onComplete(), 750);
      return;
    }

    if (currentStage === 'FILL_CANISTER_1') {
      setStage('POUR_UPPER_ENGINE');
      setLevel(0);
      setIsStageDone(false);
      isTransitioningRef.current = false;
      lastTimestampRef.current = null;
    } else if (currentStage === 'POUR_UPPER_ENGINE') {
      setStage('FILL_CANISTER_2');
      setLevel(0);
      setIsStageDone(false);
      isTransitioningRef.current = false;
      lastTimestampRef.current = null;
    } else if (currentStage === 'FILL_CANISTER_2') {
      setStage('POUR_LOWER_ENGINE');
      setLevel(0);
      setIsStageDone(false);
      isTransitioningRef.current = false;
      lastTimestampRef.current = null;
    } else if (currentStage === 'POUR_LOWER_ENGINE') {
      isCompletedRef.current = true;
      setIsCompleted(true);
      setTimeout(() => onComplete(), 750);
    }
  }, [onComplete, singleStage]);

  // Loop contínuo de bombeamento (3.8 segundos por etapa)
  useEffect(() => {
    if (!isHolding || isCompleted || isTransitioningRef.current) return;

    let lastSound = 0;
    lastTimestampRef.current = null;

    const loop = (timestamp: number) => {
      if (!isHoldingRef.current || isCompletedRef.current || isTransitioningRef.current) return;

      if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;
      const deltaMs = Math.min(50, timestamp - lastTimestampRef.current);
      lastTimestampRef.current = timestamp;

      if (timestamp - lastSound > 220) {
        playPumpSound();
        lastSound = timestamp;

        if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
          navigator.vibrate(15);
        }
      }

      setLevel((prev) => {
        const increment = (deltaMs / STAGE_DURATION_MS) * 100;
        const next = prev + increment;

        if (next >= 100) {
          isTransitioningRef.current = true;
          isHoldingRef.current = false;
          setIsHolding(false);
          setIsStageDone(true);

          playDing();
          if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
            navigator.vibrate([40, 80, 40, 80, 150]);
          }

          setTimeout(() => {
            advanceToNextStage(stage);
          }, 1100);

          return 100;
        }

        return next;
      });

      if (!isTransitioningRef.current && !isCompletedRef.current) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isHolding, isCompleted, stage, advanceToNextStage, playDing, playPumpSound]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isCompleted || isStageDone || isTransitioningRef.current || level >= 100) return;
    setIsHolding(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(25);
    }
  };

  const handlePointerUp = () => {
    if (isCompleted || isTransitioningRef.current) return;
    setIsHolding(false);
    lastTimestampRef.current = null;
  };

  const isFillCanister = stage === 'FILL_CANISTER_1' || stage === 'FILL_CANISTER_2';
  const stageStepNumber =
    stage === 'FILL_CANISTER_1'
      ? 1
      : stage === 'POUR_UPPER_ENGINE'
      ? 2
      : stage === 'FILL_CANISTER_2'
      ? 3
      : 4;

  const stageLabels = {
    FILL_CANISTER_1: {
      location: 'DEPÓSITO DE COMBUSTÍVEL',
      title: 'ENCHER GALÃO (1/2)',
      desc: 'Segure o botão para encher o galão amarelo portátil',
      actionText: 'ENCHENDO GALÃO',
    },
    POUR_UPPER_ENGINE: {
      location: 'MOTOR SUPERIOR',
      title: 'ABASTECER MOTOR SUPERIOR',
      desc: 'Transfira o combustível do galão para o tanque do motor',
      actionText: 'ABASTECENDO MOTOR SUPERIOR',
    },
    FILL_CANISTER_2: {
      location: 'DEPÓSITO DE COMBUSTÍVEL',
      title: 'RECARREGAR GALÃO (2/2)',
      desc: 'Encha o galão novamente para o segundo motor',
      actionText: 'RECARREGANDO GALÃO',
    },
    POUR_LOWER_ENGINE: {
      location: 'MOTOR INFERIOR',
      title: 'ABASTECER MOTOR INFERIOR',
      desc: 'Transfira o combustível final para o motor inferior',
      actionText: 'ABASTECENDO MOTOR INFERIOR',
    },
  }[stage];

  const isFull = level >= 100 || isStageDone;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console Industrial do Refuel Station */}
      <div className="w-full max-w-sm bg-slate-800 border-4 border-slate-600 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden flex flex-col items-center gap-3">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 left-3 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-900 border border-slate-700 transition-colors z-30 cursor-pointer shadow active:scale-95"
          title="Fechar Minigame"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Título do Terminal */}
        <div className="text-center pt-1 pb-1 pl-10 pr-2 w-full">
          <div className="flex items-center justify-center gap-1 text-[10px] font-mono font-black text-amber-400 uppercase tracking-widest">
            <span>{stageLabels.location}</span>
          </div>
          <h2
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
            className="text-xl uppercase tracking-wider text-slate-100 flex items-center justify-center gap-2 mt-0.5"
          >
            <Fuel className="w-5 h-5 text-yellow-400" />
            <span>{stageLabels.title}</span>
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-400">
            {stageLabels.desc}
          </p>
        </div>

        {/* Stepper das 4 Etapas */}
        <div className="flex items-center justify-between w-full px-1 gap-1.5">
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

        {/* Área Central: Painel Industrial (Depósito vs Motor) + Caixa de Controle */}
        <div className="w-full flex items-center justify-between gap-3 bg-[#0a0f1d] p-3.5 rounded-2xl border-4 border-slate-700 shadow-inner">
          {/* Painel Esquerdo: Recipiente Principal */}
          <div className="relative flex-1 h-76 bg-slate-950 rounded-xl border-2 border-slate-800 p-2 flex flex-col items-center justify-between shadow-inner overflow-hidden">
            {isFillCanister ? (
              /* ======================================================== */
              /* MODO 1: DEPÓSITO DE COMBUSTÍVEL (ENCHER GALÃO JERRYCAN)  */
              /* ======================================================== */
              <div className="relative w-full flex-1 flex flex-col items-center justify-center">
                {/* Silhueta do Galão de Gasolina Oficial (Jerrycan) */}
                <div className="relative w-40 h-56 bg-slate-950 border-4 border-red-500 rounded-3xl p-1.5 shadow-[0_0_15px_rgba(239,68,68,0.4)] flex flex-col justify-end overflow-hidden">
                  {/* Bocal à esquerda e alça no topo em alto relevo */}
                  <div className="absolute -top-3 left-4 w-7 h-5 bg-slate-950 border-2 border-red-500 rounded-t-sm" />
                  <div className="absolute -top-4 inset-x-12 h-4 bg-slate-950 border-2 border-red-500 rounded-t-lg" />

                  {/* Linhas pontilhadas de graduação brancas (estilo Among Us) */}
                  <div className="absolute inset-x-3 inset-y-4 flex flex-col justify-between pointer-events-none z-20">
                    {[1, 2, 3, 4].map((tick) => (
                      <div
                        key={tick}
                        className="w-full border-t-2 border-dashed border-white/60 opacity-80"
                      />
                    ))}
                  </div>

                  {/* Jato de Combustível caindo do topo */}
                  {isHolding && level < 100 && (
                    <div
                      style={{ height: `${100 - level}%` }}
                      className="absolute top-0 inset-x-1/2 -translate-x-1/2 w-2.5 bg-yellow-200/90 z-20 shadow-[0_0_10px_#fef08a] animate-pulse"
                    />
                  )}

                  {/* Combustível Amarelo/Dourado Enchendo o Galão */}
                  <div
                    style={{ height: `${level}%` }}
                    className="w-full bg-gradient-to-t from-amber-600 via-yellow-500 to-yellow-400 relative shadow-[0_0_20px_rgba(245,158,11,0.9)] z-10"
                  >
                    {/* Linha de Espuma na Superfície */}
                    <div className="absolute top-0 inset-x-0 h-2 bg-yellow-100/90 shadow-[0_0_8px_#ffffff] animate-pulse" />
                  </div>
                </div>

                <span className="text-[9px] font-mono font-black text-amber-400 mt-2 uppercase tracking-widest">
                  REFUEL STATION • DEPÓSITO
                </span>
              </div>
            ) : (
              /* ======================================================== */
              /* MODO 2: MOTOR (ENCHER TANQUE VERTICAL DO MOTOR)          */
              /* ======================================================== */
              <div className="relative w-full flex-1 flex flex-col items-center justify-between pt-1 pb-1">
                {/* Mini Galão Inclinado no Topo Esvaziando */}
                <div className="relative w-full flex items-center justify-end pr-2 gap-2">
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-mono font-bold text-slate-400">GALÃO</span>
                    <span className="text-[9px] font-mono font-black text-amber-400">
                      {Math.max(0, 100 - Math.round(level))}%
                    </span>
                  </div>

                  {/* Mini Galão SVG Inclinado */}
                  <div className="relative w-12 h-14 bg-slate-950 border-2 border-red-500 rounded-lg p-0.5 shadow-md flex flex-col justify-end overflow-hidden rotate-[-20deg]">
                    <div className="absolute -top-2 left-1 w-3 h-2 bg-slate-950 border border-red-500" />
                    <div
                      style={{ height: `${Math.max(0, 100 - level)}%` }}
                      className="w-full bg-yellow-400 shadow-inner"
                    />
                  </div>
                </div>

                {/* Tanque Vertical Principal do Motor (Tubo com Base Arredondada) */}
                <div className="relative w-20 h-48 bg-slate-950 border-4 border-red-500 rounded-b-full rounded-t-xl p-1 shadow-[0_0_18px_rgba(239,68,68,0.4)] flex flex-col justify-end overflow-hidden -mt-1">
                  {/* Linhas pontilhadas brancas de graduação */}
                  <div className="absolute inset-x-2 inset-y-4 flex flex-col justify-between pointer-events-none z-20">
                    {[1, 2, 3, 4, 5].map((tick) => (
                      <div
                        key={tick}
                        className="w-full border-t-2 border-dashed border-white/60 opacity-80"
                      />
                    ))}
                  </div>

                  {/* Jato de combustível caindo do mini galão para o tanque */}
                  {isHolding && level < 100 && (
                    <div
                      style={{ height: `${100 - level}%` }}
                      className="absolute top-0 inset-x-1/2 -translate-x-1/2 w-2.5 bg-yellow-200/90 z-20 shadow-[0_0_10px_#fef08a] animate-pulse"
                    />
                  )}

                  {/* Combustível Enchendo o Tanque do Motor */}
                  <div
                    style={{ height: `${level}%` }}
                    className="w-full bg-gradient-to-t from-amber-600 via-yellow-500 to-yellow-400 relative shadow-[0_0_20px_rgba(245,158,11,0.9)] rounded-b-full z-10"
                  >
                    {/* Linha de Superfície */}
                    <div className="absolute top-0 inset-x-0 h-2 bg-yellow-100/90 shadow-[0_0_8px_#ffffff] animate-pulse" />
                  </div>
                </div>

                <span className="text-[9px] font-mono font-black text-cyan-400 mt-1 uppercase tracking-widest">
                  TANQUE DO {stageLabels.location}
                </span>
              </div>
            )}
          </div>

          {/* Painel Direito: Caixa de Controle e Botão Mecânico */}
          <div className="w-24 h-76 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 rounded-xl border-2 border-slate-700 p-2 flex flex-col items-center justify-between shadow-2xl">
            {/* Luzes Indicadoras LED (Vermelha e Verde no topo) */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[8px] font-mono font-bold text-slate-400 uppercase">
                STATUS
              </span>
              <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                {/* LED Vermelho */}
                <div
                  className={`w-3.5 h-3.5 rounded-full border border-black transition-all ${
                    isHolding && !isFull
                      ? 'bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse'
                      : 'bg-red-950 opacity-40'
                  }`}
                />
                {/* LED Verde */}
                <div
                  className={`w-3.5 h-3.5 rounded-full border border-black transition-all ${
                    isFull
                      ? 'bg-emerald-400 shadow-[0_0_12px_#10b981]'
                      : 'bg-emerald-950 opacity-40'
                  }`}
                />
              </div>
            </div>

            {/* Display Digital de Porcentagem */}
            <div className="bg-black/90 px-2 py-1 rounded-md border border-slate-800 font-mono text-xs font-black text-amber-400 text-center w-full shadow-inner">
              {Math.round(level)}%
            </div>

            {/* Botão 3D de Pressão (Pointer Capture) */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                disabled={isCompleted || isFull}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`w-16 h-16 rounded-xl border-4 cursor-pointer shadow-2xl flex items-center justify-center select-none touch-none transition-transform duration-75 ${
                  isFull
                    ? 'bg-emerald-700 border-emerald-400 opacity-80 cursor-not-allowed'
                    : isHolding
                    ? 'bg-slate-300 border-slate-100 scale-90 shadow-[0_0_20px_#ffffff]'
                    : 'bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 hover:from-white hover:to-slate-300 border-slate-600 active:scale-90'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-900/10 shadow-inner flex items-center justify-center pointer-events-none">
                  <Fuel className={`w-5 h-5 ${isHolding ? 'text-slate-900' : 'text-slate-800'}`} />
                </div>
              </button>
              <span className="text-[8px] font-mono font-bold text-slate-400 uppercase pointer-events-none">
                {isFull ? 'CHEIO' : isHolding ? 'BOMBANDO' : 'SEGURE'}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback de Status */}
        {isCompleted ? (
          <div className="w-full py-2 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>MOTORES TOTALMENTE ABASTECIDOS!</span>
          </div>
        ) : isStageDone ? (
          <div className="w-full py-2 bg-emerald-950 border border-emerald-500/60 text-emerald-300 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow animate-pulse">
            <CheckCircle2 className="w-4 h-4" />
            <span>ETAPA CONCLUÍDA! PREPARANDO PRÓXIMA...</span>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-center gap-1">
            <span>Etapa {stageStepNumber}/4:</span>
            <span className="text-cyan-400 font-bold">{stageLabels.title}</span>
          </div>
        )}
      </div>
    </div>
  );
};
