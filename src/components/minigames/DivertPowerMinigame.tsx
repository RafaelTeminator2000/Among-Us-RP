'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, CheckCircle2, Zap, RotateCw, Cpu, RefreshCw } from 'lucide-react';

interface DivertPowerMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
  rooms?: Array<{ id: string; name: string }>;
}

// Tipos de conexões de cada peça da grade (N: Norte/Top, E: Leste/Right, S: Sul/Bottom, W: Oeste/Left)
type TileShape = 'curve' | 'straight';

interface TileData {
  id: number;
  row: number;
  col: number;
  shape: TileShape;
  rotation: number; // 0, 90, 180, 270 graus
}

interface InternalConnection {
  from: 'N' | 'E' | 'S' | 'W';
  to: 'N' | 'E' | 'S' | 'W';
}

// Configuração padrão de salas da nave caso não sejam passadas por prop
const DEFAULT_FALLBACK_ROOMS = [
  { id: 'r1', name: 'Recepção / Entrada' },
  { id: 'r2', name: 'Elétrica & Fiação' },
  { id: 'r3', name: 'Reator / Coletores' },
  { id: 'r4', name: 'Gerador / Distribuidor' },
  { id: 'r5', name: 'Oxigênio / O2' },
  { id: 'r6', name: 'Navegação & Rumo' },
];

type Cell = [number, number]; // [row, col]

// Encontra todos os caminhos simples válidos de POW [2, 0] até BYPASS [1, 2] na grade 3x3
function getAllValidPaths(): Cell[][] {
  const paths: Cell[][] = [];
  const visited = new Set<string>();

  function dfs(r: number, c: number, currentPath: Cell[]) {
    if (r === 1 && c === 2) {
      if (currentPath.length >= 4) {
        paths.push([...currentPath]);
      }
      return;
    }

    const neighbors: [number, number][] = [
      [r - 1, c], // N
      [r + 1, c], // S
      [r, c + 1], // E
      [r, c - 1], // W
    ];

    for (const [nr, nc] of neighbors) {
      if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
        const key = `${nr},${nc}`;
        if (!visited.has(key)) {
          visited.add(key);
          currentPath.push([nr, nc]);
          dfs(nr, nc, currentPath);
          currentPath.pop();
          visited.delete(key);
        }
      }
    }
  }

  visited.add('2,0');
  dfs(2, 0, [[2, 0]]);
  return paths;
}

// Lista de todos os caminhos possíveis da grade 3x3
const ALL_VALID_PATHS: Cell[][] = getAllValidPaths();

function getDirection(from: Cell, to: Cell): 'N' | 'E' | 'S' | 'W' {
  const [r1, c1] = from;
  const [r2, c2] = to;
  if (r2 < r1) return 'N';
  if (r2 > r1) return 'S';
  if (c2 > c1) return 'E';
  return 'W';
}

function getTileShapeAndSolution(enter: 'N' | 'E' | 'S' | 'W', exit: 'N' | 'E' | 'S' | 'W'): { shape: TileShape; solutionRotation: number } {
  const ports = [enter, exit].sort().join('-');

  if (ports === 'N-S') {
    return { shape: 'straight', solutionRotation: 0 };
  }

  if (ports === 'E-W') {
    return { shape: 'straight', solutionRotation: 90 };
  }

  if (ports === 'E-N') {
    return { shape: 'curve', solutionRotation: 0 };
  }

  if (ports === 'E-S') {
    return { shape: 'curve', solutionRotation: 90 };
  }

  if (ports === 'S-W') {
    return { shape: 'curve', solutionRotation: 180 };
  }

  if (ports === 'N-W') {
    return { shape: 'curve', solutionRotation: 270 };
  }

  return { shape: 'curve', solutionRotation: 0 };
}

// Retorna as conexões internas entre portas para cada peça dada sua rotação
function getTileConnections(shape: TileShape, rotation: number): InternalConnection[] {
  const rotatePort = (port: 'N' | 'E' | 'S' | 'W', steps: number): 'N' | 'E' | 'S' | 'W' => {
    const ports: ('N' | 'E' | 'S' | 'W')[] = ['N', 'E', 'S', 'W'];
    const idx = ports.indexOf(port);
    return ports[(idx + steps) % 4];
  };

  const steps = Math.floor((rotation % 360) / 90);
  const basePairs: [('N' | 'E' | 'S' | 'W'), ('N' | 'E' | 'S' | 'W')][] = [];

  if (shape === 'curve') {
    // 0° conecta Norte (50, 0) a Leste (100, 50)
    basePairs.push(['N', 'E']);
  } else if (shape === 'straight') {
    // 0° conecta Norte (50, 0) a Sul (50, 100)
    basePairs.push(['N', 'S']);
  }

  const result: InternalConnection[] = [];
  basePairs.forEach(([p1, p2]) => {
    const r1 = rotatePort(p1, steps);
    const r2 = rotatePort(p2, steps);
    result.push({ from: r1, to: r2 });
    result.push({ from: r2, to: r1 });
  });

  return result;
}

