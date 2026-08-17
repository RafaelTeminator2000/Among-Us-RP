'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle2, Crosshair, Zap } from 'lucide-react';

interface AsteroidsMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
  targetCount?: number;
}

interface Asteroid {
  id: number;
  x: number; // Porcentagem (0-100)
  y: number; // Porcentagem (0-100)
  vx: number; // Velocidade X
  vy: number; // Velocidade Y
  size: number; // Tamanho em px
  rotation: number;
  rotSpeed: number;
}

interface LaserBlast {
  id: number;
  targetX: number;
  targetY: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

export const AsteroidsMinigame: React.FC<AsteroidsMinigameProps> = ({
  onComplete,
  onCancel,
  targetCount = 20,
}) => {
  const [destroyedCount, setDestroyedCount] = useState<number>(0);
  const [asteroids, setAsteroids] = useState<Asteroid[]>([]);
  const [lasers, setLasers] = useState<LaserBlast[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [recoil, setRecoil] = useState<boolean>(false);

  const nextAsteroidIdRef = useRef<number>(1);
  const destroyedCountRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Determinar o Tier de Dificuldade (1 a 4 a cada 5 asteroides destruídos)
  const currentTier = Math.min(4, Math.floor(destroyedCount / 5) + 1);

  // Síntese de áudio WebAudio de laser e explosão
  const playLaserSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }, []);

