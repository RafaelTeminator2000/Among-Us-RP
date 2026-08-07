"use client";

import React, { useState, useEffect, useRef } from "react";
import { WireColor } from "@/types/game";
import { CheckCircle2, RefreshCw, Zap, X } from "lucide-react";

interface WireMinigameProps {
  onComplete: () => void;
  onCancel?: () => void;
}

const WIRE_COLORS: { color: WireColor; hex: string; name: string }[] = [
  { color: "red", hex: "#ef4444", name: "Vermelho" },
  { color: "blue", hex: "#3b82f6", name: "Azul" },
  { color: "yellow", hex: "#eab308", name: "Amarelo" },
  { color: "pink", hex: "#ec4899", name: "Rosa" },
];

export const WireMinigame: React.FC<WireMinigameProps> = ({ onComplete, onCancel }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [leftWires, setLeftWires] = useState<WireColor[]>([]);
  const [rightWires, setRightWires] = useState<WireColor[]>([]);
  const [connections, setConnections] = useState<Record<WireColor, WireColor | null>>({
    red: null,
    blue: null,
    yellow: null,
    pink: null,
  });

  const [activeDrag, setActiveDrag] = useState<{
    color: WireColor;
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);

  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Sound Synth for connection and victory
  const playTone = (freq: number, duration: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio fallback
    }
  };

  const playVictorySound = () => {
    playTone(523.25, 0.15); // C5
    setTimeout(() => playTone(659.25, 0.15), 150); // E5
    setTimeout(() => playTone(783.99, 0.3), 300); // G5
  };

  // Shuffle wires on mount or reset
  const initGame = () => {
    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
    const colors: WireColor[] = ["red", "blue", "yellow", "pink"];
    setLeftWires(shuffle(colors));
    setRightWires(shuffle(colors));
    setConnections({ red: null, blue: null, yellow: null, pink: null });
    setActiveDrag(null);
    setIsCompleted(false);
  };

  useEffect(() => {
    initGame();
  }, []);

  // Check victory condition
  useEffect(() => {
    const allConnected = WIRE_COLORS.every(
      (w) => connections[w.color] === w.color
    );

    if (allConnected && !isCompleted) {
      setIsCompleted(true);
      playVictorySound();
      if ("vibrate" in navigator) {
        navigator.vibrate([100, 50, 100, 50, 200]);
      }
      setTimeout(() => {
        onComplete();
      }, 1400);
    }
  }, [connections, isCompleted]);

  // Helper to get element coordinates relative to container SVG
  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const getElementCenter = (el: HTMLDivElement | null) => {
    if (!el || !containerRef.current) return { x: 0, y: 0 };
    const containerRect = containerRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    return {
      x: elRect.left + elRect.width / 2 - containerRect.left,
      y: elRect.top + elRect.height / 2 - containerRect.top,
    };
  };

  // Start Dragging Wire
  const handleStartDrag = (color: WireColor, clientX: number, clientY: number) => {
    if (isCompleted || connections[color] === color) return; // Locked if already correct
    const startPos = getElementCenter(leftRefs.current[color]);
    const currentPos = getRelativeCoords(clientX, clientY);
    setActiveDrag({
      color,
      start: startPos,
      current: currentPos,
    });
  };

  // Handle Drag Move
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!activeDrag) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const coords = getRelativeCoords(clientX, clientY);
      setActiveDrag((prev) => (prev ? { ...prev, current: coords } : null));
    };

    const handleEnd = (e: MouseEvent | TouchEvent) => {
      if (!activeDrag) return;

      const clientX =
        "changedTouches" in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
      const clientY =
        "changedTouches" in e ? e.changedTouches[0].clientY : (e as MouseEvent).clientY;

      // Check if dropped near any right terminal
      let matchedRightColor: WireColor | null = null;
      for (const color of rightWires) {
        const el = rightRefs.current[color];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
          ) {
            matchedRightColor = color;
            break;
          }
        }
      }

      if (matchedRightColor) {
        if (matchedRightColor === activeDrag.color) {
          // Correct wire match!
          setConnections((prev) => ({ ...prev, [activeDrag.color]: matchedRightColor }));
          playTone(600, 0.1);
        } else {
          // Incorrect wire match - fail feedback
          playTone(200, 0.15);
        }
      }

      setActiveDrag(null);
    };

    if (activeDrag) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleMove);
      window.addEventListener("touchend", handleEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [activeDrag, rightWires]);

  return (
    <div className="relative w-full max-w-md mx-auto h-[85vh] max-h-[700px] bg-slate-950 text-white rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl flex flex-col justify-between p-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between z-20 bg-slate-900/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-amber-400 uppercase tracking-wider">
              PAINEL ELÉTRICO
            </h2>
            <p className="text-xs text-slate-400">Conecte os fios às cores correspondentes</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={initGame}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            title="Recomeçar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Electrical Panel Workspace */}
      <div
        ref={containerRef}
        className="relative flex-1 my-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center overflow-hidden touch-none"
      >
        {/* Panel Background Lines / Sci-Fi Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-30 pointer-events-none" />

        {/* SVG Canvas for Drawing Wires */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {/* Completed / Connected Wires */}
          {WIRE_COLORS.map((w) => {
            const targetColor = connections[w.color];
            if (!targetColor) return null;

            const startPos = getElementCenter(leftRefs.current[w.color]);
            const endPos = getElementCenter(rightRefs.current[targetColor]);

            return (
              <g key={`wire-connected-${w.color}`}>
                {/* Wire Shadow */}
                <path
                  d={`M ${startPos.x} ${startPos.y} C ${startPos.x + 60} ${startPos.y}, ${endPos.x - 60} ${endPos.y}, ${endPos.x} ${endPos.y}`}
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth="14"
                  fill="none"
                />
                {/* Wire Body */}
                <path
                  d={`M ${startPos.x} ${startPos.y} C ${startPos.x + 60} ${startPos.y}, ${endPos.x - 60} ${endPos.y}, ${endPos.x} ${endPos.y}`}
                  stroke={w.hex}
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                />
                {/* Glow Effect */}
                <path
                  d={`M ${startPos.x} ${startPos.y} C ${startPos.x + 60} ${startPos.y}, ${endPos.x - 60} ${endPos.y}, ${endPos.x} ${endPos.y}`}
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeOpacity="0.6"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* Active Dragging Wire */}
          {activeDrag && (
            <g key="wire-active-drag">
              <path
                d={`M ${activeDrag.start.x} ${activeDrag.start.y} C ${activeDrag.start.x + 40} ${activeDrag.start.y}, ${activeDrag.current.x - 40} ${activeDrag.current.y}, ${activeDrag.current.x} ${activeDrag.current.y}`}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth="14"
                fill="none"
              />
              <path
                d={`M ${activeDrag.start.x} ${activeDrag.start.y} C ${activeDrag.start.x + 40} ${activeDrag.start.y}, ${activeDrag.current.x - 40} ${activeDrag.current.y}, ${activeDrag.current.x} ${activeDrag.current.y}`}
                stroke={WIRE_COLORS.find((c) => c.color === activeDrag.color)?.hex}
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
              />
            </g>
          )}
        </svg>

        {/* Left Column Terminals (Source Wires) */}
        <div className="flex flex-col justify-around h-full z-20 gap-4">
          {leftWires.map((color) => {
            const wireDef = WIRE_COLORS.find((c) => c.color === color)!;
            const isConnected = connections[color] === color;

            return (
              <div
                key={`left-${color}`}
                ref={(el) => {
                  leftRefs.current[color] = el;
                }}
                onMouseDown={(e) => handleStartDrag(color, e.clientX, e.clientY)}
                onTouchStart={(e) =>
                  handleStartDrag(color, e.touches[0].clientX, e.touches[0].clientY)
                }
                className="group cursor-grab active:cursor-grabbing flex items-center gap-2"
              >
                {/* Left Connector Base */}
                <div className="w-10 h-12 bg-slate-800 border-2 border-slate-700 rounded-l-lg flex items-center justify-center shadow-md">
                  <div className="w-3 h-6 bg-slate-900 rounded-sm" />
                </div>
                {/* Wire Terminal Plug */}
                <div
                  className="w-10 h-10 rounded-r-xl border-2 border-slate-950 shadow-lg flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ backgroundColor: wireDef.hex }}
                >
                  <div className="w-3 h-3 bg-white/40 rounded-full" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column Terminals (Destination Sockets) */}
        <div className="flex flex-col justify-around h-full z-20 gap-4">
          {rightWires.map((color) => {
            const wireDef = WIRE_COLORS.find((c) => c.color === color)!;
            const isConnectedToMe = Object.values(connections).includes(color);

            return (
              <div
                key={`right-${color}`}
                ref={(el) => {
                  rightRefs.current[color] = el;
                }}
                className="flex items-center gap-2"
              >
                {/* Right Socket Plug */}
                <div
                  className="w-10 h-10 rounded-l-xl border-2 border-slate-950 shadow-lg flex items-center justify-center"
                  style={{ backgroundColor: wireDef.hex }}
                >
                  <div
                    className={`w-4 h-4 rounded-full border border-slate-900 ${
                      isConnectedToMe ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-slate-950"
                    }`}
                  />
                </div>
                {/* Right Socket Base */}
                <div className="w-10 h-12 bg-slate-800 border-2 border-slate-700 rounded-r-lg flex items-center justify-center shadow-md">
                  <div className="w-3 h-6 bg-slate-900 rounded-sm" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Completion Overlay Banner */}
        {isCompleted && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-200">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-3 animate-bounce" />
            <h3 className="text-xl font-extrabold text-emerald-400 uppercase tracking-widest">
              TAREFA CONCLUÍDA!
            </h3>
            <p className="text-xs font-mono text-emerald-200/80 mt-1">
              Todos os fios foram reparados com sucesso.
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="z-20 flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800">
        <div className="text-xs text-slate-400 font-mono">
          CONEXÕES:{" "}
          <span className="text-amber-400 font-bold">
            {Object.values(connections).filter((c) => c !== null).length} / 4
          </span>
        </div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">
          ARRASTE DO FIOS DA ESQUERDA
        </div>
      </div>
    </div>
  );
};
