'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle2, Wind } from 'lucide-react';

interface CleanO2FilterMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface LeafEntity {
  id: number;
  x: number; // Porcentagem X (25-90)
  y: number; // Porcentagem Y (10-90)
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  size: number;
  width: number;
  height: number;
  type: 1 | 2 | 3;
}

// 12 Folhas com posições iniciais bem distribuídas pela câmara
const INITIAL_LEAVES_CONFIG: LeafEntity[] = [
  { id: 1, x: 35, y: 18, vx: 0.09, vy: 0.06, rotation: -20, rotSpeed: 0.3, size: 52, width: 26, height: 52, type: 1 },
  { id: 2, x: 78, y: 20, vx: -0.08, vy: 0.11, rotation: 35, rotSpeed: -0.25, size: 50, width: 25, height: 50, type: 2 },
  { id: 3, x: 55, y: 32, vx: 0.07, vy: -0.09, rotation: 50, rotSpeed: 0.2, size: 54, width: 27, height: 54, type: 3 },
  { id: 4, x: 84, y: 42, vx: -0.11, vy: -0.06, rotation: -30, rotSpeed: -0.35, size: 48, width: 24, height: 48, type: 1 },
  { id: 5, x: 38, y: 50, vx: 0.08, vy: 0.10, rotation: 15, rotSpeed: 0.3, size: 52, width: 26, height: 52, type: 2 },
  { id: 6, x: 65, y: 58, vx: -0.09, vy: 0.07, rotation: -15, rotSpeed: -0.2, size: 56, width: 28, height: 56, type: 3 },
  { id: 7, x: 32, y: 72, vx: 0.08, vy: -0.10, rotation: 40, rotSpeed: 0.35, size: 50, width: 25, height: 50, type: 1 },
  { id: 8, x: 55, y: 80, vx: -0.06, vy: -0.08, rotation: -45, rotSpeed: -0.25, size: 48, width: 24, height: 48, type: 2 },
  { id: 9, x: 82, y: 75, vx: -0.09, vy: 0.05, rotation: 25, rotSpeed: 0.3, size: 54, width: 27, height: 54, type: 3 },
  { id: 10, x: 60, y: 15, vx: 0.07, vy: 0.10, rotation: -10, rotSpeed: -0.3, size: 50, width: 25, height: 50, type: 1 },
  { id: 11, x: 44, y: 64, vx: -0.08, vy: 0.09, rotation: 30, rotSpeed: 0.25, size: 52, width: 26, height: 52, type: 2 },
  { id: 12, x: 74, y: 88, vx: 0.09, vy: -0.07, rotation: -25, rotSpeed: -0.3, size: 50, width: 25, height: 50, type: 3 },
];

