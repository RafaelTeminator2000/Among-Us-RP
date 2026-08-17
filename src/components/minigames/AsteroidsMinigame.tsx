'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle2, Crosshair, Zap } from 'lucide-react';

interface AsteroidsMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
  targetCount?: number;
}

interface AsteroidEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  rotSpeed: number;
  shapePoints: { x: number; y: number }[];
  craters: { x: number; y: number; r: number }[];
}

interface LaserEntity {
  targetX: number;
  targetY: number;
  alpha: number;
  decay: number;
}

interface ParticleEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
}

export const AsteroidsMinigame: React.FC<AsteroidsMinigameProps> = ({
  onComplete,
  onCancel,
  targetCount = 20,
}) => {
  const [destroyedCount, setDestroyedCount] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [recoil, setRecoil] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const destroyedCountRef = useRef<number>(0);
  const isCompletedRef = useRef<boolean>(false);
  const nextIdRef = useRef<number>(1);

  // Entidades do motor de física em Canvas (Zero React state overhead)
  const asteroidsRef = useRef<AsteroidEntity[]>([]);
  const laserRef = useRef<LaserEntity | null>(null);
  const particlesRef = useRef<ParticleEntity[]>([]);
  const lastSpawnTimeRef = useRef<number>(0);
  const cannonAngleRef = useRef<number>(-Math.PI / 2); // Ângulo para cima por padrão
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Tier de Dificuldade (1 a 4 a cada 5 asteroides destruídos)
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
      osc.frequency.setValueAtTime(850, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
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
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {}
  }, []);

  // Gerar um asteroide com geometria irregular
  const createAsteroid = (width: number, height: number, tier: number): AsteroidEntity => {
    let baseSpeed = 1.2;
    let speedVar = 0.8;

    if (tier === 2) {
      baseSpeed = 2.0;
      speedVar = 1.0;
    } else if (tier === 3) {
      baseSpeed = 3.0;
      speedVar = 1.4;
    } else if (tier === 4) {
      baseSpeed = 4.2;
      speedVar = 1.8;
    }

    const radius = 20 + Math.random() * 14;
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -radius - 10 : width + radius + 10;
    const startY = 30 + Math.random() * (height - 80);
    const targetX = fromLeft ? width + radius + 10 : -radius - 10;
    const targetY = 30 + Math.random() * (height - 80);

    const angle = Math.atan2(targetY - startY, targetX - startX);
    const speed = baseSpeed + Math.random() * speedVar;

    // Gerar formato poligonal irregular com crateras
    const numPoints = 8;
    const shapePoints = [];
    for (let i = 0; i < numPoints; i++) {
      const a = (i / numPoints) * Math.PI * 2;
      const r = radius * (0.8 + Math.random() * 0.4);
      shapePoints.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }

    const craters = [
      { x: -radius * 0.3, y: -radius * 0.2, r: radius * 0.22 },
      { x: radius * 0.35, y: radius * 0.25, r: radius * 0.18 },
    ];

    return {
      id: nextIdRef.current++,
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.05 * tier,
      shapePoints,
      craters,
    };
  };

  // Loop de Renderização e Física 60 FPS com Canvas 2D
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const now = performance.now();
      const dCount = destroyedCountRef.current;
      const tier = Math.min(4, Math.floor(dCount / 5) + 1);

      // Spawn interval por tier
      const spawnInterval = tier === 4 ? 280 : tier === 3 ? 420 : tier === 2 ? 620 : 850;
      const maxAsteroids = tier === 4 ? 12 : tier === 3 ? 9 : tier === 2 ? 6 : 4;

      if (now - lastSpawnTimeRef.current > spawnInterval && !isCompletedRef.current) {
        if (asteroidsRef.current.length < maxAsteroids) {
          asteroidsRef.current.push(createAsteroid(width, height, tier));
          lastSpawnTimeRef.current = now;
        }
      }

      // 1. Limpar Tela
      ctx.clearRect(0, 0, width, height);

      // 2. Desenhar Grade de Fundo e Radar
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);

      // Fundo estrelado estático
      ctx.fillStyle = '#1e293b';
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 47) % width);
        const sy = ((i * 83) % height);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // Círculos de radar verde wireframe
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, width * 0.35, 0, Math.PI * 2);
      ctx.arc(width / 2, height / 2, width * 0.2, 0, Math.PI * 2);
      ctx.stroke();

      // Linhas cruzadas do radar
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // 3. Atualizar e Desenhar Asteroides
      const aliveAsteroids: AsteroidEntity[] = [];
      for (const ast of asteroidsRef.current) {
        ast.x += ast.vx;
        ast.y += ast.vy;
        ast.rotation += ast.rotSpeed;

        // Manter se dentro do espaço útil
        if (
          ast.x >= -ast.radius - 30 &&
          ast.x <= width + ast.radius + 30 &&
          ast.y >= -ast.radius - 30 &&
          ast.y <= height + ast.radius + 30
        ) {
          aliveAsteroids.push(ast);

          // Desenhar Asteroide
          ctx.save();
          ctx.translate(ast.x, ast.y);
          ctx.rotate(ast.rotation);

          // Corpo do Asteroide
          ctx.fillStyle = '#44403c';
          ctx.strokeStyle = '#78716c';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ast.shapePoints.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Crateras internas
          ctx.fillStyle = '#292524';
          ast.craters.forEach((c) => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
            ctx.fill();
          });

          ctx.restore();
        }
      }
      asteroidsRef.current = aliveAsteroids;

      // 4. Desenhar Laser Único do Canhão Central
      if (laserRef.current) {
        const l = laserRef.current;
        const cannonBaseX = width / 2;
        const cannonBaseY = height - 12;

        ctx.save();
        ctx.strokeStyle = `rgba(239, 68, 68, ${l.alpha})`;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 16;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(cannonBaseX, cannonBaseY);
        ctx.lineTo(l.targetX, l.targetY);
        ctx.stroke();

        // Núcleo branco brilhante do laser
        ctx.strokeStyle = `rgba(255, 255, 255, ${l.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cannonBaseX, cannonBaseY);
        ctx.lineTo(l.targetX, l.targetY);
        ctx.stroke();

        ctx.restore();

        l.alpha -= l.decay;
        if (l.alpha <= 0) {
          laserRef.current = null;
        }
      }

      // 5. Atualizar e Desenhar Partículas de Explosão
      const aliveParticles: ParticleEntity[] = [];
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha > 0) {
          aliveParticles.push(p);

          ctx.save();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      particlesRef.current = aliveParticles;

      // 6. Desenhar Canhão Central Único na Base
      const cannonX = width / 2;
      const cannonY = height - 10;
      const cannonAngle = cannonAngleRef.current;

      ctx.save();
      ctx.translate(cannonX, cannonY);

      // Base da torre central
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Tubo / Cano giratório do canhão
      ctx.rotate(cannonAngle + Math.PI / 2);
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-4, -26, 8, 22);
      ctx.strokeRect(-4, -26, 8, 22);

      // Núcleo do canhão
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      if (!isCompletedRef.current) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animId);
  }, []);

  // Interação de Toque / Clique no Canvas (Disparo Preciso)
  const handleCanvasInteraction = (clientX: number, clientY: number) => {
    if (isCompletedRef.current || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const clickX = (clientX - rect.left) * scaleX;
    const clickY = (clientY - rect.top) * scaleY;

    // Calcular ângulo da torre central para o ponto clicado
    const cannonBaseX = canvasRef.current.width / 2;
    const cannonBaseY = canvasRef.current.height - 10;
    cannonAngleRef.current = Math.atan2(clickY - cannonBaseY, clickX - cannonBaseX);

    playLaserSound();

    // Recuo do console
    setRecoil(true);
    setTimeout(() => setRecoil(false), 70);

    // Encontrar asteroide atingido (Hitbox generosa: raio + 18px para máxima precisão)
    let hitIndex = -1;
    for (let i = asteroidsRef.current.length - 1; i >= 0; i--) {
      const ast = asteroidsRef.current[i];
      const dist = Math.hypot(clickX - ast.x, clickY - ast.y);
      if (dist <= ast.radius + 18) {
        hitIndex = i;
        break;
      }
    }

    if (hitIndex !== -1) {
      // ACERTO!
      const hitAst = asteroidsRef.current[hitIndex];
      asteroidsRef.current.splice(hitIndex, 1);

      playExplosionSound();

      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate(30);
      }

      // Criar laser único direcionado ao asteroide
      laserRef.current = {
        targetX: hitAst.x,
        targetY: hitAst.y,
        alpha: 1.0,
        decay: 0.12,
      };

      // Gerar partículas de explosão
      for (let i = 0; i < 10; i++) {
        const pAngle = Math.random() * Math.PI * 2;
        const pSpeed = 1.5 + Math.random() * 3.5;
        particlesRef.current.push({
          x: hitAst.x,
          y: hitAst.y,
          vx: Math.cos(pAngle) * pSpeed,
          vy: Math.sin(pAngle) * pSpeed,
          radius: 2 + Math.random() * 2.5,
          color: Math.random() > 0.4 ? '#f59e0b' : '#ef4444',
          alpha: 1.0,
          decay: 0.05 + Math.random() * 0.05,
        });
      }

      const nextCount = destroyedCountRef.current + 1;
      destroyedCountRef.current = nextCount;
      setDestroyedCount(nextCount);

      if (nextCount >= targetCount) {
        isCompletedRef.current = true;
        setIsCompleted(true);
        if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
          navigator.vibrate([50, 80, 50, 80, 150]);
        }
        setTimeout(() => onCompleteRef.current(), 750);
      }
    } else {
      // DISPARO NO VAZIO
      laserRef.current = {
        targetX: clickX,
        targetY: clickY,
        alpha: 1.0,
        decay: 0.14,
      };
    }
  };

  const remaining = Math.max(0, targetCount - destroyedCount);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console de Armas */}
      <div
        className={`w-full max-w-sm bg-slate-900 border-4 border-slate-700 rounded-3xl p-4 shadow-2xl relative overflow-hidden flex flex-col items-center gap-3 transition-transform duration-75 ${
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
            Toque nos asteroides para disparar o canhão central
          </p>
        </div>

        {/* Canvas de Alta Performance 60FPS */}
        <div className="relative w-full h-80 bg-slate-950 rounded-2xl border-2 border-emerald-500/50 overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.15)] touch-none cursor-crosshair">
          {/* Header com Contador e Badge de Tier */}
          <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
            <div className="bg-slate-900/90 border border-emerald-500/60 px-3 py-1 rounded-xl text-[10px] font-mono font-black text-emerald-400 shadow">
              RESTANTES: <span className="text-white text-xs">{remaining}</span> / {targetCount}
            </div>

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

          <canvas
            ref={canvasRef}
            width={340}
            height={320}
            onPointerDown={(e) => handleCanvasInteraction(e.clientX, e.clientY)}
            className="w-full h-full block"
          />
        </div>

        {/* Feedback de Status */}
        {isCompleted ? (
          <div className="w-full py-2 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>SISTEMA DE DEFESA LIMPO COM SUCESSO!</span>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-400">
            Disparo único central calibrado • 60 FPS
          </div>
        )}
      </div>
    </div>
  );
};
