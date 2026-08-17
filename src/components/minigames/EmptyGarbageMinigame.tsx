'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle2, Trash2, Lock, ShieldCheck } from 'lucide-react';

interface EmptyGarbageMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface TrashPiece {
  id: number;
  emoji: string;
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  rotation: number;
  size: number;
  floatPhase: number;
  floatSpeed: number;
  floatAmplitude: number;
}

// 26 Itens ordenados do TOPO (índice 0) para a BASE (índice 25)
// preenchendo a câmara desde o topo (Y=15) até a boca da escotilha (Y=84)
const GENERATE_TRASH_PILE = (): TrashPiece[] => {
  const layout = [
    // 1. Topo Supremo (Y 14 a 22) - Saem por ÚLTIMO (7s a 8s)
    { emoji: '💎', x: 50, y: 15, size: 36, rot: 35 },
    { emoji: '🍂', x: 28, y: 18, size: 40, rot: -20 },
    { emoji: '📄', x: 72, y: 20, size: 34, rot: 25 },

    // 2. Topo Alto (Y 24 a 34) - Saem em 5.5s a 7s
    { emoji: '🦴', x: 42, y: 26, size: 42, rot: -45 },
    { emoji: '🧃', x: 65, y: 29, size: 36, rot: 15 },
    { emoji: '🍂', x: 18, y: 31, size: 38, rot: 40 },
    { emoji: '🥫', x: 82, y: 33, size: 38, rot: -15 },

    // 3. Médio-Alto (Y 36 a 46) - Saem em 4s a 5.5s
    { emoji: '🍔', x: 34, y: 38, size: 40, rot: 10 },
    { emoji: '🍾', x: 56, y: 40, size: 42, rot: -30 },
    { emoji: '🍌', x: 76, y: 43, size: 40, rot: 45 },
    { emoji: '📄', x: 16, y: 45, size: 34, rot: -25 },

    // 4. Médio (Y 48 a 58) - Saem em 2.5s a 4s
    { emoji: '🍂', x: 45, y: 50, size: 40, rot: -35 },
    { emoji: '💎', x: 68, y: 52, size: 36, rot: 20 },
    { emoji: '🦴', x: 25, y: 55, size: 42, rot: 50 },
    { emoji: '🥫', x: 84, y: 56, size: 38, rot: -10 },

    // 5. Médio-Baixo (Y 60 a 70) - Saem em 1.5s a 2.5s
    { emoji: '🧃', x: 40, y: 62, size: 36, rot: -20 },
    { emoji: '🍂', x: 60, y: 64, size: 40, rot: 30 },
    { emoji: '🍔', x: 78, y: 67, size: 40, rot: -40 },
    { emoji: '📄', x: 18, y: 68, size: 34, rot: 15 },
    { emoji: '🍾', x: 52, y: 70, size: 42, rot: 45 },

    // 6. Base / Boca da Escotilha (Y 74 a 85) - Saem PRIMEIRO (0s a 1.5s)
    { emoji: '🍌', x: 70, y: 76, size: 40, rot: -15 },
    { emoji: '🦴', x: 30, y: 78, size: 44, rot: 35 },
    { emoji: '🍂', x: 48, y: 80, size: 42, rot: -25 },
    { emoji: '🥫', x: 15, y: 82, size: 38, rot: 45 },
    { emoji: '💎', x: 84, y: 81, size: 36, rot: -30 },
    { emoji: '🍔', x: 58, y: 84, size: 40, rot: 10 },
  ];

  return layout.map((item, idx) => ({
    id: idx + 1,
    emoji: item.emoji,
    baseX: item.x,
    baseY: item.y,
    x: item.x,
    y: item.y,
    rotation: item.rot,
    size: item.size,
    floatPhase: Math.random() * Math.PI * 2,
    floatSpeed: 0.002 + Math.random() * 0.0025,
    floatAmplitude: 3 + Math.random() * 4,
  }));
};

const TOTAL_DRAIN_TIME_MS = 8000; // 8 segundos para drenar todo o lixo
const TOTAL_COMPACT_TIME_MS = 3000; // 3 segundos para compactar e selar