  const playExplosionSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }, []);

  // Spawnar novo asteroide com velocidade proporcional ao Tier atual
  const spawnAsteroid = useCallback(() => {
    const dCount = destroyedCountRef.current;
    const tier = Math.min(4, Math.floor(dCount / 5) + 1);

    // Ajustes de velocidade por Tier:
    // Tier 1: 0.35 a 0.55
    // Tier 2: 0.65 a 0.95
    // Tier 3: 1.05 a 1.45
    // Tier 4: 1.55 a 2.10
    let baseSpeed = 0.35;
    let speedVariance = 0.2;
    let maxVisible = 5;

    if (tier === 2) {
      baseSpeed = 0.65;
      speedVariance = 0.3;
      maxVisible = 7;
    } else if (tier === 3) {
      baseSpeed = 1.05;
      speedVariance = 0.4;
      maxVisible = 9;
    } else if (tier === 4) {
      baseSpeed = 1.55;
      speedVariance = 0.55;
      maxVisible = 12;
    }

    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -10 : 110;
    const startY = 15 + Math.random() * 70;
    const targetX = fromLeft ? 110 : -10;
    const targetY = 15 + Math.random() * 70;

    const angle = Math.atan2(targetY - startY, targetX - startX);
    const speed = baseSpeed + Math.random() * speedVariance;

    const newAst: Asteroid = {
      id: nextAsteroidIdRef.current++,
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 38 + Math.random() * 26,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * (4 + tier * 2),
    };

    setAsteroids((prev) => [...prev.slice(-maxVisible), newAst]);
  }, []);

  // Loop de Animação e Física dos Asteroides
  useEffect(() => {
    let lastSpawn = Date.now();

    const loop = () => {
      const now = Date.now();
      const dCount = destroyedCountRef.current;
      const tier = Math.min(4, Math.floor(dCount / 5) + 1);
      const spawnInterval = tier === 4 ? 320 : tier === 3 ? 480 : tier === 2 ? 680 : 880;

      if (now - lastSpawn > spawnInterval && !isCompleted) {
        spawnAsteroid();
        lastSpawn = now;
      }

      // Mover asteroides
      setAsteroids((prev) =>
        prev
          .map((ast) => ({
            ...ast,
            x: ast.x + ast.vx,
            y: ast.y + ast.vy,
            rotation: ast.rotation + ast.rotSpeed,
          }))
          .filter((ast) => ast.x >= -20 && ast.x <= 120 && ast.y >= -20 && ast.y <= 120)
      );

      // Mover partículas
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
          }))
          .slice(-25)
      );

      if (!isCompleted) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isCompleted, spawnAsteroid]);

  // Atirar e Destruir Asteroide
  const handleShootAsteroid = (ast: Asteroid, e: React.MouseEvent | React.TouchEvent) => {
    if (isCompleted) return;
    e.stopPropagation();

    playLaserSound();
    setTimeout(playExplosionSound, 50);

    // Efeito de Recuo do Cockpit
    setRecoil(true);
    setTimeout(() => setRecoil(false), 80);

    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(35);
    }

    // Gerar lasers duplos da cabine
    const blastId = Date.now();
    setLasers([{ id: blastId, targetX: ast.x, targetY: ast.y }]);
    setTimeout(() => setLasers([]), 120);

    // Gerar partículas de explosão
    const newParticles: Particle[] = Array.from({ length: 6 }, (_, i) => ({
      id: blastId + i,
      x: ast.x,
      y: ast.y,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      color: Math.random() > 0.5 ? '#f59e0b' : '#78716c',
    }));
    setParticles((prev) => [...prev, ...newParticles]);

    // Remover asteroide destruído
    setAsteroids((prev) => prev.filter((a) => a.id !== ast.id));

    const updatedDestroyed = destroyedCountRef.current + 1;
    destroyedCountRef.current = updatedDestroyed;
    setDestroyedCount(updatedDestroyed);

    if (updatedDestroyed >= targetCount) {
      setIsCompleted(true);
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([50, 80, 50, 80, 150]);
      }
      setTimeout(() => onComplete(), 800);
    }
  };

  // Disparar no vazio da tela
  const handleFireMiss = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isCompleted) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    playLaserSound();
    setRecoil(true);
    setTimeout(() => setRecoil(false), 80);

    setLasers([{ id: Date.now(), targetX: clickX, targetY: clickY }]);
    setTimeout(() => setLasers([]), 120);
  };

  const remaining = Math.max(0, targetCount - destroyedCount);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console de Armas */}
      <div
        className={`w-full max-w-sm bg-slate-900 border-4 border-slate-700 rounded-3xl p-4 shadow-2xl relative overflow-hidden flex flex-col items-center gap-3 transition-transform ${
          recoil ? '-translate-y-1' : 'translate-y-0'
        }`}
      >
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 left-3 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-950 border border-slate-700 transition-colors z-30 cursor-pointer shadow active:scale-95"
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
            <Crosshair className="w-5 h-5 text-emerald-400" />
            <span>DESTRUIR ASTEROIDES</span>
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-400">
            Toque nos asteroides que cruzam o espaço para destruí-los
          </p>
        </div>

        {/* Cabine Espacial com Radar e Asteroides */}
        <div
          onClick={handleFireMiss}
          className="relative w-full h-80 bg-slate-950 rounded-2xl border-2 border-emerald-500/50 overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.15)] cursor-crosshair touch-none"
        >
          {/* Fundo Estrelado */}
          <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:20px_20px] opacity-25 pointer-events-none" />

          {/* Mira e Grade Wireframe Verde */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <div className="w-48 h-48 rounded-full border border-emerald-400/50 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border border-emerald-400/40" />
            </div>
            <div className="absolute inset-x-0 h-px bg-emerald-400/30" />
            <div className="absolute inset-y-0 w-px bg-emerald-400/30" />
          </div>

          {/* Contador de Destroços Restantes & Nível de Velocidade (Tier 1 a 4) */}
          <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
            <div className="bg-slate-900/90 border border-emerald-500/60 px-3 py-1 rounded-xl text-[10px] font-mono font-black text-emerald-400 shadow">
              RESTANTES: <span className="text-white text-xs">{remaining}</span> / {targetCount}
            </div>

            {/* Badge de Dificuldade com 4 Tiers */}
            <div
              className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-black border flex items-center gap-1 shadow ${
                currentTier === 4
                  ? 'bg-red-950/90 border-red-500 text-red-300 animate-pulse shadow-[0_0_12px_#ef4444]'
                  : currentTier === 3
                  ? 'bg-amber-950/90 border-amber-500 text-amber-300'
                  : currentTier === 2
                  ? 'bg-yellow-950/90 border-yellow-500 text-yellow-300'
                  : 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>NÍVEL {currentTier}/4 {currentTier === 4 ? '(CRÍTICO)' : ''}</span>
            </div>
          </div>

          {/* SVG para os Raios Lasers Duplos da Cabine */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {lasers.map((l) => (
              <g key={l.id}>
                {/* Laser Canhão Esquerdo */}
                <line
                  x1="10%"
                  y1="95%"
                  x2={`${l.targetX}%`}
                  y2={`${l.targetY}%`}
                  stroke="#ef4444"
                  strokeWidth="4"
                  strokeLinecap="round"
                  style={{ filter: 'drop-shadow(0 0 8px #ef4444)' }}
                />
                {/* Laser Canhão Direito */}
                <line
                  x1="90%"
                  y1="95%"
                  x2={`${l.targetX}%`}
                  y2={`${l.targetY}%`}
                  stroke="#ef4444"
                  strokeWidth="4"
                  strokeLinecap="round"
                  style={{ filter: 'drop-shadow(0 0 8px #ef4444)' }}
                />
              </g>
            ))}
          </svg>

          {/* Asteroides em Movimento */}
          {asteroids.map((ast) => (
            <div
              key={ast.id}
              onClick={(e) => handleShootAsteroid(ast, e)}
              style={{
                left: `${ast.x}%`,
                top: `${ast.y}%`,
                width: `${ast.size}px`,
                height: `${ast.size}px`,
                transform: `translate(-50%, -50%) rotate(${ast.rotation}deg)`,
              }}
              className="absolute z-20 cursor-pointer flex items-center justify-center active:scale-95 transition-transform"
            >
              {/* Formato de Rocha Espacial com Cratera */}
              <div className="w-full h-full bg-stone-700 border-2 border-stone-500 rounded-3xl shadow-lg relative flex items-center justify-center">
                <div className="w-3 h-3 bg-stone-900 rounded-full absolute top-2 left-2 opacity-60" />
                <div className="w-2 h-2 bg-stone-900 rounded-full absolute bottom-3 right-3 opacity-60" />
              </div>
            </div>
          ))}

          {/* Partículas de Fragmentação */}
          {particles.map((p) => (
            <div
              key={p.id}
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                backgroundColor: p.color,
              }}
              className="absolute w-2 h-2 rounded-full shadow pointer-events-none animate-ping"
            />
          ))}

          {/* Canhões da Cabine Inferior (Esquerdo e Direito) */}
          <div className="absolute bottom-0 left-2 w-12 h-8 bg-slate-800 border-2 border-slate-600 rounded-t-xl z-20 pointer-events-none flex items-center justify-center">
            <div className="w-3 h-5 bg-red-600 rounded-t-sm" />
          </div>
          <div className="absolute bottom-0 right-2 w-12 h-8 bg-slate-800 border-2 border-slate-600 rounded-t-xl z-20 pointer-events-none flex items-center justify-center">
            <div className="w-3 h-5 bg-red-600 rounded-t-sm" />
          </div>
        </div>

        {/* Feedback de Status */}
        {isCompleted ? (
          <div className="w-full py-2 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>SISTEMA DE DEFESA LIMPO COM SUCESSO!</span>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-400">
            A velocidade dos asteroides aumenta a cada 5 alvos destruídos
          </div>
        )}
      </div>
    </div>
  );
};