// Algoritmo BFS para rastrear o fluxo contínuo de energia a partir do POW (linha 2, coluna 0, porta Oeste)
function computeCircuit(currentTiles: TileData[]): { energizedTiles: Set<number>; reachesBypass: boolean } {
  const energizedTiles = new Set<number>();
  const energizedPorts = new Set<string>();

  const startTile = currentTiles.find((t) => t.row === 2 && t.col === 0);
  if (!startTile) return { energizedTiles, reachesBypass: false };

  const queue: Array<{ row: number; col: number; port: 'N' | 'E' | 'S' | 'W' }> = [
    { row: 2, col: 0, port: 'W' },
  ];
  energizedPorts.add('2,0,W');

  const oppositePort: Record<'N' | 'E' | 'S' | 'W', 'N' | 'E' | 'S' | 'W'> = {
    N: 'S',
    S: 'N',
    E: 'W',
    W: 'E',
  };

  const delta: Record<'N' | 'E' | 'S' | 'W', [number, number]> = {
    N: [-1, 0],
    S: [1, 0],
    E: [0, 1],
    W: [0, -1],
  };

  while (queue.length > 0) {
    const { row, col, port } = queue.shift()!;
    const tile = currentTiles.find((t) => t.row === row && t.col === col);
    if (!tile) continue;

    const connections = getTileConnections(tile.shape, tile.rotation);
    const exits = connections.filter((c) => c.from === port).map((c) => c.to);

    if (exits.length > 0) {
      energizedTiles.add(tile.id);
    }

    for (const exitPort of exits) {
      const exitKey = `${row},${col},${exitPort}`;
      if (!energizedPorts.has(exitKey)) {
        energizedPorts.add(exitKey);

        const [dr, dc] = delta[exitPort];
        const nextRow = row + dr;
        const nextCol = col + dc;
        const nextEnteringPort = oppositePort[exitPort];

        if (nextRow >= 0 && nextRow < 3 && nextCol >= 0 && nextCol < 3) {
          const nextKey = `${nextRow},${nextCol},${nextEnteringPort}`;
          if (!energizedPorts.has(nextKey)) {
            energizedPorts.add(nextKey);
            queue.push({ row: nextRow, col: nextCol, port: nextEnteringPort });
          }
        }
      }
    }
  }

  // Verificar se o ponto de saída BYPASS (linha 1, coluna 2, porta Leste) foi energizado
  const reachesBypass = energizedPorts.has('1,2,E');
  return { energizedTiles, reachesBypass };
}

function buildSingleScramble(): TileData[] {
  const fallbackPaths: Cell[][] = [
    [[2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [1, 2]],
    [[2, 0], [1, 0], [1, 1], [1, 2]],
    [[2, 0], [2, 1], [2, 2], [1, 2]],
  ];
  const availablePaths: Cell[][] = ALL_VALID_PATHS.length > 0 ? ALL_VALID_PATHS : fallbackPaths;
  const chosenPath = availablePaths[Math.floor(Math.random() * availablePaths.length)];

  const pathMap = new Map<string, { enter: 'N' | 'E' | 'S' | 'W'; exit: 'N' | 'E' | 'S' | 'W' }>();

  for (let i = 0; i < chosenPath.length; i++) {
    const current = chosenPath[i];
    const enter = i === 0 ? 'W' : getDirection(current, chosenPath[i - 1]);
    const exit = i === chosenPath.length - 1 ? 'E' : getDirection(current, chosenPath[i + 1]);
    pathMap.set(`${current[0]},${current[1]}`, { enter, exit });
  }

  const decoyShapes: TileShape[] = ['curve', 'straight'];
  const tiles: TileData[] = [];

  let tileId = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const key = `${r},${c}`;
      const pathInfo = pathMap.get(key);

      let shape: TileShape;
      let solutionRotation: number;

      if (pathInfo) {
        const solved = getTileShapeAndSolution(pathInfo.enter, pathInfo.exit);
        shape = solved.shape;
        solutionRotation = solved.solutionRotation;
      } else {
        shape = decoyShapes[Math.floor(Math.random() * decoyShapes.length)];
        solutionRotation = Math.floor(Math.random() * 4) * 90;
      }

      // Embaralhar a rotação com offset obrigatório de +90°, +180° ou +270°
      const scrambleOffset = (Math.floor(Math.random() * 3) + 1) * 90;
      const initialRotation = (solutionRotation + scrambleOffset) % 360;

      tiles.push({
        id: tileId++,
        row: r,
        col: c,
        shape,
        rotation: initialRotation,
      });
    }
  }

  return tiles;
}

