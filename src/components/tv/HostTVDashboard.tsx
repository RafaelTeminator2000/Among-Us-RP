'use client';

import React, { useEffect, useState } from 'react';
import { useRealtimeGame } from '@/lib/realtime-game';
import { useGameAudio } from '@/hooks/use-game-audio';
import { Shield, AlertTriangle, Users, CheckCircle2, Volume2, VolumeX, Radio, Zap, FastForward } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PlayerGameState } from '@/types/game';
import { GameSummaryPanel, GameEventRecord } from '@/components/tv/GameSummaryPanel';

interface TVDashboardProps {
  roomId: string;
  roomCode?: string;
  initialPlayers?: PlayerGameState[];
}

export function HostTVDashboard({ roomId, roomCode: propRoomCode, initialPlayers = [] }: TVDashboardProps) {
  const [players, setPlayers] = useState<PlayerGameState[]>(initialPlayers);
  const [gameState, setGameState] = useState<'LOBBY' | 'PLAYING' | 'EMERGENCY_MEETING' | 'ENDED' | 'FINISHED'>('LOBBY');
  const [taskCount, setTaskCount] = useState<number>(4);
  const [isLightsSabotaged, setIsLightsSabotaged] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [gameEvents, setGameEvents] = useState<GameEventRecord[]>([]);
  const [displayCode, setDisplayCode] = useState<string>(propRoomCode || roomId.substring(0, 4).toUpperCase());

  const { initAudio, playSiren, playEmergencyBuzzer, stopAll } = useGameAudio();
  const supabase = createClient();

  // Carregar estado inicial da sala e jogadores no Supabase
  useEffect(() => {
    const isValidUuid = (str?: string) =>
      typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const fetchInitialTVData = async () => {
      let targetUuid = roomId;

      if (!isValidUuid(roomId)) {
        const { data: roomByCode } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', roomId.toUpperCase())
          .maybeSingle();

        if (roomByCode) {
          targetUuid = roomByCode.id;
          if (roomByCode.code) setDisplayCode(roomByCode.code);
          if (roomByCode.status) setGameState(roomByCode.status as any);
          if (roomByCode.rules) {
            const tc = (roomByCode.rules as any).task_count || (roomByCode.rules as any).taskCount;
            if (tc) setTaskCount(Number(tc));
          }
          if ((roomByCode as any).is_lights_sabotaged) setIsLightsSabotaged(true);
        }
      } else {
        const { data: room } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .maybeSingle();

        if (room) {
          if (room.code) setDisplayCode(room.code);
          if (room.status) setGameState(room.status as any);
          if (room.rules) {
            const tc = (room.rules as any).task_count || (room.rules as any).taskCount;
            if (tc) setTaskCount(Number(tc));
          }
          if ((room as any).is_lights_sabotaged) setIsLightsSabotaged(true);
        }
      }

      if (isValidUuid(targetUuid)) {
        // Buscar jogadores cadastrados
        const { data: playersData } = await supabase
          .from('room_players')
          .select('id, player_name, color_hex, role, status, completed_tasks')
          .eq('room_id', targetUuid);

        if (playersData && playersData.length > 0) {
          const formatted: PlayerGameState[] = playersData.map((p) => ({
            id: p.id,
            nickname: p.player_name,
            color: p.color_hex || '#3b82f6',
            role: p.role as any,
            is_alive: p.status === 'ALIVE',
            is_host: false,
            completed_tasks: Array.isArray(p.completed_tasks) ? p.completed_tasks.length : 0,
            total_tasks: taskCount,
            has_voted: false,
            voted_for_id: null,
          }));
          setPlayers(formatted);
        }

        // Buscar histórico de eventos da sala para estatísticas finais
        const { data: eventsData } = await supabase
          .from('game_events')
          .select('*')
          .eq('room_id', targetUuid)
          .order('created_at', { ascending: true });

        if (eventsData) {
          setGameEvents(eventsData as GameEventRecord[]);
        }
      }
    };

    fetchInitialTVData();
  }, [roomId, supabase]);

  // Buscar eventos atualizados sempre que o estado transitar para ENDED ou FINISHED
  useEffect(() => {
    if (gameState === 'ENDED' || gameState === 'FINISHED') {
      stopAll(); // Parar todos os alarmes

      const fetchEvents = async () => {
        const isValidUuid = (str?: string) =>
          typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        let targetUuid = roomId;
        if (!isValidUuid(roomId)) {
          const { data: roomByCode } = await supabase
            .from('rooms')
            .select('id')
            .eq('code', roomId.toUpperCase())
            .maybeSingle();
          if (roomByCode) targetUuid = roomByCode.id;
        }

        if (!isValidUuid(targetUuid)) return;

        const { data: eventsData } = await supabase
          .from('game_events')
          .select('*')
          .eq('room_id', targetUuid)
          .order('created_at', { ascending: true });

        if (eventsData) {
          setGameEvents(eventsData as GameEventRecord[]);
        }
      };

      fetchEvents();
    }
  }, [gameState, roomId, stopAll, supabase]);

  // Hook de Sincronização em Tempo Real (latência < 50ms)
  const { latency } = useRealtimeGame({
    roomId,
    playerName: 'Telão Central (TV)',
    playerRole: null,
    isAlive: true,
    onGameStarted: (payload) => {
      const tc = payload?.rules?.taskCount || payload?.rules?.task_count;
      if (tc) setTaskCount(Number(tc));
    },
    onRoomStatusChanged: (newStatus) => {
      setGameState(newStatus as any);
    },
    onSabotageTriggered: (payload) => {
      if (!payload || payload.type === 'LIGHTS') {
        setIsLightsSabotaged(true);
      }
    },
    onSabotageFixed: () => {
      setIsLightsSabotaged(false);
    },
    onTaskCompleted: (payload) => {
      if (payload && payload.playerId) {
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === payload.playerId
              ? {
                  ...p,
                  completed_tasks: payload.completedCount ?? (typeof p.completed_tasks === 'number' ? p.completed_tasks + 1 : 1),
                }
              : p
          )
        );
      }
    },
    onEmergencyMeeting: () => {
      setGameState('EMERGENCY_MEETING');
    },
    onPlayersPresenceChanged: (presencePlayers) => {
      if (presencePlayers.length > 0) {
        setPlayers((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          presencePlayers.forEach((p) => {
            if (map.has(p.id)) {
              const existing = map.get(p.id)!;
              existing.is_alive = p.is_alive;
            } else {
              map.set(p.id, {
                id: p.id,
                nickname: p.name,
                color: p.color_hex || '#ef4444',
                role: p.role,
                is_alive: p.is_alive,
                is_host: false,
                completed_tasks: 0,
                total_tasks: taskCount,
                has_voted: false,
                voted_for_id: null,
              });
            }
          });
          return Array.from(map.values());
        });
      }
    },
  });

  // Sincronizar atualizações da tabela room_players em tempo real para a TV
  useEffect(() => {
    const isValidUuid = (str?: string) =>
      typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (!roomId || !isValidUuid(roomId)) return;

    const channel = supabase
      .channel(`tv_players_sync_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_players',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new as any;
            const tasksCount = Array.isArray(updated.completed_tasks)
              ? updated.completed_tasks.length
              : typeof updated.completed_tasks === 'number'
              ? updated.completed_tasks
              : 0;

            setPlayers((prev) =>
              prev.map((p) =>
                p.id === updated.id
                  ? {
                      ...p,
                      completed_tasks: tasksCount,
                      is_alive: updated.status === 'ALIVE',
                      role: updated.role || p.role,
                    }
                  : p
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  // Habilitar áudio na TV mediante interação
  const handleEnableAudio = () => {
    initAudio();
    setAudioEnabled(true);
  };

  // Gerenciar sirene/buzzer reativo baseado no estado do jogo e áudio ativado
  useEffect(() => {
    if (!audioEnabled) return;

    if (gameState === 'ENDED' || gameState === 'FINISHED') {
      stopAll();
      return;
    }

    if (gameState === 'EMERGENCY_MEETING') {
      playEmergencyBuzzer();
    } else if (isLightsSabotaged) {
      playSiren();
    } else {
      stopAll();
    }

    return () => stopAll();
  }, [gameState, isLightsSabotaged, audioEnabled, playSiren, playEmergencyBuzzer, stopAll]);

  // Se o jogo estiver finalizado, renderizar o Painel de Estatísticas Finais pós-jogo
  if (gameState === 'ENDED' || gameState === 'FINISHED') {
    const impostorsAlive = players.filter((p) => p.role === 'IMPOSTOR' && p.is_alive).length;
    const winnerTeam = impostorsAlive > 0 ? 'IMPOSTOR' : 'CREWMATE';

    return (
      <GameSummaryPanel
        roomId={roomId}
        players={players}
        events={gameEvents}
        winnerTeam={winnerTeam}
        onReturnToLobby={() => setGameState('LOBBY')}
      />
    );
  }

  // Recálculo dinâmico anti-deadlock de tarefas considerando APENAS jogadores vivos
  const alivePlayers = players.filter((p) => p.is_alive);
  const totalTasks = Math.max(1, (alivePlayers.length > 0 ? alivePlayers.length : 1) * taskCount);
  const completedTasks = alivePlayers.reduce((acc, curr) => acc + (curr.completed_tasks || 0), 0);
  const taskProgress = Math.min(100, Math.round((completedTasks / totalTasks) * 100));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 lg:p-12 flex flex-col justify-between font-sans antialiased overflow-hidden select-none">
      {/* HEADER DE ALTA DENSIDADE */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Radio className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
              PROJEÇÃO CENTRAL • PAINEL DA TV
            </span>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white mt-0.5">
              SALA DE CONTROLE: #{displayCode}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Botão de Ativação do Áudio Sintetizado */}
          <button
            onClick={handleEnableAudio}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold font-mono flex items-center gap-2 transition-all cursor-pointer ${
              audioEnabled
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                : 'bg-amber-950/80 border-amber-500/60 text-amber-300 animate-bounce shadow-[0_0_20px_rgba(245,158,11,0.3)]'
            }`}
          >
            {audioEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Áudio Ativo</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-amber-400" />
                <span>Clique p/ Ativar Som</span>
              </>
            )}
          </button>

          <div className="bg-slate-900/90 border border-slate-800 px-5 py-2.5 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block uppercase font-mono">Sobreviventes</span>
            <span className="text-xl font-black text-cyan-400 font-mono">
              {alivePlayers.length}/{players.length}
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 px-5 py-2.5 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block uppercase font-mono">Estado do Jogo</span>
            <span
              className={`text-xl font-black font-mono ${
                gameState === 'PLAYING'
                  ? 'text-emerald-400'
                  : gameState === 'EMERGENCY_MEETING'
                  ? 'text-red-400'
                  : 'text-amber-400'
              }`}
            >
              {gameState}
            </span>
          </div>
        </div>
      </div>

      {/* CORE LAYOUT DA TRANSMISSÃO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 my-8 flex-1 items-stretch">
        {/* COLUNA 1 & 2: MONITOR DE TAREFAS E ALARMES */}
        <div className="lg:col-span-2 flex flex-col justify-between bg-slate-900/40 border border-slate-800/80 p-8 rounded-3xl relative overflow-hidden shadow-2xl backdrop-blur-md">
          {isLightsSabotaged && (
            <div className="absolute inset-0 bg-red-950/20 border-2 border-red-500 animate-pulse pointer-events-none" />
          )}

          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3 mb-6 text-slate-100">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" /> Progresso Global de Tarefas
            </h2>
            <div className="w-full bg-slate-950 h-12 rounded-2xl border border-slate-800 p-1.5 overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-400 rounded-xl transition-all duration-700 ease-out flex items-center justify-end pr-4 font-mono font-black text-base text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                style={{ width: `${taskProgress}%` }}
              >
                {taskProgress}%
              </div>
            </div>
            <div className="flex justify-between items-center text-xs font-mono text-slate-400 mt-3 px-1">
              <span>{completedTasks} de {totalTasks} Tarefas Concluídas</span>
              <span>Tripulantes Vivos: {alivePlayers.length}</span>
            </div>
          </div>

          {/* ESTADO DE ALERTA ATIVO NA NAVE */}
          {gameState === 'EMERGENCY_MEETING' ? (
            <div className="flex items-center justify-between bg-red-950/90 border border-red-600/80 p-6 rounded-2xl mt-6 shadow-[0_0_40px_rgba(239,68,68,0.3)]">
              <div className="flex items-center gap-5">
                <AlertTriangle className="w-12 h-12 text-red-400 shrink-0 animate-bounce" />
                <div>
                  <h3 className="text-2xl font-black text-red-200 uppercase tracking-wide">
                    REUNIÃO DE EMERGÊNCIA CONVOCADA
                  </h3>
                  <p className="text-sm text-red-300/90 mt-1">
                    Todos os tripulantes dirigem-se imediatamente à Mesa Central!
                  </p>
                </div>
              </div>

              <button
                onClick={async () => {
                  const channelTopic = `room:${roomId.toLowerCase()}:game_flow`;
                  const ch = supabase.channel(channelTopic);
                  await ch.send({
                    type: 'broadcast',
                    event: 'SKIP_DISCUSSION',
                    payload: { timestamp: Date.now() },
                  });
                }}
                className="px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl border border-purple-400/60 shadow-xl cursor-pointer active:scale-95 transition-all flex items-center gap-2"
              >
                <FastForward className="w-4 h-4 text-purple-200" />
                <span>Pular Discussão (Abrir Votação)</span>
              </button>
            </div>
          ) : isLightsSabotaged ? (
            <div className="flex items-center gap-5 bg-yellow-950/80 border border-yellow-500/80 p-6 rounded-2xl mt-6 animate-pulse shadow-[0_0_40px_rgba(245,158,11,0.3)]">
              <Zap className="w-12 h-12 text-yellow-400 shrink-0 animate-bounce" />
              <div>
                <h3 className="text-2xl font-black text-yellow-200 uppercase tracking-wide">
                  ⚡ SABOTAGEM DETECTADA: ESCURIDÃO TOTAL
                </h3>
                <p className="text-sm text-yellow-300/90 mt-1">
                  As luzes físicas foram cortadas. Localizem o Gerador Elétrico e armem os disjuntores!
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-5 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl mt-6">
              <Shield className="w-12 h-12 text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-xl font-bold text-slate-100">Sistemas Operacionais Normais</h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  Nenhuma anomalia crítica detectada no salão presencial.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* COLUNA 3: MONITOR DE JOGADORES ATIVOS */}
        <div className="bg-slate-900/50 border border-slate-800/80 p-6 rounded-3xl flex flex-col backdrop-blur-md shadow-2xl">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2.5 text-slate-200">
            <Users className="w-5 h-5 text-cyan-400" /> Tripulantes e Integrantes
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[420px]">
            {players.length > 0 ? (
              players.map((p) => (
                <div
                  key={p.id}
                  className={`p-3.5 rounded-2xl flex items-center justify-between transition-colors border ${
                    p.is_alive
                      ? 'bg-slate-950/70 border-slate-800 text-slate-200'
                      : 'bg-slate-950/30 border-slate-900/60 text-slate-600 line-through'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-900 shrink-0"
                      style={{ backgroundColor: p.color || '#3b82f6' }}
                    />
                    <span className="font-bold text-sm tracking-wide">{p.nickname}</span>
                  </div>

                  <span
                    className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase ${
                      p.is_alive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {p.is_alive ? 'VIVO' : 'ELIMINADO'}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-xs text-slate-500 py-12">
                Aguardando participantes entrarem na sala...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="border-t border-slate-900 pt-5 flex items-center justify-between text-xs text-slate-500 font-mono">
        <span>AMONG US RP PHYGITAL • PLATAFORMA DE AUTOMAÇÃO DE TELÃO</span>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>REALTIME WS // LATÊNCIA: {latency !== null ? `${latency}ms` : '<50ms'}</span>
        </div>
      </div>
    </div>
  );
}
