'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';

interface StartReactorMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
}

// 9 Frequências para cada tecla do Reator (3x3)
const GRID_FREQS = [
  261.63, 293.66, 329.63,
  349.23, 392.00, 440.00,
  493.88, 523.25, 587.33,
];

export const StartReactorMinigame: React.FC<StartReactorMinigameProps> = ({
  onComplete,
  onCancel,
}) => {
  // Sequência completa de 5 passos (índices 0 a 8)
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

  // Síntese de áudio WebAudio
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

  // Tocar a demonstração da rodada atual na tela esquerda
  const playDemonstration = useCallback((round: number, seq: number[]) => {
    clearAllTimeouts();
    setPhase('DEMO');
    setPlayerInputIndex(0);
    setActiveFlashIndex(null);

    const stepsToPlay = seq.slice(0, round);

    stepsToPlay.forEach((padIndex, i) => {
      // Tempo de ativação de cada passo
      const flashOn = setTimeout(() => {
        setActiveFlashIndex(padIndex);
        playTone(GRID_FREQS[padIndex] || 350, 'triangle', 0.22);
        if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
          navigator.vibrate(20);
        }
      }, (i + 1) * 480);

      // Tempo de apagamento
      const flashOff = setTimeout(() => {
        setActiveFlashIndex(null);
      }, (i + 1) * 480 + 280);

      timeoutRefs.current.push(flashOn, flashOff);
    });

    // Liberar para o jogador interagir
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

  // Jogador pressiona uma tecla no teclado direito (3x3)
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
      // ERRO NA REPLICAÇÃO
      playTone(160, 'sawtooth', 0.35);
      setPhase('ERROR');
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([100, 60, 100]);
      }

      const resetTimer = setTimeout(() => {
        // Reiniciar demonstração da rodada atual
        playDemonstration(currentRound, sequence);
      }, 700);

      timeoutRefs.current.push(resetTimer);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console Principal do Reator */}
      <div className="w-full max-w-md bg-slate-800 border-4 border-slate-600 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden flex flex-col items-center gap-3">
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
            <Cpu className="w-5 h-5 text-cyan-400" />
            <span>INICIAR REATOR</span>
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-400">
            Memorize a sequência luminosa à esquerda e repita no teclado à direita
          </p>
        </div>

        {/* Display Duplo: Tela de Exibição (Esquerda) vs Teclado de Entrada (Direita) */}
        <div className="w-full grid grid-cols-2 gap-3 bg-[#020617] p-3.5 rounded-2xl border-2 border-slate-700 shadow-inner">
          {/* Painel Esquerdo: Tela de Demonstração e Coluna de LEDs de Progresso */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-between w-full px-1 text-[9px] font-mono font-bold text-slate-400">
              <span>VISOR</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((r) => (
                  <div
                    key={r}
                    className={`w-2 h-2 rounded-full border border-black transition-all ${
                      r < currentRound || phase === 'COMPLETE'
                        ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                        : r === currentRound
                        ? 'bg-yellow-400 animate-pulse'
                        : 'bg-slate-900'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Grade 3x3 de LEDs Indicadores */}
            <div className="grid grid-cols-3 gap-1.5 w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 shadow-inner">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
                const isFlashing = activeFlashIndex === idx;
                const isErr = phase === 'ERROR';

                return (
                  <div
                    key={idx}
                    className={`aspect-square rounded-lg border transition-all duration-100 ${
                      isErr
                        ? 'bg-red-600 border-red-400 shadow-[0_0_12px_#ef4444]'
                        : isFlashing
                        ? 'bg-cyan-300 border-white shadow-[0_0_16px_#06b6d4] scale-95'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  />
                );
              })}
            </div>

            <span className="text-[10px] font-mono font-bold text-slate-500">
              {phase === 'DEMO' ? 'OBSERVE A SEQUÊNCIA...' : 'AGUARDANDO SUA ENTRADA'}
            </span>
          </div>

          {/* Painel Direito: Teclado Clicável 3x3 */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-full text-right px-1 text-[9px] font-mono font-bold text-cyan-400">
              TECLADO
            </div>

            {/* Grade 3x3 de Teclas de Acrílico Clicáveis */}
            <div className="grid grid-cols-3 gap-1.5 w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 shadow-inner">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
                const isPressed = activeKeyIndex === idx;
                const isDisabled = phase !== 'INPUT';

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleKeyPress(idx)}
                    className={`aspect-square rounded-lg border-2 font-mono font-black text-sm flex items-center justify-center transition-all select-none ${
                      isPressed
                        ? 'bg-cyan-300 text-slate-950 border-white shadow-[0_0_14px_#06b6d4] scale-90'
                        : isDisabled
                        ? 'bg-slate-800/80 border-slate-700 text-slate-600 opacity-60 cursor-not-allowed'
                        : 'bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white border-blue-400 border-b-4 border-b-indigo-900 shadow-md active:translate-y-1 active:border-b-2 cursor-pointer'
                    }`}
                  />
                );
              })}
            </div>

            <span className="text-[10px] font-mono font-bold text-cyan-400">
              RODADA {currentRound} / 5
            </span>
          </div>
        </div>

        {/* Feedback de Status */}
        {phase === 'COMPLETE' ? (
          <div className="w-full py-2 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>REATOR INICIALIZADO COM SUCESSO!</span>
          </div>
        ) : phase === 'ERROR' ? (
          <div className="w-full py-2 bg-red-950 text-red-300 font-bold text-xs font-mono rounded-xl text-center border border-red-500/60 animate-shake">
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
            SEQUÊNCIA INCORRETA! REPETINDO RODADA...
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-400">
            {phase === 'DEMO' ? 'Aguarde a demonstração...' : `Sua vez: ${playerInputIndex + 1} de ${currentRound}`}
          </div>
        )}
      </div>
    </div>
  );
};