// Gerar tiles proceduralmente garantindo que comece com circuito aberto
function generateScrambledTiles(): TileData[] {
  let tiles: TileData[] = [];
  let attempts = 0;

  do {
    tiles = buildSingleScramble();
    attempts++;
  } while (computeCircuit(tiles).reachesBypass && attempts < 10);

  return tiles;
}

export const DivertPowerMinigame: React.FC<DivertPowerMinigameProps> = ({
  onComplete,
  onCancel,
  rooms = DEFAULT_FALLBACK_ROOMS,
}) => {
  const [stage, setStage] = useState<1 | 2>(1); // Etapa 1: Hotwire; Etapa 2: Disjuntores
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Salas ativas para o painel de disjuntores da Etapa 2
  const activeRooms = useMemo(() => {
    return rooms && rooms.length > 0 ? rooms : DEFAULT_FALLBACK_ROOMS;
  }, [rooms]);

  // Sala Alvo sorteada para redirecionamento
  const [targetRoomIndex, setTargetRoomIndex] = useState<number>(0);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * activeRooms.length);
    setTargetRoomIndex(randomIndex);
  }, [activeRooms]);

  // Estado dos disjuntores na Etapa 2
  const [breakerStates, setBreakerStates] = useState<boolean[]>(() =>
    new Array(activeRooms.length).fill(false)
  );

  // Grade 3x3 de peças da Etapa 1
  const [tiles, setTiles] = useState<TileData[]>(() => generateScrambledTiles());

  const isTransitioningRef = useRef<boolean>(false);

  // Áudio Sintetizado Web Audio API
  const playSound = useCallback((type: 'click' | 'rotate' | 'power_surge' | 'switch' | 'success') => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'rotate') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'switch') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'power_surge') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(480, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'success') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
          gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.1);
          osc.stop(ctx.currentTime + i * 0.1 + 0.4);
        });
      }
    } catch {}
  }, []);

  // Rastrear o fluxo contínuo de energia a partir do POW (linha 2, coluna 0, porta Oeste)
  const circuitState = useMemo(() => {
    return computeCircuit(tiles);
  }, [tiles]);

  // Rotacionar peça ao clicar (Etapa 1)
  const handleRotateTile = (id: number) => {
    if (stage !== 1 || isTransitioningRef.current) return;

    playSound('rotate');
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(15);
    }

    setTiles((prev) =>
      prev.map((t) => (t.id === id ? { ...t, rotation: (t.rotation + 90) % 360 } : t))
    );
  };

  // Reiniciar puzzle com novo preset se desejar
  const handleResetPuzzle = () => {
    if (stage !== 1 || isTransitioningRef.current) return;
    setTiles(generateScrambledTiles());
    playSound('rotate');
  };

  // Transição automática para Etapa 2 quando o circuito alcançar o BYPASS
  useEffect(() => {
    if (stage === 1 && circuitState.reachesBypass && !isTransitioningRef.current) {
      isTransitioningRef.current = true;
      playSound('power_surge');

      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([40, 80, 40, 80, 150]);
      }

      setTimeout(() => {
        setStage(2);
        isTransitioningRef.current = false;
      }, 800);
    }
  }, [stage, circuitState.reachesBypass, playSound]);

  // Manipulação de disjuntores (Etapa 2)
  const handleToggleBreaker = (index: number) => {
    if (stage !== 2 || isCompleted) return;

    playSound('switch');
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(30);
    }

    const newStates = [...breakerStates];
    newStates[index] = !newStates[index];
    setBreakerStates(newStates);

    // Se ligou o disjuntor da sala alvo
    if (index === targetRoomIndex && newStates[index] === true) {
      setIsCompleted(true);
      playSound('success');

      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([60, 50, 60, 50, 200]);
      }

      setTimeout(() => {
        onComplete();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 flex items-center justify-center select-none animate-in fade-in">
      <div className="w-full max-w-sm bg-slate-900 border-4 border-slate-700 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden flex flex-col items-center gap-3.5">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 left-3 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-950 border border-slate-800 transition-colors z-20 cursor-pointer shadow active:scale-95"
          title="Fechar Minigame"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header do Terminal */}
        <div className="text-center pt-1 pb-0 pl-10 pr-2 w-full">
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-600/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              ETAPA {stage} DE 2
            </span>
          </div>
          <h2
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
            className="text-xl uppercase tracking-wider text-slate-100 flex items-center justify-center gap-2 mt-1"
          >
            <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
            <span>DIRECIONAR ENERGIA</span>
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-400">
            {stage === 1
              ? 'Gire as conexões para ligar o circuito de POW até BYPASS'
              : 'Ative o disjuntor correspondente à sala solicitada no painel'}
          </p>
        </div>

        {/* ========================================================================= */}
        {/* ETAPA 1: HOTWIRE THE LOCK (GRADE 3x3 COM CURVAS RETAS EM ÂNGULO DE 90°)   */}
        {/* ========================================================================= */}
        {stage === 1 && (
          <div className="w-full flex flex-col items-center gap-3 animate-in fade-in duration-200">
            {/* Display CRT Superior com Estilo Retrô Ciano */}
            <div className="w-full bg-[#02111a] border-2 border-cyan-500/60 rounded-2xl p-2.5 flex items-center justify-between font-mono text-cyan-400 text-xs shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <div className="flex items-center gap-1.5 font-black uppercase tracking-wider">
                <Cpu className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>HOTWIRE THE LOCK</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetPuzzle}
                  className="p-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 text-[10px] flex items-center gap-1 transition active:scale-95"
                  title="Reiniciar Circuito"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Embaralhar</span>
                </button>
                <span className="text-[10px] text-cyan-300/90 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-700/60 font-bold">
                  {circuitState.reachesBypass ? 'CIRCUITO FECHADO!' : 'CIRCUITO ABERTO'}
                </span>
              </div>
            </div>

            {/* Container Principal da Grade 3x3 com Marcadores de Entrada e Saída */}
            <div className="relative w-full bg-[#010910] p-3 rounded-2xl border-2 border-cyan-900/80 shadow-2xl flex items-center justify-center">
              {/* Tag e Fio de Entrada POW (Alinhado com a linha 2 no lado esquerdo) */}
              <div className="absolute -left-2 bottom-[14%] z-30 flex items-center">
                <div className="bg-cyan-600 text-slate-950 font-mono font-black text-[9px] px-2 py-1 rounded-lg border border-cyan-300 shadow-[0_0_12px_#06b6d4] uppercase tracking-wider flex items-center gap-1 animate-pulse">
                  <span>POW</span>
                  <span>►</span>
                </div>
                <div className="w-2.5 h-3 bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
              </div>

              {/* Tag e Fio de Saída BYPASS (Alinhado com a linha 1 no lado direito) */}
              <div className="absolute -right-2 top-[44%] z-30 flex items-center">
                <div className="w-2.5 h-3 bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
                <div className="bg-cyan-600 text-slate-950 font-mono font-black text-[9px] px-2 py-1 rounded-lg border border-cyan-300 shadow-[0_0_12px_#06b6d4] uppercase tracking-wider flex items-center gap-1">
                  <span>►</span>
                  <span>BYPASS</span>
                </div>
              </div>

              {/* Grade 3x3 de Blocos de Circuito (Borda a borda perfeita, sem gaps) */}
              <div className="grid grid-cols-3 w-64 h-64 bg-[#020e18] border-2 border-cyan-500/40 rounded-xl overflow-hidden shadow-inner">
                {tiles.map((tile) => {
                  const isEnergized = circuitState.energizedTiles.has(tile.id);

                  return (
                    <button
                      key={tile.id}
                      type="button"
                      onClick={() => handleRotateTile(tile.id)}
                      className={`relative w-full h-full border border-cyan-900/40 transition-colors duration-150 flex items-center justify-center cursor-pointer active:scale-95 select-none ${
                        isEnergized
                          ? 'bg-[#042033]'
                          : 'bg-[#02101c] hover:bg-[#061e33]'
                      }`}
                    >
                      {/* Fiação em SVG de Borda a Borda (viewBox 0 0 100 100 sem padding) */}
                      <svg
                        viewBox="0 0 100 100"
                        className="w-full h-full block transition-transform duration-150 pointer-events-none"
                        style={{ transform: `rotate(${tile.rotation}deg)` }}
                      >
                        {/* =================================================== */}
                        {/* CURVA RETA (90°): Conecta exatamente (50, 0) a (100, 50) */}
                        {/* =================================================== */}
                        {tile.shape === 'curve' && (
                          <>
                            {/* Trilha do Condutor em Ângulo Reto */}
                            <path
                              d="M 50,0 L 50,50 L 100,50"
                              fill="none"
                              stroke={isEnergized ? '#06b6d4' : '#0e3a47'}
                              strokeWidth="18"
                              strokeLinecap="square"
                              strokeLinejoin="miter"
                            />
                            {/* Feixe Neon Interno */}
                            {isEnergized && (
                              <path
                                d="M 50,0 L 50,50 L 100,50"
                                fill="none"
                                stroke="#e0f2fe"
                                strokeWidth="8"
                                strokeLinecap="square"
                                strokeLinejoin="miter"
                              />
                            )}
                          </>
                        )}

                        {/* =================================================== */}
                        {/* RETA: Conecta exatamente (50, 0) a (50, 100)        */}
                        {/* =================================================== */}
                        {tile.shape === 'straight' && (
                          <>
                            {/* Trilha do Condutor */}
                            <line
                              x1="50"
                              y1="0"
                              x2="50"
                              y2="100"
                              stroke={isEnergized ? '#06b6d4' : '#0e3a47'}
                              strokeWidth="18"
                              strokeLinecap="square"
                            />
                            {/* Feixe Neon Interno */}
                            {isEnergized && (
                              <line
                                x1="50"
                                y1="0"
                                x2="50"
                                y2="100"
                                stroke="#e0f2fe"
                                strokeWidth="8"
                                strokeLinecap="square"
                              />
                            )}
                          </>
                        )}
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rodapé da Etapa 1 */}
            <div className="w-full text-center text-[11px] font-mono text-cyan-400/90 bg-[#02131f] p-2 rounded-xl border border-cyan-900/60">
              {circuitState.reachesBypass ? (
                <span className="text-cyan-300 font-black animate-pulse flex items-center justify-center gap-1.5">
                  <Zap className="w-4 h-4 fill-cyan-300" />
                  <span>CIRCUITO CONECTADO! REDIRECIONANDO ENERGIA...</span>
                </span>
              ) : (
                'Toque nas peças para girar 90° e formar um fio contínuo de POW até BYPASS'
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ETAPA 2: PAINEL INDUSTRIAL DE DISJUNTORES (FIEL À IMAGEM 2)                */}
        {/* ========================================================================= */}
        {stage === 2 && (
          <div className="w-full flex flex-col items-center gap-3.5 animate-in slide-in-from-right duration-200">
            {/* Chassi Metálico Industrial (Estilo Caixa de Disjuntores Imagem 2) */}
            <div className="w-full bg-[#3d3a36] border-4 border-[#242220] rounded-2xl p-4 shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_15px_30px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col items-center gap-4">
              {/* Tubulações decorativas de fundo (Estilo Imagem 2: canos vermelho e azul) */}
              <div className="absolute -top-3 -right-3 w-16 h-16 border-t-8 border-r-8 border-red-900/40 rounded-tr-2xl pointer-events-none" />
              <div className="absolute -bottom-3 -right-3 w-16 h-16 border-b-8 border-r-8 border-blue-900/40 rounded-br-2xl pointer-events-none" />

              {/* Display LCD Dot-Matrix Âmbar Embutido no Painel */}
              <div className="w-full bg-[#171109] border-3 border-[#262016] rounded-xl p-3 shadow-[inset_0_3px_8px_rgba(0,0,0,0.9)] text-center relative overflow-hidden">
                {/* Grade de Pixels / Scanline */}
                <div className="absolute inset-0 bg-[radial-gradient(#f59e0b_0.75px,transparent_0.75px)] [background-size:6px_6px] opacity-15 pointer-events-none" />
                
                <span className="text-[10px] font-mono font-bold tracking-widest text-amber-500/70 block uppercase">
                  REDIRECIONAR ENERGIA PARA:
                </span>
                <div
                  style={{ fontFamily: 'var(--font-anton), Anton, monospace' }}
                  className="text-lg uppercase tracking-wider text-amber-300 drop-shadow-[0_0_8px_#f59e0b] mt-0.5 animate-pulse"
                >
                  {targetRoomIndex < 9 ? `0${targetRoomIndex + 1}` : targetRoomIndex + 1} - {activeRooms[targetRoomIndex]?.name}
                </div>
              </div>

              {/* Grid de Disjuntores Mecânicos 3D (2 Colunas, Estilo Imagem 2) */}
              <div className="w-full bg-[#2e2c29] p-3 rounded-xl border-2 border-[#201e1c] shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] max-h-64 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {activeRooms.map((room, idx) => {
                    const isOn = breakerStates[idx] || false;
                    const isTarget = idx === targetRoomIndex;

                    return (
                      <div
                        key={room.id || idx}
                        onClick={() => handleToggleBreaker(idx)}
                        className="flex flex-col gap-1 cursor-pointer select-none group"
                      >
                        {/* Linha Principal do Disjuntor: [Número + LED] + [Fenda Deslizante com Bloco 3D] */}
                        <div className="flex items-center gap-2">
                          {/* Coluna Esquerda: Número + Lâmpada LED Quadrada */}
                          <div className="flex flex-col items-center gap-0.5 shrink-0">
                            <span className="text-[10px] font-mono font-bold text-[#b5b0a8]">
                              {idx < 9 ? `0${idx + 1}` : idx + 1}
                            </span>
                            {/* Lâmpada Quadrada (Off: Escura, On: Âmbar Brilhante) */}
                            <div
                              className={`w-3.5 h-3.5 rounded-[2px] border transition-all ${
                                isOn
                                  ? isTarget
                                    ? 'bg-[#fff5a0] border-white shadow-[0_0_12px_#f59e0b]'
                                    : 'bg-amber-400 border-amber-200 shadow-[0_0_8px_#d97706]'
                                  : 'bg-[#1e1c1a] border-[#383430]'
                              }`}
                            />
                          </div>

                          {/* Fenda Retangular Recuada com Chave Mecânica Deslizante 3D */}
                          <div className="flex-1 h-9 bg-[#181614] border-2 border-[#262422] rounded-[3px] p-0.5 relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] flex items-center">
                            {/* Bloco Mecânico 3D Deslizante */}
                            <div
                              style={{
                                transform: isOn ? 'translateX(calc(100% + 4px))' : 'translateX(0px)',
                              }}
                              className={`w-7 h-7 rounded-[2px] border-t border-l border-[#8a857e] border-b-2 border-r-2 border-[#1c1a18] shadow-[2px_2px_4px_rgba(0,0,0,0.7)] transition-transform duration-150 relative flex items-center justify-center ${
                                isOn
                                  ? isTarget
                                    ? 'bg-gradient-to-r from-[#5a6b5a] via-[#758a75] to-[#455245]'
                                    : 'bg-gradient-to-r from-[#6b6762] via-[#858079] to-[#595550]'
                                  : 'bg-gradient-to-r from-[#595550] via-[#757069] to-[#474440]'
                              }`}
                            >
                              {/* Ranhuras de aderência na manopla do disjuntor */}
                              <div className="w-1 h-4 bg-[#2e2c29] rounded-[1px] opacity-60" />
                            </div>
                          </div>
                        </div>

                        {/* Nome da Sala por Extenso (Sem corte/reticências) */}
                        <div className="pl-6">
                          <span
                            className={`text-[10px] font-mono leading-tight block truncate transition-colors ${
                              isOn && isTarget
                                ? 'text-amber-300 font-bold'
                                : 'text-[#a39e96]'
                            }`}
                            title={room.name}
                          >
                            {room.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status / Conclusão */}
              {isCompleted ? (
                <div className="w-full py-2.5 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
                  <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                  <span>ENERGIA REDIRECIONADA COM SUCESSO!</span>
                </div>
              ) : (
                <div className="text-[11px] font-mono text-amber-200/90 text-center bg-[#24211e] px-3 py-1.5 rounded-lg border border-[#383430] w-full">
                  Puxe o disjuntor da sala <strong className="text-amber-300">{activeRooms[targetRoomIndex]?.name}</strong> para ligar
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
