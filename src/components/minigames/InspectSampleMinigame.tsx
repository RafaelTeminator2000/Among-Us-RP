'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle2, AlertTriangle, FlaskConical, Play, Clock, Sparkles } from 'lucide-react';

interface InspectSampleMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
  roomId?: string;
  playerId?: string;
}

const TOTAL_INSPECTION_TIME_SECONDS = 60; // 60 segundos exatos oficiais do Among Us

export const InspectSampleMinigame: React.FC<InspectSampleMinigameProps> = ({
  onComplete,
  onCancel,
  roomId = 'default',
  playerId = 'p-self',
}) => {
  const storageKey = `inspect_sample_start_${roomId}_${playerId}`;
  const anomalyKey = `inspect_sample_anomaly_${roomId}_${playerId}`;

  const [phase, setPhase] = useState<'IDLE' | 'INCUBATING' | 'READY' | 'COMPLETED'>('IDLE');
  const [secondsLeft, setSecondsLeft] = useState<number>(TOTAL_INSPECTION_TIME_SECONDS);
  const [anomalyIndex, setAnomalyIndex] = useState<number>(2); // 0 a 4
  const [selectedVial, setSelectedVial] = useState<number | null>(null);
  const [errorVial, setErrorVial] = useState<number | null>(null);
  const [bubbles, setBubbles] = useState<Array<{ id: number; vial: number; y: number; x: number }>>([]);

  const isCompletedRef = useRef(false);

  // Síntese de áudio via Web Audio API
  const playSound = useCallback((type: 'start' | 'bubble' | 'ready' | 'error' | 'success') => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'start') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'bubble') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400 + Math.random() * 200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800 + Math.random() * 300, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'ready') {
        // Ding duplo de conclusão da centrifugação
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
          gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.12);
          osc.stop(ctx.currentTime + i * 0.12 + 0.3);
        });
      } else if (type === 'error') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'success') {
        [587.33, 739.99, 880, 1174.66].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
          gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.1);
          osc.stop(ctx.currentTime + i * 0.1 + 0.4);
        });
      }
    } catch {}
  }, []);

  // Verificar estado persistido no localStorage ao carregar
  useEffect(() => {
    try {
      const storedStartTime = localStorage.getItem(storageKey);
      const storedAnomaly = localStorage.getItem(anomalyKey);

      let targetAnomaly = storedAnomaly ? parseInt(storedAnomaly, 10) : Math.floor(Math.random() * 5);
      if (isNaN(targetAnomaly) || targetAnomaly < 0 || targetAnomaly > 4) {
        targetAnomaly = Math.floor(Math.random() * 5);
      }
      setAnomalyIndex(targetAnomaly);

      if (storedStartTime) {
        const startTime = parseInt(storedStartTime, 10);
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

        if (elapsedSeconds >= TOTAL_INSPECTION_TIME_SECONDS) {
          setPhase('READY');
          setSecondsLeft(0);
          playSound('ready');
        } else {
          setPhase('INCUBATING');
          setSecondsLeft(Math.max(0, TOTAL_INSPECTION_TIME_SECONDS - elapsedSeconds));
        }
      } else {
        setPhase('IDLE');
      }
    } catch {
      setPhase('IDLE');
    }
  }, [storageKey, anomalyKey, playSound]);

  // Contagem regressiva em tempo real durante a incubação
  useEffect(() => {
    if (phase !== 'INCUBATING') return;

    const interval = setInterval(() => {
      try {
        const storedStartTime = localStorage.getItem(storageKey);
        if (!storedStartTime) return;

        const startTime = parseInt(storedStartTime, 10);
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const remaining = TOTAL_INSPECTION_TIME_SECONDS - elapsedSeconds;

        if (remaining <= 0) {
          setPhase('READY');
          setSecondsLeft(0);
          playSound('ready');
          clearInterval(interval);
          if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 200]);
          }
        } else {
          setSecondsLeft(remaining);
        }
      } catch {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setPhase('READY');
            playSound('ready');
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, storageKey, playSound]);

  // Animação de borbulhas durante a incubação
  useEffect(() => {
    if (phase !== 'INCUBATING') {
      setBubbles([]);
      return;
    }

    const bubbleInterval = setInterval(() => {
      setBubbles((prev) => {
        const newBubble = {
          id: Math.random(),
          vial: Math.floor(Math.random() * 5),
          x: 20 + Math.random() * 60,
          y: 85,
        };
        const updated = prev
          .map((b) => ({ ...b, y: b.y - 12 }))
          .filter((b) => b.y > 10);
        return [...updated, newBubble].slice(-15);
      });
      if (Math.random() > 0.6) {
        playSound('bubble');
      }
    }, 350);

    return () => clearInterval(bubbleInterval);
  }, [phase, playSound]);

  // Iniciar a Análise de 60s
  const handleStartInspection = () => {
    const randomAnomaly = Math.floor(Math.random() * 5);
    const now = Date.now();

    try {
      localStorage.setItem(storageKey, now.toString());
      localStorage.setItem(anomalyKey, randomAnomaly.toString());
    } catch {}

    setAnomalyIndex(randomAnomaly);
    setPhase('INCUBATING');
    setSecondsLeft(TOTAL_INSPECTION_TIME_SECONDS);
    playSound('start');

    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  // Seleção do Frasco
  const handleSelectVial = (index: number) => {
    if (phase !== 'READY' || isCompletedRef.current) return;

    if (index === anomalyIndex) {
      // Correto: amostra anômala selecionada
      setSelectedVial(index);
      setErrorVial(null);
      isCompletedRef.current = true;
      setPhase('COMPLETED');
      playSound('success');

      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(anomalyKey);
      } catch {}

      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([80, 50, 80, 50, 250]);
      }

      setTimeout(() => {
        onComplete();
      }, 1000);
    } else {
      // Erro: frasco normal selecionado
      setErrorVial(index);
      playSound('error');

      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([150, 80, 150]);
      }

      setTimeout(() => {
        setErrorVial(null);
      }, 700);
    }
  };

  const progressPercent =
    phase === 'READY' || phase === 'COMPLETED'
      ? 100
      : phase === 'INCUBATING'
      ? Math.floor(((TOTAL_INSPECTION_TIME_SECONDS - secondsLeft) / TOTAL_INSPECTION_TIME_SECONDS) * 100)
      : 0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console da Enfermaria (MedBay) */}
      <div className="w-full max-w-md bg-slate-900 border-4 border-slate-700 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden flex flex-col items-center gap-3.5">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 left-3 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-950 border border-slate-800 transition-colors z-20 cursor-pointer shadow active:scale-95"
          title="Fechar Minigame"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Título do Terminal */}
        <div className="text-center pt-1 pb-0 pl-10 pr-2 w-full">
          <h2
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
            className="text-xl uppercase tracking-wider text-slate-100 flex items-center justify-center gap-2"
          >
            <FlaskConical className="w-5 h-5 text-cyan-400" />
            <span>ENVIAR / ANALISAR AMOSTRA</span>
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-400">
            {phase === 'IDLE' && 'Pressione o botão para iniciar o processo de incubação'}
            {phase === 'INCUBATING' && 'Incubando amostras celulares (60s). Você pode fechar e voltar depois!'}
            {phase === 'READY' && 'Análise concluída! Selecione a amostra anômala (vermelha)'}
            {phase === 'COMPLETED' && 'Amostra anômala identificada e descartada!'}
          </p>
        </div>

        {/* Display do Timer & Status */}
        <div className="w-full bg-[#020617] p-3 rounded-2xl border-2 border-slate-800 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${phase === 'INCUBATING' ? 'text-amber-400 animate-spin' : phase === 'READY' ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="text-xs font-mono font-bold text-slate-300">
              {phase === 'IDLE' && 'STATUS: EM ESPERA'}
              {phase === 'INCUBATING' && 'STATUS: INCUBANDO...'}
              {phase === 'READY' && 'STATUS: SELEÇÃO REQUERIDA'}
              {phase === 'COMPLETED' && 'STATUS: CONCLUÍDO'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">ETA:</span>
            <span className={`text-base font-mono font-black px-2.5 py-0.5 rounded-lg border ${
              phase === 'INCUBATING'
                ? 'bg-amber-950/80 text-amber-300 border-amber-600 animate-pulse'
                : phase === 'READY'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}>
              {formatTime(secondsLeft)}
            </span>
          </div>
        </div>

        {/* Barra de Progresso da Incubação */}
        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              phase === 'READY' || phase === 'COMPLETED'
                ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]'
                : 'bg-gradient-to-r from-cyan-500 to-amber-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Câmara dos 5 Tubos de Ensaio */}
        <div className="w-full bg-[#030712] p-4 rounded-2xl border-2 border-slate-800 shadow-2xl flex items-end justify-around gap-2 relative min-h-[170px] overflow-hidden">
          {/* Grade de fundo da câmara */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:16px_16px] opacity-20 pointer-events-none" />

          {/* 5 Tubos de Ensaio */}
          {Array.from({ length: 5 }).map((_, index) => {
            const isAnomaly = index === anomalyIndex;
            const isReady = phase === 'READY';
            const isFinished = phase === 'COMPLETED';
            const isSelected = selectedVial === index;
            const isErr = errorVial === index;

            let fluidColor = 'bg-cyan-500/30';
            let fluidGlow = '';
            let fluidHeight = '0%';

            if (phase === 'IDLE') {
              fluidHeight = '0%';
            } else if (phase === 'INCUBATING') {
              fluidHeight = `${Math.min(80, 20 + progressPercent * 0.6)}%`;
              fluidColor = 'bg-cyan-400/70';
              fluidGlow = 'shadow-[0_0_12px_rgba(6,182,212,0.5)]';
            } else if (isReady || isFinished) {
              fluidHeight = '80%';
              if (isAnomaly) {
                fluidColor = 'bg-gradient-to-t from-red-600 to-rose-400';
                fluidGlow = 'shadow-[0_0_20px_#ef4444] animate-pulse';
              } else {
                fluidColor = 'bg-gradient-to-t from-blue-600 to-cyan-400';
                fluidGlow = 'shadow-[0_0_8px_rgba(59,130,246,0.5)]';
              }
            }

            return (
              <div key={index} className="flex flex-col items-center gap-2 z-10">
                {/* Tubo de Vidro Físico */}
                <div
                  className={`relative w-12 h-32 rounded-b-2xl border-2 border-t-0 p-1 flex flex-col justify-end overflow-hidden transition-all ${
                    isErr
                      ? 'border-red-500 bg-red-950/30 animate-shake'
                      : isSelected
                      ? 'border-emerald-400 bg-emerald-950/30'
                      : isReady && isAnomaly
                      ? 'border-red-500/80 bg-red-950/20'
                      : 'border-slate-600 bg-slate-900/40'
                  }`}
                >
                  {/* Tampa / Bocal do Tubo */}
                  <div className="absolute top-0 inset-x-0 h-2 bg-slate-700 border-b border-slate-600 rounded-t" />

                  {/* Reflexo de Vidro (Sheen) */}
                  <div className="absolute top-2 left-1.5 w-1 h-24 bg-white/15 rounded-full z-20 pointer-events-none" />

                  {/* Fluido Químico */}
                  <div
                    style={{ height: fluidHeight }}
                    className={`w-full rounded-b-xl transition-all duration-500 relative ${fluidColor} ${fluidGlow}`}
                  >
                    {/* Menisco / Superfície do líquido */}
                    {fluidHeight !== '0%' && (
                      <div className="absolute -top-1 inset-x-0 h-1.5 bg-white/40 rounded-full blur-[0.5px]" />
                    )}

                    {/* Borbulhas na incubação */}
                    {phase === 'INCUBATING' &&
                      bubbles
                        .filter((b) => b.vial === index)
                        .map((b) => (
                          <div
                            key={b.id}
                            style={{
                              left: `${b.x}%`,
                              top: `${b.y}%`,
                            }}
                            className="absolute w-1.5 h-1.5 bg-white/80 rounded-full shadow-[0_0_4px_white] pointer-events-none animate-ping"
                          />
                        ))}
                  </div>

                  {/* Marcadores de Mililitros */}
                  <div className="absolute right-1 top-6 bottom-4 flex flex-col justify-between opacity-30 pointer-events-none">
                    <div className="w-1.5 h-0.5 bg-white" />
                    <div className="w-1 h-0.5 bg-white" />
                    <div className="w-1.5 h-0.5 bg-white" />
                    <div className="w-1 h-0.5 bg-white" />
                    <div className="w-1.5 h-0.5 bg-white" />
                  </div>
                </div>

                {/* Número do Tubo */}
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  0{index + 1}
                </span>

                {/* Botão de Seleção Individual (Ativo quando pronto) */}
                <button
                  type="button"
                  disabled={phase !== 'READY' || isFinished}
                  onClick={() => handleSelectVial(index)}
                  className={`w-9 h-9 rounded-xl border-2 font-mono text-xs font-black flex items-center justify-center transition-all shadow-md ${
                    phase === 'READY'
                      ? isAnomaly
                        ? 'bg-red-600 hover:bg-red-500 text-white border-red-300 shadow-[0_0_15px_#ef4444] cursor-pointer animate-bounce'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600 cursor-pointer active:scale-95'
                      : 'bg-slate-950 text-slate-600 border-slate-800 opacity-40 cursor-not-allowed'
                  }`}
                  title={phase === 'READY' ? `Selecionar Amostra 0${index + 1}` : 'Aguarde a análise'}
                >
                  {isFinished && isAnomaly ? '✓' : '▲'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Ação Inferior: Botão de Iniciar ou Feedback de Sucesso */}
        {phase === 'IDLE' && (
          <button
            type="button"
            onClick={handleStartInspection}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>INICIAR ANÁLISE DE AMOSTRAS (60s)</span>
          </button>
        )}

        {phase === 'INCUBATING' && (
          <div className="w-full p-3 bg-amber-950/40 border border-amber-500/40 rounded-2xl text-center space-y-1">
            <p className="text-xs font-mono font-bold text-amber-300 flex items-center justify-center gap-1.5">
              <Clock className="w-4 h-4 animate-spin" />
              <span>Incubando amostras... Tempo restante: {formatTime(secondsLeft)}</span>
            </p>
            <p className="text-[10px] text-slate-400">
              💡 Você pode fechar este painel para fazer outras tarefas e retornar em 60 segundos!
            </p>
          </div>
        )}

        {phase === 'READY' && (
          <div className="w-full p-2.5 bg-cyan-950/60 border border-cyan-500/50 rounded-2xl text-center">
            <span className="text-xs font-mono font-bold text-cyan-300 flex items-center justify-center gap-1.5 animate-pulse">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Pressione o botão vermelho abaixo do tubo anômalo!</span>
            </span>
          </div>
        )}

        {phase === 'COMPLETED' && (
          <div className="w-full py-2.5 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-2xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>AMOSTRA ANÔMALA IDENTIFICADA E DESCARTADA COM SUCESSO!</span>
          </div>
        )}
      </div>
    </div>
  );
};
