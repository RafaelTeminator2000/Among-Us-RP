'use client';

import React, { useEffect, useState } from 'react';
import { useRealtimeGame } from '@/lib/realtime-game';
import { useGameAudio } from '@/hooks/use-game-audio';
import { Shield, AlertTriangle, Users, CheckCircle2, Volume2, VolumeX, Radio, Zap, FastForward, Atom, Wind } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PlayerGameState } from '@/types/game';
import { GameSummaryPanel, GameEventRecord } from '@/components/tv/GameSummaryPanel';
import { SabotageType } from '@/components/game/ImpostorActionDrawer';

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
  const [activeSabotageType, setActiveSabotageType] = useState<SabotageType | null>(null);
  const [sabotageSecondsLeft, setSabotageSecondsLeft] = useState<number | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [gameEvents, setGameEvents] = useState<GameEventRecord[]>([]);
  const [displayCode, setDisplayCode] = useState<string>(propRoomCode || roomId.substring(0, 4).toUpperCase());
  const [winnerTeam, setWinnerTeam] = useState<'CREWMATE' | 'IMPOSTOR' | null>(null);
  const [isRoomClosed, setIsRoomClosed] = useState(false);

  const { initAudio, playSiren, playEmergencyBuzzer, stopAll } = useGameAudio();
  const supabase = createClient();

  const isValidUuid = (str?: string) =>
    typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  // Carregar estado inicial da sala e jogadores no Supabase
  useEffect(() => {

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

  // Hook de Sincronização em Tempo Real (WebSocket Supabase)
  const { connectionState } = useRealtimeGame({
    roomId,
    roomCode: displayCode || (!isValidUuid(roomId) ? roomId.toUpperCase() : undefined),
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
    onCrewmateVictory: (payload) => {
      setWinnerTeam('CREWMATE');
      setGameState('ENDED');
    },
    onImpostorVictory: (payload) => {
      setWinnerTeam('IMPOSTOR');
      setGameState('ENDED');
    },
    onSabotageTriggered: (payload) => {
      const type = ((payload?.type || 'LIGHTS') as string).toUpperCase() as SabotageType;
      setActiveSabotageType(type);
      if (type === 'LIGHTS') {
        setIsLightsSabotaged(true);
      } else if (type === 'COMMS') {
        setIsLightsSabotaged(false);
      } else if (type === 'REACTOR' || type === 'O2') {
        setIsLightsSabotaged(false);
        setSabotageSecondsLeft(45);
      }
    },
    onSabotageFixed: () => {
      setActiveSabotageType(null);
      setIsLightsSabotaged(false);
      setSabotageSecondsLeft(null);
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
          presencePlayers.forEach((p: any) => {
            const pid = (p.id || p.playerId || '').toString();
            const pName = (p.name || p.player_name || p.playerName || '').toString().toLowerCase();

            // Ignorar presenças de sistema (Telão da TV e Console do Host)
            if (
              pid.startsWith('tv_') ||
              pid.startsWith('host_') ||
              pName.includes('telão central') ||
              pName.includes('telao central') ||
              pName.includes('tv') ||
              p.is_system === true
            ) {
              return;
            }

            if (map.has(p.id)) {
              const existing = map.get(p.id)!;
              existing.is_alive = p.is_alive !== false;
            } else {
              map.set(p.id, {
                id: p.id,
                nickname: p.name || p.player_name || 'Tripulante',
                color: p.color_hex || '#ef4444',
                role: p.role,
                is_alive: p.is_alive !== false,
                is_host: false,
                completed_tasks: 0,
                total_tasks: taskCount,
                has_voted: false,
                voted_for_id: null,
              });
            }
          });

          // Filtrar qualquer resquício de Telão da TV ou Host no array final
          return Array.from(map.values()).filter((p) => {
            const name = (p.nickname || '').toLowerCase();
            const id = (p.id || '').toString();
            return (
              !id.startsWith('tv_') &&
              !id.startsWith('host_') &&
              !name.includes('telão central') &&
              !name.includes('telao central')
            );
          });
        });
      }
    },
    onRoomClosed: () => {
      stopAll();
      setIsRoomClosed(true);
      setTimeout(() => {
        window.location.href = '/';
      }, 4000);
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
          if (payload.eventType === 'INSERT' && payload.new) {
            const inserted = payload.new as any;
            const pName = (inserted.player_name || '').toString().toLowerCase();
            if (pName.includes('telão central') || pName.includes('telao central')) return;

            setPlayers((prev) => {
              if (prev.some((p) => p.id === inserted.id)) return prev;
              return [
                ...prev,
                {
                  id: inserted.id,
                  nickname: inserted.player_name || 'Tripulante',
                  color: inserted.color_hex || '#ef4444',
                  role: inserted.role || null,
                  is_alive: inserted.status === 'ALIVE',
                  is_host: false,
                  completed_tasks: 0,
                  total_tasks: taskCount,
                  has_voted: false,
                  voted_for_id: null,
                },
              ];
            });
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE' && payload.new) {
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

  // Gerenciar sirene/buzzer reativo (Sirene contínua APENAS em sabotagens críticas: Reator e O2)
  useEffect(() => {
    if (!audioEnabled) return;

    if (gameState === 'ENDED' || gameState === 'FINISHED') {
      stopAll();
      return;
    }

    if (gameState === 'EMERGENCY_MEETING') {
      playEmergencyBuzzer();
    } else if (activeSabotageType === 'REACTOR' || activeSabotageType === 'O2') {
      playSiren();
    } else {
      stopAll();
    }

    return () => stopAll();
  }, [gameState, activeSabotageType, audioEnabled, playSiren, playEmergencyBuzzer, stopAll]);

  // Auto-retorno da TV ao Lobby após finalização da partida (10s para visualização do sumário)
  useEffect(() => {
    if (gameState !== 'ENDED' && gameState !== 'FINISHED') return;

    const timer = setTimeout(() => {
      setWinnerTeam(null);
      setGameState('LOBBY');
    }, 10000);

    return () => clearTimeout(timer);
  }, [gameState]);

  // Se a sala tiver sido encerrada pelo Host
  if (isRoomClosed) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8 flex flex-col items-center justify-center font-sans select-none text-center animate-in fade-in">
        <div className="w-full max-w-lg bg-slate-900 border-2 border-red-500/80 rounded-3xl p-10 shadow-2xl space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400 mx-auto animate-pulse">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-wider text-white">
            SESSÃO FINALIZADA PELO DIRETOR
          </h2>
          <p className="text-sm text-slate-400">
            A sala foi encerrada pelo Host. Redirecionando para a tela inicial...
          </p>
        </div>
      </div>
    );
  }

  // Se o jogo estiver finalizado, renderizar o Painel de Estatísticas Finais pós-jogo
  if (gameState === 'ENDED' || gameState === 'FINISHED') {
    const impostorsAlive = players.filter((p) => p.role === 'IMPOSTOR' && p.is_alive).length;
    const finalWinnerTeam = winnerTeam || (impostorsAlive > 0 ? 'IMPOSTOR' : 'CREWMATE');

    return (
      <GameSummaryPanel
        roomId={roomId}
        players={players}
        events={gameEvents}
        winnerTeam={finalWinnerTeam}
        onReturnToLobby={() => {
          setWinnerTeam(null);
          setGameState('LOBBY');
        }}
      />
    );
  }

  // Recálculo dinâmico de tarefas considerando APENAS tripulantes (denominador fixo pela contagem total)
  const alivePlayers = players.filter((p) => p.is_alive);
  const crewmates = players.filter((p) => p.role !== 'IMPOSTOR');
  const aliveCrewmates = crewmates.filter((p) => p.is_alive);
  const totalCrewmates = crewmates.length > 0 ? crewmates.length : Math.max(1, players.length);
  const totalTasks = Math.max(1, totalCrewmates * taskCount);
  const completedTasks = crewmates.reduce((acc, curr) => {
    const count = typeof curr.completed_tasks === 'number' ? curr.completed_tasks : 0;
    return acc + count;
  }, 0);
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
              <span>Tripulantes Vivos: {aliveCrewmates.length}</span>
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
          ) : activeSabotageType === 'REACTOR' ? (
            <div className="flex items-center gap-5 bg-red-950/90 border-2 border-red-500 p-6 rounded-2xl mt-6 animate-pulse shadow-[0_0_50px_rgba(239,68,68,0.5)]">
              <Atom className="w-14 h-14 text-red-400 shrink-0 animate-spin" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-red-200 uppercase tracking-wide">
                    ☢️ ALERTA CRÍTICO: FUSÃO DO REATOR!
                  </h3>
                  {sabotageSecondsLeft !== null && (
                    <span className="text-3xl font-black text-amber-300 font-mono">
                      {sabotageSecondsLeft}s
                    </span>
                  )}
                </div>
                <p className="text-sm text-red-300/90 mt-1 font-mono">
                  Sobrecarga fatal detectada! Tripulantes devem ir à Sala do Reator para estabilizar o núcleo.
                </p>
              </div>
            </div>
          ) : activeSabotageType === 'O2' ? (
            <div className="flex items-center gap-5 bg-cyan-950/90 border-2 border-cyan-500 p-6 rounded-2xl mt-6 animate-pulse shadow-[0_0_50px_rgba(6,182,212,0.5)]">
              <Wind className="w-14 h-14 text-cyan-400 shrink-0 animate-bounce" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-cyan-200 uppercase tracking-wide">
                    💨 ALERTA CRÍTICO: FALHA DE OXIGÊNIO!
                  </h3>
                  {sabotageSecondsLeft !== null && (
                    <span className="text-3xl font-black text-amber-300 font-mono">
                      {sabotageSecondsLeft}s
                    </span>
                  )}
                </div>
                <p className="text-sm text-cyan-300/90 mt-1 font-mono">
                  Esgotamento de suporte de vida! Limpem os filtros ou digitem o código na Sala de O2.
                </p>
              </div>
            </div>
          ) : activeSabotageType === 'COMMS' ? (
            <div className="flex items-center gap-5 bg-purple-950/90 border border-purple-500/80 p-6 rounded-2xl mt-6 animate-pulse shadow-[0_0_40px_rgba(147,51,234,0.4)]">
              <Radio className="w-12 h-12 text-purple-400 shrink-0 animate-pulse" />
              <div>
                <h3 className="text-2xl font-black text-purple-200 uppercase tracking-wide">
                  📡 INTERFERÊNCIA: COMUNICAÇÕES OFFLINE
                </h3>
                <p className="text-sm text-purple-300/90 mt-1">
                  Sinal bloqueado. Listas de tarefas e radares ocultos até que a frequência seja restabelecida!
                </p>
              </div>
            </div>
          ) : isLightsSabotaged || activeSabotageType === 'LIGHTS' ? (
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
          <span
            className={`w-2 h-2 rounded-full ${
              connectionState === 'CONNECTED'
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                : 'bg-red-500 animate-pulse'
            }`}
          />
          <span>
            SISTEMA OPERACIONAL // STATUS: {connectionState === 'CONNECTED' ? 'ONLINE' : 'RECONECTANDO'}
          </span>
        </div>
      </div>
    </div>
  );
}