export const CleanO2FilterMinigame: React.FC<CleanO2FilterMinigameProps> = ({
  onComplete,
  onCancel,
}) => {
  const [leaves, setLeaves] = useState<LeafEntity[]>(INITIAL_LEAVES_CONFIG);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [isGusting, setIsGusting] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const leavesRef = useRef<LeafEntity[]>(INITIAL_LEAVES_CONFIG);
  const activeDragIdRef = useRef<number | null>(null);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });
  const animFrameRef = useRef<number | null>(null);
  const isCompletedRef = useRef<boolean>(false);
  const lastGustTimeRef = useRef<number>(0);
  const nextGustIntervalRef = useRef<number>(2800 + Math.random() * 2000);

  useEffect(() => {
    activeDragIdRef.current = activeDragId;
  }, [activeDragId]);

  // Síntese de áudio de sucção de folha (swoosh)
  const playSwoosh = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {}
  }, []);

  // Síntese de áudio da Rajada de Vento / Sopro
  const playWindGustSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(260, ctx.currentTime + 0.25);
      osc.frequency.exponentialRampToValueAtTime(75, ctx.currentTime + 0.65);
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    } catch {}
  }, []);

  const playSuccessChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  }, []);

  // Loop de Turbulência, Repulsão Mútua (Anti-Amontoamento) e Rajadas Aleatórias de Vento
  useEffect(() => {
    const loop = (timestamp: number) => {
      if (isCompletedRef.current) return;

      const currentDragId = activeDragIdRef.current;
      let isTriggeringGustNow = false;

      // Disparar rajada de vento aleatória (a cada 2.8 a 4.8 segundos)
      if (timestamp - lastGustTimeRef.current > nextGustIntervalRef.current) {
        lastGustTimeRef.current = timestamp;
        nextGustIntervalRef.current = 2800 + Math.random() * 2000;
        isTriggeringGustNow = true;

        setIsGusting(true);
        setTimeout(() => setIsGusting(false), 750);

        playWindGustSound();

        if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
          navigator.vibrate(30);
        }
      }

      setLeaves((prev) => {
        // 1. Aplicar forças de repulsão mútua entre folhas próximas para garantir dispersão uniforme (Anti-Amontoamento)
        const count = prev.length;
        const repulsionForces = prev.map(() => ({ fx: 0, fy: 0 }));

        for (let i = 0; i < count; i++) {
          for (let j = i + 1; j < count; j++) {
            const dx = prev[j].x - prev[i].x;
            const dy = prev[j].y - prev[i].y;
            const dist = Math.hypot(dx, dy);
            const minDist = 14; // Distância mínima desejada (%)

            if (dist < minDist && dist > 0.01) {
              const overlap = (minDist - dist) / minDist;
              const force = overlap * 0.08;
              const nx = dx / dist;
              const ny = dy / dist;

              repulsionForces[i].fx -= nx * force;
              repulsionForces[i].fy -= ny * force;
              repulsionForces[j].fx += nx * force;
              repulsionForces[j].fy += ny * force;
            }
          }
        }

        // 2. Atualizar posição e física individual de cada folha
        const updated = prev.map((leaf, idx) => {
          if (leaf.id === currentDragId) {
            return leaf;
          }

          let nvx = leaf.vx + repulsionForces[idx].fx;
          let nvy = leaf.vy + repulsionForces[idx].fy;

          // Se uma rajada de vento acabou de disparar, dar um impulso caótico 100% individual
          if (isTriggeringGustNow) {
            const randAngle = Math.random() * Math.PI * 2;
            const randSpeed = 1.2 + Math.random() * 1.6;
            nvx += Math.cos(randAngle) * randSpeed;
            nvy += Math.sin(randAngle) * randSpeed;
            leaf.rotSpeed = (Math.random() - 0.5) * 3.5;
          }

          // Fricção natural do ar para suavizar a movimentação
          nvx = nvx * 0.98;
          nvy = nvy * 0.98;

          let nx = leaf.x + nvx;
          let ny = leaf.y + nvy;
          let nRot = leaf.rotation + leaf.rotSpeed;

          // Ricochete suave nos limites da câmara de ar
          if (nx <= 25) {
            nx = 25;
            nvx = Math.abs(nvx) * (0.8 + Math.random() * 0.4);
          } else if (nx >= 92) {
            nx = 92;
            nvx = -Math.abs(nvx) * (0.8 + Math.random() * 0.4);
          }

          if (ny <= 8) {
            ny = 8;
            nvy = Math.abs(nvy) * (0.8 + Math.random() * 0.4);
          } else if (ny >= 90) {
            ny = 90;
            nvy = -Math.abs(nvy) * (0.8 + Math.random() * 0.4);
          }

          return {
            ...leaf,
            x: nx,
            y: ny,
            vx: nvx,
            vy: nvy,
            rotation: nRot,
          };
        });

        leavesRef.current = updated;
        return updated;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [playWindGustSound]);

  // Capturar Folha para Arrastar (Pointer Down)
  const handlePointerDownLeaf = (leaf: LeafEntity, e: React.PointerEvent) => {
    if (isCompletedRef.current || !containerRef.current) return;
    e.stopPropagation();

    const rect = containerRef.current.getBoundingClientRect();
    const clickXPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const clickYPercent = ((e.clientY - rect.top) / rect.height) * 100;

    dragOffsetRef.current = {
      offsetX: clickXPercent - leaf.x,
      offsetY: clickYPercent - leaf.y,
    };

    setActiveDragId(leaf.id);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(15);
    }
  };

  // Movimento de Arraste da Folha (Pointer Move)
  const handlePointerMoveLeaf = (e: React.PointerEvent) => {
    const currentDragId = activeDragIdRef.current;
    if (currentDragId === null || !containerRef.current || isCompletedRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const curXPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const curYPercent = ((e.clientY - rect.top) / rect.height) * 100;

    const newX = curXPercent - dragOffsetRef.current.offsetX;
    const newY = curYPercent - dragOffsetRef.current.offsetY;

    // Se arrastou a folha para dentro da fenda de sucção à esquerda (X <= 22%)
    if (newX <= 22) {
      playSwoosh();
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([20, 50]);
      }

      setLeaves((prev) => {
        const remaining = prev.filter((l) => l.id !== currentDragId);
        leavesRef.current = remaining;

        if (remaining.length === 0 && !isCompletedRef.current) {
          isCompletedRef.current = true;
          setIsCompleted(true);
          playSuccessChime();
          if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
            navigator.vibrate([40, 80, 40, 80, 150]);
          }
          setTimeout(() => onComplete(), 800);
        }

        return remaining;
      });

      setActiveDragId(null);
      return;
    }

    // Atualiza a posição da folha sendo arrastada
    setLeaves((prev) =>
      prev.map((l) => {
        if (l.id === currentDragId) {
          return {
            ...l,
            x: Math.max(5, Math.min(95, newX)),
            y: Math.max(5, Math.min(95, newY)),
          };
        }
        return l;
      })
    );
  };

  const handlePointerUpLeaf = (e: React.PointerEvent) => {
    if (activeDragIdRef.current !== null) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setActiveDragId(null);
    }
  };

  // Renderização Vetorial da Folha Seca do Among Us (SVG)
  const renderLeafSVG = (type: number) => {
    return (
      <svg
        viewBox="0 0 40 80"
        className="w-full h-full drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)] select-none pointer-events-none"
      >
        {/* Haste e Contorno Preto Grosso */}
        <path
          d="M 20,78 Q 20,40 18,2 Q 35,25 32,55 Q 26,72 20,78 Z"
          fill="#d97706"
          stroke="#1c1917"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* Metade Esquerda da Folha (Ocre / Dourado) */}
        <path
          d="M 20,78 Q 20,40 18,2 Q 4,28 6,55 Q 12,70 20,78 Z"
          fill="#b45309"
          stroke="#1c1917"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* Veios Centrais e Laterais Pretos/Castanhos */}
        <path d="M 19,76 Q 19,40 18,4" stroke="#451a03" strokeWidth="2.5" fill="none" />
        <path d="M 19,60 Q 27,52 30,55" stroke="#451a03" strokeWidth="2" fill="none" />
        <path d="M 19,45 Q 28,38 31,40" stroke="#451a03" strokeWidth="2" fill="none" />
        <path d="M 19,30 Q 26,22 28,24" stroke="#451a03" strokeWidth="2" fill="none" />
        <path d="M 19,55 Q 11,48 8,50" stroke="#451a03" strokeWidth="2" fill="none" />
        <path d="M 19,40 Q 10,32 7,35" stroke="#451a03" strokeWidth="2" fill="none" />
        <path d="M 19,25 Q 12,18 10,20" stroke="#451a03" strokeWidth="2" fill="none" />

        {/* Mancha de Envelhecimento Verde-Oliva / Castanho */}
        {type === 2 && (
          <ellipse cx="14" cy="50" rx="4" ry="8" fill="#4d7c0f" opacity="0.8" />
        )}
        {type === 3 && (
          <ellipse cx="24" cy="35" rx="4" ry="7" fill="#78350f" opacity="0.8" />
        )}
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console do Filtro de O2 (Among Us Autêntico) */}
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
          <h2
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
            className="text-xl uppercase tracking-wider text-slate-100 flex items-center justify-center gap-2"
          >
            <Wind className="w-5 h-5 text-cyan-400" />
            <span>LIMPAR FILTRO DE O2</span>
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-400">
            Arraste as folhas flutuantes para a fenda de sucção à esquerda
          </p>
        </div>

        {/* Câmara Principal do Filtro (Painel Metálico com Fenda + Câmara Azul Celeste) */}
        <div
          ref={containerRef}
          className="relative w-full h-80 bg-slate-900 rounded-2xl border-4 border-slate-700 overflow-hidden shadow-2xl flex touch-none select-none"
        >
          {/* COLUNA ESQUERDA: DUTO METÁLICO COM FENDA E SETAS DE SUCÇÃO */}
          <div className="w-[22%] h-full bg-gradient-to-r from-[#6b7280] via-[#9ca3af] to-[#4b5563] border-r-4 border-slate-900 relative flex items-center justify-center shadow-2xl z-20">
            {/* Fenda Preta Vertical de Sucção */}
            <div className="w-5 sm:w-6 h-56 bg-slate-950 rounded-sm border-2 border-slate-800 shadow-[inset_0_0_12px_#000000] relative flex items-center justify-center overflow-hidden">
              {/* Linhas de Sucção do Vácuo no Interior da Fenda */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent animate-pulse" />
            </div>

            {/* Setas Triangulares de Fluxo de Ar (Amarelo, Laranja, Vermelho) */}
            <div className="absolute inset-y-0 left-1 right-1 flex items-center justify-between pointer-events-none">
              {/* Seta Esquerda apontando para a fenda */}
              <div className="flex items-center">
                <div className="w-0 h-0 border-y-[9px] border-y-transparent border-l-[12px] border-l-yellow-400 drop-shadow" />
                <div className="-ml-1.5 w-0 h-0 border-y-[7px] border-y-transparent border-l-[9px] border-l-orange-500" />
                <div className="-ml-1.5 w-0 h-0 border-y-[5px] border-y-transparent border-l-[6px] border-l-red-600" />
              </div>

              {/* Seta Direita apontando para a fenda */}
              <div className="flex items-center rotate-180">
                <div className="w-0 h-0 border-y-[9px] border-y-transparent border-l-[12px] border-l-yellow-400 drop-shadow" />
                <div className="-ml-1.5 w-0 h-0 border-y-[7px] border-y-transparent border-l-[9px] border-l-orange-500" />
                <div className="-ml-1.5 w-0 h-0 border-y-[5px] border-y-transparent border-l-[6px] border-l-red-600" />
              </div>
            </div>
          </div>

          {/* CÂMARA DIREITA: AZUL CELESTE METÁLICO COM FOLHAS EM FLUXO */}
          <div className="flex-1 h-full bg-gradient-to-r from-[#93b5e1] via-[#b8d4f7] to-[#8eb0dc] relative overflow-hidden flex items-center justify-center">
            {/* Brilho e Reflexo de Luz Vertical do Filtro */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/10 pointer-events-none" />

            {/* Símbolo Translúcido de Vento / Sopro (Quando ocorre a rajada) */}
            {isGusting && (
              <div className="absolute inset-0 pointer-events-none z-15 flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
                <svg
                  viewBox="0 0 100 80"
                  className="w-44 h-36 text-cyan-400 opacity-45 drop-shadow-[0_0_15px_#38bdf8] transition-opacity animate-pulse"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {/* Linha Superior com Espiral para Cima */}
                  <path d="M 15,35 H 52 A 12,12 0 1,0 42,22" />
                  {/* Linha Central Longa com Espiral Ampla */}
                  <path d="M 8,48 H 70 A 14,14 0 1,0 68,30" />
                  {/* Linha Inferior com Espiral para Baixo */}
                  <path d="M 15,60 H 60 A 12,12 0 1,1 52,72" />
                </svg>
              </div>
            )}

            {/* Folhas Secas Flutuantes (10 Folhas com Repulsão e Dispersão Dinâmica) */}
            {leaves.map((leaf) => {
              const isDraggingThis = activeDragId === leaf.id;

              return (
                <div
                  key={leaf.id}
                  onPointerDown={(e) => handlePointerDownLeaf(leaf, e)}
                  onPointerMove={handlePointerMoveLeaf}
                  onPointerUp={handlePointerUpLeaf}
                  onPointerCancel={handlePointerUpLeaf}
                  style={{
                    left: `${leaf.x}%`,
                    top: `${leaf.y}%`,
                    width: `${leaf.width}px`,
                    height: `${leaf.height}px`,
                    transform: `translate(-50%, -50%) rotate(${leaf.rotation}deg) scale(${isDraggingThis ? 1.15 : 1})`,
                    zIndex: isDraggingThis ? 30 : 10,
                  }}
                  className="absolute cursor-grab active:cursor-grabbing touch-none select-none transition-transform duration-75"
                >
                  {renderLeafSVG(leaf.type)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Feedback de Status */}
        {isCompleted ? (
          <div className="w-full py-2 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>FILTRO DE O2 PURIFICADO COM SUCESSO!</span>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between w-full px-2">
            <div className="flex items-center gap-1">
              <span>FOLHAS RESTANTES:</span>
              <span className="text-cyan-400 font-bold font-mono text-sm">{leaves.length} / 12</span>
            </div>
            {isGusting && (
              <span className="text-cyan-300 font-black animate-pulse flex items-center gap-1 text-[10px]">
                <Wind className="w-3 h-3" /> RAJADA DE VENTO!
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
