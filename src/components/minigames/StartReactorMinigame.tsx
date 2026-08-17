'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';

interface StartReactorMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
}

// 9 Frequências harmônicas para cada tecla do Reator (3x3)
const GRID_FREQS = [
  261.63, 293.66, 329.63,
  349.23, 392.00, 440.00,
  493.88, 523.25, 587.33,
];

export const StartReactorMinigame: React.FC<StartReactorMinigameProps> = ({
  onComplete,
  onCancel,
}) => {
  // Sequência de 5 passos (índices 0 a 8 na grade 3x3)
  const [sequence, setSequence] = useState<number[]>([]);
  const [currentRound, setCurrentRound] = useState<number>(1); // 1 a 5
  const [activeFlashIndex, setActiveFlashIndex] = useState<number | null>(null);
  const [activeKeyIndex, setActiveKeyIndex] = useState<number | null>(null);
  const [playerInputIndex, setPlayerInputIndex] = useState<number>(0);
  const [phase, setPhase] = useState<'DEMO' | 'INPUT' | 'ERROR' | 'COMPLETE'>('DEMO');

  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  const clearAllTimeouts = () => {
    timeoutRefs.current.forEach((t) => clearTimeout(t));
    timeoutRefs.current = [];
  };

  // Síntese de áudio WebAudio (bipes do reator)
  const playTone = useCallback((freq: number, type: OscillatorType = 'triangle', duration = 0.2) => {
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

  // Inicializar sequência aleatória de 5 posições
  useEffect(() => {
    const seq = Array.from({ length: 5 }, () => Math.floor(Math.random() * 9));
    setSequence(seq);
    setCurrentRound(1);
  }, []);

  // Tocar a demonstração da rodada atual no visor superior
  const playDemonstration = useCallback((round: number, seq: number[]) => {
    clearAllTimeouts();
    setPhase('DEMO');
    setPlayerInputIndex(0);
    setActiveFlashIndex(null);

    const stepsToPlay = seq.slice(0, round);

    stepsToPlay.forEach((padIndex, i) => {
      // Ativação do quadrado azul no visor
      const flashOn = setTimeout(() => {
        setActiveFlashIndex(padIndex);
        playTone(GRID_FREQS[padIndex] || 350, 'triangle', 0.22);
        if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
          navigator.vibrate(20);
        }
      }, (i + 1) * 480);

      // Desativação
      const flashOff = setTimeout(() => {
        setActiveFlashIndex(null);
      }, (i + 1) * 480 + 280);

      timeoutRefs.current.push(flashOn, flashOff);
    });

    // Liberar entrada para o jogador
    const enableInput = setTimeout(() => {
      setPhase('INPUT');
    }, (stepsToPlay.length + 1) * 480 + 100);

    timeoutRefs.current.push(enableInput);
  }, [playTone]);

  // Iniciar demonstração quando a sequência ou a rodada mudar
  useEffect(() => {
    if (sequence.length === 5 && phase !== 'COMPLETE') {
      playDemonstration(currentRound, sequence);
    }
    return () => clearAllTimeouts();
  }, [currentRound, sequence, playDemonstration]);

  // Jogador pressiona uma tecla no teclado inferior (3x3)
  const handleKeyPress = (keyIndex: number) => {
    if (phase !== 'INPUT') return;

    setActiveKeyIndex(keyIndex);
    setTimeout(() => setActiveKeyIndex(null), 180);

    const expectedIndex = sequence[playerInputIndex];

    if (keyIndex === expectedIndex) {
      // ACERTO DO PASSO
      playTone(GRID_FREQS[keyIndex] || 350, 'triangle', 0.18);
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate(25);
      }

      const nextInputIdx = playerInputIndex + 1;

      if (nextInputIdx === currentRound) {
        // Concluiu a rodada atual!
        if (currentRound === 5) {
          // Vitória total das 5 rodadas!
          setPhase('COMPLETE');
          playTone(587.33, 'sine', 0.15);
          setTimeout(() => playTone(880, 'sine', 0.3), 150);
          if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
            navigator.vibrate([40, 80, 40, 80, 150]);
          }
          setTimeout(() => onComplete(), 750);
        } else {
          // Avança para a próxima rodada
          setCurrentRound((prev) => prev + 1);
        }
      } else {
        setPlayerInputIndex(nextInputIdx);
      }
    } else {
      // ERRO NA REPLICAÇÃO: Reseta para a Rodada 1 com nova sequência
      playTone(160, 'sawtooth', 0.4);
      setPhase('ERROR');
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([100, 60, 100]);
      }

      const resetTimer = setTimeout(() => {
        const newSeq = Array.from({ length: 5 }, () => Math.floor(Math.random() * 9));
        setSequence(newSeq);
        setCurrentRound(1);
        setPlayerInputIndex(0);
        playDemonstration(1, newSeq);
      }, 850);

      timeoutRefs.current.push(resetTimer);
    }
  };

  const isCompletedRound = (ledIndex: number) => {
    return ledIndex < currentRound - 1 || phase === 'COMPLETE';
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console Principal do Reator - Orientação Vertical 9:16 */}
      <div className="w-full max-w-xs sm:max-w-sm bg-slate-900 border-4 border-slate-700 rounded-3xl p-3.5 sm:p-4 shadow-2xl relative overflow-hidden flex flex-col items-center gap-2.5">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-2.5 left-2.5 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-950 border border-slate-700 transition-colors z-20 cursor-pointer shadow active:scale-95"
          title="Fechar Minigame"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Título do Terminal */}
        <div className="text-center pt-0.5 pb-0.5 pl-8 pr-2 w-full">
          <h2
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
            className="text-lg uppercase tracking-wider text-slate-100 flex items-center justify-center gap-1.5"
          >
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>INICIAR REATOR</span>
          </h2>
          <p className="text-[9px] font-mono font-bold text-slate-400">
            Memorize no visor superior e repita no teclado inferior
          </p>
        </div>

        {/* ======================================================== */}
        {/* BLOCO SUPERIOR: VISOR DO REATOR (TELA PRETA CHANFRADA 3D) */}
        {/* ======================================================== */}
        <div className="w-full bg-gradient-to-b from-[#8f969f] via-[#717882] to-[#59606a] p-2.5 rounded-2xl border-4 border-[#3f444e] shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_6px_12px_rgba(0,0,0,0.6)] flex flex-col items-center gap-1.5">
          {/* Fileira de 5 LEDs de Status do Visor */}
          <div className="flex items-center justify-center gap-2 w-full py-0.5">
            {[0, 1, 2, 3, 4].map((idx) => {
              const isLit = isCompletedRound(idx);

              return (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border-2 border-black transition-all duration-200 ${
                    isLit
                      ? 'bg-emerald-400 shadow-[0_0_10px_#22c55e]'
                      : phase === 'ERROR'
                      ? 'bg-red-600 shadow-[0_0_8px_#ef4444]'
                      : 'bg-gradient-to-b from-[#18181b] to-[#27272a] shadow-inner'
                  }`}
                />
              );
            })}
          </div>

          {/* Tela Preta do Monitor do Reator */}
          <div className="w-48 h-36 bg-black rounded-xl border-4 border-[#27272a] shadow-[inset_0_0_16px_#000000] p-1.5 grid grid-cols-3 gap-1.5 relative overflow-hidden">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
              const isFlashing = activeFlashIndex === idx;
              const isErr = phase === 'ERROR';

              return (
                <div
                  key={idx}
                  className={`w-full h-full rounded-md transition-all duration-100 ${
                    isErr
                      ? 'bg-red-600/80 shadow-[0_0_12px_#ef4444]'
                      : isFlashing
                      ? 'bg-[#3b82f6] shadow-[0_0_20px_#3b82f6] scale-95 border-2 border-white/80'
                      : 'bg-transparent'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* BLOCO INFERIOR: TECLADO DO REATOR (BOTÕES 3D CHANFRADOS) */}
        {/* ======================================================== */}
        <div className="w-full bg-gradient-to-b from-[#8f969f] via-[#717882] to-[#59606a] p-2.5 rounded-2xl border-4 border-[#3f444e] shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_6px_12px_rgba(0,0,0,0.6)] flex flex-col items-center gap-1.5">
          {/* Fileira de 5 LEDs de Status do Teclado */}
          <div className="flex items-center justify-center gap-2 w-full py-0.5">
            {[0, 1, 2, 3, 4].map((idx) => {
              const isLit = isCompletedRound(idx);

              return (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border-2 border-black transition-all duration-200 ${
                    isLit
                      ? 'bg-emerald-400 shadow-[0_0_10px_#22c55e]'
                      : phase === 'ERROR'
                      ? 'bg-red-600 shadow-[0_0_8px_#ef4444]'
                      : 'bg-gradient-to-b from-[#18181b] to-[#27272a] shadow-inner'
                  }`}
                />
              );
            })}
          </div>

          {/* Grade 3x3 de Botões Mecânicos 3D */}
          <div className="w-48 h-36 grid grid-cols-3 gap-1.5 p-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
              const isPressed = activeKeyIndex === idx;
              const isInputAllowed = phase === 'INPUT';

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!isInputAllowed}
                  onClick={() => handleKeyPress(idx)}
                  className={`w-full h-full rounded-lg border-2 select-none touch-none cursor-pointer transition-all duration-75 flex items-center justify-center ${
                    isPressed
                      ? 'bg-[#2563eb] border-white shadow-[0_0_18px_#3b82f6] scale-90 translate-y-1'
                      : !isInputAllowed
                      ? 'bg-gradient-to-b from-[#52525b] to-[#3f3f46] border-[#27272a] opacity-80 cursor-not-allowed shadow-inner'
                      : 'bg-gradient-to-b from-[#e4e4e7] via-[#d4d4d8] to-[#a1a1aa] hover:from-white hover:to-[#d4d4d8] border-[#71717a] border-b-4 border-b-[#3f3f46] shadow-[0_4px_6px_rgba(0,0,0,0.5)] active:translate-y-1 active:border-b-2'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Feedback de Status */}
        {phase === 'COMPLETE' ? (
          <div className="w-full py-1.5 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>REATOR INICIALIZADO COM SUCESSO!</span>
          </div>
        ) : phase === 'ERROR' ? (
          <div className="w-full py-1.5 bg-red-950 text-red-300 font-bold text-xs font-mono rounded-xl text-center border border-red-500/60 animate-shake">
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
            SEQUÊNCIA INCORRETA! REINICIANDO (RODADA 1/5)...
          </div>
        ) : (
          <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between w-full px-1">
            <span>{phase === 'DEMO' ? 'OBSERVE O VISOR...' : `SUA VEZ: ${playerInputIndex + 1} DE ${currentRound}`}</span>
            <span className="text-cyan-400 font-bold font-mono">RODADA {currentRound} / 5</span>
          </div>
        )}
      </div>
    </div>
  );
};
