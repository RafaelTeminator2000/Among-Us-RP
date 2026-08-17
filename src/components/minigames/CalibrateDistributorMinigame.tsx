'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle2, Zap } from 'lucide-react';

interface CalibrateDistributorMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface RingConfig {
  id: number;
  name: string;
  colorHex: string;
  lightHex: string;
  speed: number; // Graus por segundo
}

const RINGS: RingConfig[] = [
  { id: 0, name: 'CANAL SUPERIOR', colorHex: '#eab308', lightHex: '#fef08a', speed: 95 },
  { id: 1, name: 'CANAL CENTRAL', colorHex: '#3b82f6', lightHex: '#93c5fd', speed: 130 },
  { id: 2, name: 'CANAL INFERIOR', colorHex: '#06b6d4', lightHex: '#a5f3fc', speed: 175 },
];

export const CalibrateDistributorMinigame: React.FC<CalibrateDistributorMinigameProps> = ({
  onComplete,
  onCancel,
}) => {
  // Ângulo atual de cada anel (em graus: 0 a 360)
  const [angles, setAngles] = useState<number[]>([0, 90, 180]);
  // Anéis travados com sucesso
  const [lockedRings, setLockedRings] = useState<boolean[]>([false, false, false]);
  const [currentStage, setCurrentStage] = useState<number>(0); // 0, 1 ou 2
  const [hasError, setHasError] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const anglesRef = useRef<number[]>([0, 90, 180]);
  const lockedRef = useRef<boolean[]>([false, false, false]);
  const currentStageRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    lockedRef.current = lockedRings;
    currentStageRef.current = currentStage;
  }, [lockedRings, currentStage]);

  // Síntese de áudio WebAudio
  const playBeep = useCallback((freq: number, type: OscillatorType = 'sine', duration = 0.12) => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
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

  // Loop de rotação contínua dos discos
  useEffect(() => {
    const loop = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      const newAngles = anglesRef.current.map((ang, idx) => {
        if (lockedRef.current[idx]) {
          return 0; // Travado na posição de contato à direita (0 graus / 3 horas)
        }
        const speed = RINGS[idx].speed;
        return (ang + speed * delta) % 360;
      });

      anglesRef.current = newAngles;
      setAngles([...newAngles]);

      if (!isCompleted) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isCompleted]);

  // Pressionar o botão de timing do anel correspondente
  const handlePressButton = (ringIndex: number) => {
    if (isCompleted || hasError) return;
    if (ringIndex !== currentStage) return; // Só pode calibrar o anel da etapa atual

    const currentAngle = anglesRef.current[ringIndex];
    // A posição do conector fica à direita (0° / 360°).
    // Tolerância: entre 342° e 360° ou entre 0° e 18° (janela de ~36 graus)
    const isAligned = currentAngle >= 342 || currentAngle <= 18;

    if (isAligned) {
      // ACERTO!
      playBeep(520 + ringIndex * 150, 'triangle', 0.15);
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate(30);
      }

      const nextLocked = [...lockedRings];
      nextLocked[ringIndex] = true;
      setLockedRings(nextLocked);
      lockedRef.current = nextLocked;

      if (ringIndex === 2) {
        // Todos os 3 anéis calibrados!
        setIsCompleted(true);
        playBeep(880, 'sine', 0.3);
        if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
          navigator.vibrate([40, 60, 40, 60, 120]);
        }
        setTimeout(() => {
          onComplete();
        }, 700);
      } else {
        setCurrentStage(ringIndex + 1);
      }
    } else {
      // ERRO DE TIMING: desarmar circuito e reiniciar
      playBeep(180, 'sawtooth', 0.3);
      setHasError(true);
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }

      setTimeout(() => {
        setLockedRings([false, false, false]);
        lockedRef.current = [false, false, false];
        setCurrentStage(0);
        setHasError(false);
      }, 400);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console Metálico do Distribuidor */}
      <div className="w-full max-w-sm bg-slate-800 border-4 border-slate-600 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col items-center">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 left-3 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-900 border border-slate-700 transition-colors z-20 cursor-pointer shadow active:scale-95"
          title="Fechar Minigame"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Título do Painel */}
        <div className="text-center pt-1 pb-3 pl-10 pr-2 w-full">
          <h2
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
            className="text-xl uppercase tracking-wider text-slate-100 flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
            <span>CALIBRAR DISTRIBUIDOR</span>
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-400">
            Aperte o botão quando o nó atingir o conector à direita
          </p>
        </div>

        {/* Display Central: 3 Discos Giratórios e Botões de Trava */}
        <div
          className={`w-full bg-slate-950 p-4 rounded-2xl border-2 transition-all space-y-4 shadow-inner ${
            hasError
              ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.4)] animate-shake'
              : 'border-slate-800'
          }`}
        >
          {RINGS.map((ring, idx) => {
            const isLocked = lockedRings[idx];
            const isActive = currentStage === idx;
            const currentAngle = angles[idx];

            // Coordenadas do nó giratório no círculo SVG (raio 30, centro 40,40)
            const rad = (currentAngle * Math.PI) / 180;
            const nodeX = 40 + 26 * Math.cos(rad);
            const nodeY = 40 + 26 * Math.sin(rad);

            return (
              <div key={ring.id} className="flex items-center justify-between gap-3">
                {/* Disco Giratório com Nó Conector */}
                <div className="relative w-20 h-20 bg-slate-900 rounded-full border-2 border-slate-700 shadow-inner flex items-center justify-center">
                  <svg viewBox="0 0 80 80" className="w-full h-full">
                    {/* Trilha do Anel */}
                    <circle
                      cx="40"
                      cy="40"
                      r="26"
                      fill="none"
                      stroke="#334155"
                      strokeWidth="6"
                    />

                    {/* Conector Fixo à Direita (0° / 3 horas) */}
                    <rect
                      x="66"
                      y="37"
                      width="10"
                      height="6"
                      rx="2"
                      fill={isLocked ? '#10b981' : '#64748b'}
                      className="transition-colors duration-200"
                    />

                    {/* Nó Giratório */}
                    <circle
                      cx={isLocked ? '66' : nodeX}
                      cy={isLocked ? '40' : nodeY}
                      r="5"
                      fill={ring.colorHex}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      style={{
                        filter: isLocked
                          ? 'drop-shadow(0 0 8px #10b981)'
                          : `drop-shadow(0 0 6px ${ring.colorHex})`,
                      }}
                    />

                    {/* Núcleo Central */}
                    <circle cx="40" cy="40" r="8" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
                  </svg>
                </div>

                {/* Linha de Condução Elétrica */}
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full relative overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isLocked
                        ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]'
                        : isActive
                        ? 'bg-amber-400/40 animate-pulse'
                        : 'bg-transparent'
                    }`}
                  />
                </div>

                {/* Botão de Trava de Timing + LED Indicador */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isLocked || isCompleted || !isActive}
                    onClick={() => handlePressButton(idx)}
                    className={`w-14 h-14 rounded-xl border-2 border-b-4 font-mono font-black text-sm uppercase flex items-center justify-center transition-all cursor-pointer select-none shadow-md ${
                      isLocked
                        ? 'bg-emerald-950 border-emerald-500 border-b-emerald-700 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                        : isActive
                        ? 'bg-slate-200 hover:bg-white text-slate-900 border-slate-400 border-b-slate-600 active:translate-y-1 active:border-b-2'
                        : 'bg-slate-900 border-slate-800 border-b-slate-950 text-slate-600 opacity-50 cursor-not-allowed'
                    }`}
                    style={{
                      backgroundColor: isLocked ? undefined : isActive ? ring.colorHex : undefined,
                      color: isActive ? '#0f172a' : undefined,
                    }}
                  >
                    {isLocked ? '✓' : idx + 1}
                  </button>

                  {/* LED Indicador */}
                  <div
                    className={`w-4 h-4 rounded-full border-2 border-slate-900 transition-all duration-300 ${
                      isLocked
                        ? 'bg-emerald-400 shadow-[0_0_12px_#10b981]'
                        : 'bg-slate-900 shadow-none'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Feedback de Conclusão / Erro */}
        {isCompleted ? (
          <div className="w-full mt-4 py-2.5 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>DISTRIBUIDOR CALIBRADO COM SUCESSO!</span>
          </div>
        ) : hasError ? (
          <div className="w-full mt-4 py-2 bg-red-950 text-red-300 font-bold text-xs font-mono rounded-xl text-center border border-red-500/60 animate-shake">
            ⚠️ TIMING INCORRETO! REINICIANDO ESTÁGIOS...
          </div>
        ) : (
          <div className="mt-3 text-[11px] font-mono text-slate-400 font-bold">
            Etapa Atual: <span className="text-cyan-400">{currentStage + 1} / 3</span>
          </div>
        )}
      </div>
    </div>
  );
};