export const EmptyGarbageMinigame: React.FC<EmptyGarbageMinigameProps> = ({
  onComplete,
  onCancel,
}) => {
  // Posição contínua da manopla: de 0 (topo) a 100 (base)
  const [leverProgress, setLeverProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [trashPieces, setTrashPieces] = useState<TrashPiece[]>(() => GENERATE_TRASH_PILE());
  const [isCompacting, setIsCompacting] = useState<boolean>(false);
  const [compactionProgress, setCompactionProgress] = useState<number>(0); // 0 a 100%
  const [drainProgress, setDrainProgress] = useState<number>(0); // 0 a 100%
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const leverTrackRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const leverProgressRef = useRef<number>(0);
  const isCompletedRef = useRef<boolean>(false);

  // Tempos acumulados
  const accumulatedDrainMsRef = useRef<number>(0);
  const accumulatedCompactMsRef = useRef<number>(0);
  const lastTimestampRef = useRef<number | null>(null);

  // Lista base imutável para interpolação da descida
  const initialTrashRef = useRef<TrashPiece[]>(GENERATE_TRASH_PILE());

  useEffect(() => {
    leverProgressRef.current = leverProgress;
  }, [leverProgress]);

  // A escotilha só abre a partir de 50% de acionamento da manopla
  const openRatio = leverProgress < 50 ? 0 : (leverProgress - 50) / 50; // 0.0 a 1.0

  // Síntese de áudio de turbina de sucção contínua
  const playSuctionSound = useCallback((intensity = 1) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110 + intensity * 80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.28);
      gain.gain.setValueAtTime(0.05 + intensity * 0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch {}
  }, []);

  const playSnapSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }, []);

  const playLockSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }, []);

  // Loop de Física: Tremores + Os itens de BAIXO somem primeiro e os de CIMA descem ocupando o lugar
  useEffect(() => {
    let lastSoundTime = 0;

    const loop = (timestamp: number) => {
      if (isCompletedRef.current) {
        if (modalRef.current) modalRef.current.style.transform = 'translate(0px, 0px)';
        return;
      }

      if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;
      const deltaMs = Math.min(50, timestamp - lastTimestampRef.current);
      lastTimestampRef.current = timestamp;

      const progress = leverProgressRef.current;
      const currentOpenRatio = progress < 50 ? 0 : (progress - 50) / 50;

      // Tremores e Vibração Mecânica no Modal em Tempo Real
      if (modalRef.current) {
        if (accumulatedDrainMsRef.current >= TOTAL_DRAIN_TIME_MS && currentOpenRatio > 0.1) {
          const shakeX = (Math.random() - 0.5) * 5.0;
          const shakeY = (Math.random() - 0.5) * 5.0;
          modalRef.current.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
        } else if (currentOpenRatio > 0.05) {
          const shakeX = (Math.random() - 0.5) * (currentOpenRatio * 3.8);
          const shakeY = (Math.random() - 0.5) * (currentOpenRatio * 3.8);
          modalRef.current.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
        } else {
          modalRef.current.style.transform = 'translate(0px, 0px)';
        }
      }

      if (currentOpenRatio > 0.05) {
        if (timestamp - lastSoundTime > 260) {
          playSuctionSound(currentOpenRatio);
          lastSoundTime = timestamp;

          if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
            navigator.vibrate(18);
          }
        }

        // 1. Etapa de Drenagem de Lixo (8 Segundos)
        if (accumulatedDrainMsRef.current < TOTAL_DRAIN_TIME_MS) {
          accumulatedDrainMsRef.current += deltaMs * currentOpenRatio;
          const currentDrainPct = Math.min(1, accumulatedDrainMsRef.current / TOTAL_DRAIN_TIME_MS);
          setDrainProgress(currentDrainPct * 100);

          // Os itens de BAIXO (final do array) somem PRIMEIRO!
          // Mantemos apenas os itens do início do array (índice 0 até remainingCount)
          const totalPiecesCount = initialTrashRef.current.length; // 26
          const piecesRemainingCount = Math.max(0, Math.ceil(totalPiecesCount * (1 - currentDrainPct)));

          // Pega os itens do TOPO que ainda restam
          const remainingBasePieces = initialTrashRef.current.slice(0, piecesRemainingCount);

          // Faz os itens do topo descerem suavemente em direção à base conforme o lixo de baixo sai
          setTrashPieces(
            remainingBasePieces.map((p, idx) => {
              // Interpola a descida: quanto mais lixo já saiu, mais o topo desce
              const sinkDistance = currentDrainPct * (85 - p.baseY);
              const funnelX = (50 - p.baseX) * (currentDrainPct * 0.5);

              return {
                ...p,
                x: p.baseX + funnelX,
                y: Math.min(88, p.baseY + sinkDistance),
                rotation: p.rotation + (idx % 2 === 0 ? 1 : -1) * (currentDrainPct * 180),
              };
            })
          );
        } else {
          // 2. Etapa de Compactação e Vácuo de Segurança (3 Segundos)
          setTrashPieces([]); // Todos os itens de baixo e cima já foram ejetados
          setIsCompacting(true);

          accumulatedCompactMsRef.current += deltaMs * currentOpenRatio;
          const currentCompactPct = Math.min(100, (accumulatedCompactMsRef.current / TOTAL_COMPACT_TIME_MS) * 100);
          setCompactionProgress(currentCompactPct);

          if (currentCompactPct >= 100 && !isCompletedRef.current) {
            isCompletedRef.current = true;
            setIsCompleted(true);
            setIsCompacting(false);
            if (modalRef.current) modalRef.current.style.transform = 'translate(0px, 0px)';
            playLockSound();
            if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
              navigator.vibrate([50, 100, 50, 100, 200]);
            }
            setTimeout(() => onComplete(), 800);
          }
        }
      } else {
        // Alavanca solta / menor que 50%: Escotilha fechada!
        if (accumulatedDrainMsRef.current >= TOTAL_DRAIN_TIME_MS && !isCompletedRef.current) {
          accumulatedCompactMsRef.current = 0;
          setIsCompacting(false);
          setCompactionProgress(0);
        }

        // Flutuação suave em Gravidade Zero dos itens que ainda estão na câmara
        const currentDrainPct = Math.min(1, accumulatedDrainMsRef.current / TOTAL_DRAIN_TIME_MS);
        const totalPiecesCount = initialTrashRef.current.length;
        const piecesRemainingCount = Math.max(0, Math.ceil(totalPiecesCount * (1 - currentDrainPct)));
        const remainingBasePieces = initialTrashRef.current.slice(0, piecesRemainingCount);

        setTrashPieces(
          remainingBasePieces.map((p) => {
            const sinkDistance = currentDrainPct * (85 - p.baseY);
            const floatOffset = Math.sin(timestamp * p.floatSpeed + p.floatPhase) * p.floatAmplitude;
            const rotOffset = Math.cos(timestamp * p.floatSpeed + p.floatPhase) * 4;

            return {
              ...p,
              x: p.baseX,
              y: p.baseY + sinkDistance + floatOffset * 0.15,
              rotation: p.rotation + rotOffset * 0.05,
            };
          })
        );
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [onComplete, playLockSound, playSuctionSound]);

  // Arraste com Pointer Capture
  const updateLeverProgress = (clientY: number) => {
    if (isCompleted || !leverTrackRef.current) return;
    const rect = leverTrackRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const progress = (relativeY / rect.height) * 100;
    const clamped = Math.max(0, Math.min(100, progress));
    setLeverProgress(clamped);

    if (clamped >= 90 && typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(15);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isCompleted) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateLeverProgress(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateLeverProgress(e.clientY);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    if (!isCompleted) {
      playSnapSound();
      setLeverProgress(0);
    }
  };

  const isHatchOpening = leverProgress >= 50;
  const remainingCompactSec = Math.max(1, Math.ceil((TOTAL_COMPACT_TIME_MS - (compactionProgress * (TOTAL_COMPACT_TIME_MS / 100))) / 1000));

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console Industrial do Ejetor de Lixo com Tremores Físicos */}
      <div
        ref={modalRef}
        className="w-full max-w-sm bg-slate-800 border-4 border-slate-600 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden flex flex-col items-center gap-3 will-change-transform transition-colors"
      >
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
            <Trash2 className="w-5 h-5 text-amber-400" />
            <span>ESVAZIAR LIXO</span>
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-400">
            Puxe a manopla além de 50% e segure firme até selar
          </p>
        </div>

        {/* Barra de Progresso Geral da Tarefa (Sucção 8s + Compactação 3s = 11s) */}
        <div className="w-full px-1 flex items-center justify-between text-[9px] font-mono font-bold text-slate-400">
          <span>PROGRESSO TOTAL:</span>
          <span className="text-amber-400 font-black">
            {isCompleted ? '100%' : `${Math.round((drainProgress * 0.72) + (compactionProgress * 0.28))}%`}
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700 -mt-2">
          <div
            style={{ width: `${isCompleted ? 100 : (drainProgress * 0.72) + (compactionProgress * 0.28)}%` }}
            className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 transition-all duration-75"
          />
        </div>

        {/* Container Industrial: Câmara Metálica + Alavanca Responsiva */}
        <div className="w-full flex items-center gap-3 bg-[#0a0f1d] p-3 rounded-2xl border-4 border-slate-700 shadow-inner">
          {/* Tubo de Lixo com Escotilha (Abre a partir de 50%) */}
          <div className="flex-1 h-80 bg-slate-950 rounded-xl border-2 border-slate-800 relative overflow-hidden flex flex-col justify-between shadow-inner">
            {/* Fundo Estrelado (Visível proporcionalmente quando manopla >= 50%) */}
            <div
              style={{ opacity: openRatio }}
              className="absolute inset-0 bg-[#020617] pointer-events-none"
            >
              <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-50 animate-pulse" />
              {/* Linhas de Vento da Sucção a Vácuo */}
              <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-cyan-500/30 to-transparent flex justify-center gap-6">
                <div
                  style={{ height: `${openRatio * 100}%` }}
                  className="w-0.5 bg-cyan-300/60 animate-pulse"
                />
                <div
                  style={{ height: `${openRatio * 100}%` }}
                  className="w-0.5 bg-cyan-300/60 animate-pulse [animation-delay:150ms]"
                />
                <div
                  style={{ height: `${openRatio * 100}%` }}
                  className="w-0.5 bg-cyan-300/60 animate-pulse [animation-delay:300ms]"
                />
              </div>
            </div>

            {/* Paredes Metálicas do Container com Rebites */}
            <div className="absolute inset-0 border-x-4 border-slate-700/80 pointer-events-none z-20">
              <div className="absolute top-6 left-1 w-1.5 h-1.5 rounded-full bg-slate-500" />
              <div className="absolute top-24 left-1 w-1.5 h-1.5 rounded-full bg-slate-500" />
              <div className="absolute top-44 left-1 w-1.5 h-1.5 rounded-full bg-slate-500" />
              <div className="absolute top-64 left-1 w-1.5 h-1.5 rounded-full bg-slate-500" />
              <div className="absolute top-6 right-1 w-1.5 h-1.5 rounded-full bg-slate-500" />
              <div className="absolute top-24 right-1 w-1.5 h-1.5 rounded-full bg-slate-500" />
              <div className="absolute top-44 right-1 w-1.5 h-1.5 rounded-full bg-slate-500" />
              <div className="absolute top-64 right-1 w-1.5 h-1.5 rounded-full bg-slate-500" />
            </div>

            {/* Pilha de Lixo: Preenche do Topo (Y=15) à Base (Y=85) */}
            {trashPieces.map((p) => (
              <div
                key={p.id}
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  fontSize: `${p.size}px`,
                  transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`,
                }}
                className="absolute transition-transform select-none pointer-events-none z-10 drop-shadow-[0_6px_10px_rgba(0,0,0,0.9)]"
              >
                {p.emoji}
              </div>
            ))}

            {/* Fase de Compactação de 3s (Após os 8s de drenagem) */}
            {isCompacting && (
              <div className="absolute inset-0 bg-emerald-950/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-30 animate-pulse">
                <ShieldCheck className="w-12 h-12 text-emerald-400 animate-bounce" />
                <div className="text-center font-mono">
                  <span className="text-xs font-black text-emerald-300 block tracking-wider">
                    COMPACTANDO VÁCUO ({remainingCompactSec}s)
                  </span>
                  <div className="w-36 h-2.5 bg-slate-900 rounded-full mt-1.5 border border-emerald-500/60 overflow-hidden mx-auto">
                    <div
                      style={{ width: `${compactionProgress}%` }}
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 shadow-[0_0_10px_#10b981] transition-all duration-75"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Escotilha Inferior (Portas que se abrem SOMENTE a partir de 50%) */}
            <div className="absolute bottom-0 inset-x-0 h-9 bg-slate-900 border-t-2 border-slate-700 flex items-center justify-between px-1 z-20">
              {/* Porta Esquerda (Abre a partir de 50%) */}
              <div
                style={{
                  transform: `translateX(-${openRatio * 100}%)`,
                }}
                className="w-1/2 h-full bg-gradient-to-r from-slate-700 to-slate-800 border-r border-slate-900 shadow-lg flex items-center justify-center"
              >
                <div className="w-full h-1 bg-yellow-400/50 [background-image:repeating-linear-gradient(45deg,#000,#000_6px,#eab308_6px,#eab308_12px)]" />
              </div>

              {/* Porta Direita (Abre a partir de 50%) */}
              <div
                style={{
                  transform: `translateX(${openRatio * 100}%)`,
                }}
                className="w-1/2 h-full bg-gradient-to-l from-slate-700 to-slate-800 border-l border-slate-900 shadow-lg flex items-center justify-center"
              >
                <div className="w-full h-1 bg-yellow-400/50 [background-image:repeating-linear-gradient(45deg,#000,#000_6px,#eab308_6px,#eab308_12px)]" />
              </div>
            </div>
          </div>

          {/* Painel da Alavanca Mecânica 3D com Marca de 50% */}
          <div
            ref={leverTrackRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-18 h-80 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 rounded-xl border-2 border-slate-600 p-2 flex flex-col items-center justify-between relative shadow-2xl cursor-ns-resize touch-none select-none"
          >
            <span className="text-[8px] font-mono font-black text-slate-400 uppercase tracking-wider pointer-events-none">
              ABRIR
            </span>

            {/* Sulco da Haste Metálica com Linha de 50% */}
            <div className="w-4 h-60 bg-slate-950 rounded-full border-2 border-slate-800 relative flex justify-center shadow-inner">
              {/* Linha indicadora de 50% (onde a escotilha começa a abrir) */}
              <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-0.5 bg-yellow-400/60 z-10 pointer-events-none" />

              {/* Haste de Metal Prateada */}
              <div
                style={{
                  height: `${leverProgress}%`,
                  transition: isDragging ? 'none' : 'height 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                className="w-2 bg-gradient-to-r from-slate-300 via-slate-100 to-slate-400 absolute top-0 rounded-t-full shadow"
              />

              {/* Manopla Vermelha Esférica 3D */}
              <div
                style={{
                  top: `${leverProgress}%`,
                  transform: 'translateY(-50%)',
                  transition: isDragging ? 'none' : 'top 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                className={`absolute w-12 h-12 rounded-full border-2 cursor-grab active:cursor-grabbing shadow-2xl flex items-center justify-center select-none touch-none ${
                  isHatchOpening
                    ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-800 border-red-300 shadow-[0_0_25px_#ef4444] scale-110'
                    : 'bg-gradient-to-br from-red-500 via-red-600 to-red-700 hover:from-red-400 hover:to-red-600 border-red-300 shadow-lg'
                }`}
              >
                {/* Brilho Esférico 3D */}
                <div className="w-5 h-5 rounded-full bg-white/40 absolute top-1.5 left-2 shadow-inner blur-[0.5px]" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/80 absolute top-2 left-2.5" />
              </div>
            </div>

            <span className="text-[8px] font-mono font-black text-amber-400 uppercase tracking-wider pointer-events-none">
              EJETAR
            </span>
          </div>
        </div>

        {/* Feedback de Status */}
        {isCompleted ? (
          <div className="w-full py-2 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>ESCOTILHA SELADA E TRAVADA COM SUCESSO!</span>
          </div>
        ) : isCompacting ? (
          <div className="w-full py-2 bg-emerald-950 text-emerald-300 border border-emerald-500/60 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 animate-pulse">
            <Lock className="w-3.5 h-3.5" />
            <span>MANTENHA PUXADO PARA SELAR ({remainingCompactSec}s)</span>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-400">
            {leverProgress >= 50
              ? `Esvaziando container... (${Math.round(8 - (drainProgress * 0.08))}s)`
              : 'Puxe a manopla além da linha central (50%)'}
          </div>
        )}
      </div>
    </div>
  );
};
