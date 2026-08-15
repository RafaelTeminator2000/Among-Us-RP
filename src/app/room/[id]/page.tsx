'use client';

import React, { useState, useEffect, use } from 'react';
import { useRealtimeGame } from '@/lib/realtime-game';
import { ConnectionStatusHUD } from '@/components/game/ConnectionStatusHUD';

import { createClient } from '@/lib/supabase/client';
import { GameMapHUD } from '@/components/GameMapHUD';
import { ImpostorKillButton } from '@/components/game/ImpostorKillButton';
import { VotingSessionScreen } from '@/components/game/VotingSessionScreen';
import { EliminationScreen } from '@/components/minigames/EliminationScreen';
import { TaskQrReader } from '@/components/minigames/TaskQrReader';
import { WireMinigame } from '@/components/minigames/WireMinigame';
import { DarknessOverlay } from '@/components/game/DarknessOverlay';
import { BreakerMinigame } from '@/components/minigames/BreakerMinigame';
import { ScratchMapPlan, TaskNode, DEFAULT_DEMO_MAP } from '@/types/grid-editor';
import { PlayerGameState } from '@/types/game';
import { Users, Shield, Skull, AlertTriangle, CheckCircle2, Play, QrCode, Wrench, X, RefreshCw, Zap } from 'lucide-react';

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { id: roomId } = use(params);

  const isValidUuid = (str?: string) =>
    typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  const [roomStatus, setRoomStatus] = useState<'LOBBY' | 'PLAYING' | 'EMERGENCY_MEETING' | 'ENDED'>('LOBBY');
  const [playerStatus, setPlayerStatus] = useState<'ALIVE' | 'ELIMINATED'>('ALIVE');
  const [playerRole, setPlayerRole] = useState<'CREWMATE' | 'IMPOSTOR' | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('Jogador');
  const [playerColor, setPlayerColor] = useState<string>('#ef4444');
  const [allPlayers, setAllPlayers] = useState<PlayerGameState[]>([]);
  const [mapData, setMapData] = useState<ScratchMapPlan | null>(null);

  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [isSabotaged, setIsSabotaged] = useState<boolean>(false);
  const [isLightsSabotaged, setIsLightsSabotaged] = useState<boolean>(false);
  const [showBreakerGame, setShowBreakerGame] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);
  const [activeMinigame, setActiveMinigame] = useState<'qr' | 'wires' | null>(null);
  const [taskFeedback, setTaskFeedback] = useState<string | null>(null);

  const supabase = createClient();

  // 1. Carregar dados iniciais da sala e do jogador na sessão atual
  useEffect(() => {
    const isValidUuid = (str?: string) =>
      typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const initSession = async () => {
      // Recuperar o ID, Nome e Cor do jogador salvos no localStorage durante o Guest Join
      const storedPlayerId =
        localStorage.getItem(`room_player_${roomId}`) ||
        localStorage.getItem('current_player_id');

      const storedPlayerName =
        localStorage.getItem(`player_name_${roomId}`) ||
        localStorage.getItem('current_player_name');

      const storedPlayerColor =
        localStorage.getItem(`player_color_${roomId}`) ||
        localStorage.getItem('current_player_color');

      if (storedPlayerId) setPlayerId(storedPlayerId);
      if (storedPlayerName) setPlayerName(storedPlayerName);
      if (storedPlayerColor) setPlayerColor(storedPlayerColor);

      // Carregar mapa do localStorage ou DEFAULT_DEMO_MAP para salas demo/locais
      try {
        const localSavedMap =
          localStorage.getItem(`demo_map_data_${roomId}`) ||
          localStorage.getItem('demo_map_data');
        if (localSavedMap) {
          const parsed = JSON.parse(localSavedMap);
          if (parsed && (parsed.rooms || parsed.nodes)) {
            setMapData(parsed);
          } else {
            setMapData(DEFAULT_DEMO_MAP);
          }
        } else {
          setMapData(DEFAULT_DEMO_MAP);
        }
      } catch (e) {
        setMapData(DEFAULT_DEMO_MAP);
      }

      // Resolver UUID da sala caso roomId seja um código (ex: "A7X9") ou UUID
      let targetRoomUuid = roomId;
      if (!isValidUuid(roomId)) {
        const { data: roomByCode } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', roomId.toUpperCase())
          .single();

        if (roomByCode) {
          targetRoomUuid = roomByCode.id;
          if (roomByCode.status) setRoomStatus(roomByCode.status as any);
          if (roomByCode.map_data) setMapData(roomByCode.map_data as unknown as ScratchMapPlan);
          if ((roomByCode as any).is_lights_sabotaged) {
            setIsLightsSabotaged(true);
            setIsSabotaged(true);
          }
        }
      } else {
        // Buscar dados da sala se roomId for um UUID direto
        const { data: room } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single();

        if (room) {
          if (room.status) setRoomStatus(room.status as any);
          if (room.map_data) setMapData(room.map_data as unknown as ScratchMapPlan);
          if ((room as any).is_lights_sabotaged) {
            setIsLightsSabotaged(true);
            setIsSabotaged(true);
          }
        }
      }

      if (storedPlayerId && isValidUuid(storedPlayerId)) {
        const { data: player } = await supabase
          .from('room_players')
          .select('id, player_name, color_hex, role, status, completed_tasks')
          .eq('id', storedPlayerId)
          .single();

        if (player) {
          if (player.player_name) setPlayerName(player.player_name);
          if (player.color_hex) setPlayerColor(player.color_hex);
          if (player.role) setPlayerRole(player.role as any);
          if (player.status) setPlayerStatus(player.status as any);
          if (Array.isArray(player.completed_tasks)) {
            setCompletedTasks(player.completed_tasks as string[]);
          }
        }
      }

      // Buscar lista completa de jogadores da sala para HUD / EliminationScreen
      if (isValidUuid(targetRoomUuid)) {
        const { data: playersData } = await supabase
          .from('room_players')
          .select('id, player_name, color_hex, role, status, completed_tasks')
          .eq('room_id', targetRoomUuid);

        if (playersData && playersData.length > 0) {
          const formattedPlayers: PlayerGameState[] = playersData.map((p) => ({
            id: p.id,
            nickname: p.player_name,
            color: p.color_hex || '#3b82f6',
            role: p.role as any,
            is_alive: p.status === 'ALIVE',
            is_host: false,
            completed_tasks: Array.isArray(p.completed_tasks) ? p.completed_tasks.length : 0,
            total_tasks: 4,
            has_voted: false,
            voted_for_id: null,
          }));
          setAllPlayers(formattedPlayers);
        }
      }
    };

    initSession();
  }, [roomId, supabase]);

  // Conexão e sincronização em tempo real via canal privado (latência < 50ms)
  const { connectionState, latency, triggerSabotage, fixSabotage, broadcastEvent } = useRealtimeGame({
    roomId,
    playerId,
    playerName,
    playerColor,
    playerRole,
    isAlive: playerStatus === 'ALIVE',
    onGameStarted: (payload) => {
      setRoomStatus('PLAYING');
      if (payload.roles && playerId && payload.roles[playerId]) {
        setPlayerRole(payload.roles[playerId]);
      }
    },
    onPlayerKilled: (payload) => {
      if (
        payload &&
        (payload.victimId === playerId ||
          (payload as any).victimName === playerName ||
          (payload as any).targetId === playerId)
      ) {
        setPlayerStatus('ELIMINATED');
      }
    },
    onEmergencyMeeting: () => {
      setRoomStatus('EMERGENCY_MEETING');
    },
    onSabotageTriggered: (payload) => {
      if (!payload || payload.type === 'LIGHTS') {
        setIsLightsSabotaged(true);
        setIsSabotaged(true);
      }
    },
    onSabotageFixed: () => {
      setIsLightsSabotaged(false);
      setIsSabotaged(false);
      setShowBreakerGame(false);
    },
    onRoomStatusChanged: (newStatus) => {
      setRoomStatus(newStatus as any);
    },
  });

  // Escutar alterações diretas no banco de dados room_players para a eliminação do jogador
  useEffect(() => {
    if (!playerId) return;

    const isValidUuid = (str?: string) =>
      typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (isValidUuid(playerId)) {
      const channel = supabase
        .channel(`player_status_${playerId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'room_players',
            filter: `id=eq.${playerId}`,
          },
          (payload) => {
            if (payload.new && (payload.new as any).status === 'ELIMINATED') {
              setPlayerStatus('ELIMINATED');
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [playerId, supabase]);

  // Disparar Sabotagem de Luzes pelo Impostor
  const handleTriggerLightsSabotage = async () => {
    setIsLightsSabotaged(true);
    setIsSabotaged(true);
    await triggerSabotage('LIGHTS');

    const isValidUuid = (str?: string) =>
      typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (isValidUuid(roomId)) {
      await supabase
        .from('rooms')
        .update({ is_lights_sabotaged: true })
        .eq('id', roomId);
    }
  };

  // Resolver Sabotagem de Luzes após minigame
  const handleFixLightsSabotage = async () => {
    setIsLightsSabotaged(false);
    setIsSabotaged(false);
    setShowBreakerGame(false);
    await fixSabotage();

    const isValidUuid = (str?: string) =>
      typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (isValidUuid(roomId)) {
      await supabase
        .from('rooms')
        .update({ is_lights_sabotaged: false })
        .eq('id', roomId);
    }
  };




  // Concluir uma tarefa e persistir
  const handleCompleteTask = async (taskId: string) => {
    if (completedTasks.includes(taskId)) return;

    const newCompleted = [...completedTasks, taskId];
    setCompletedTasks(newCompleted);
    setSelectedTask(null);
    setActiveMinigame(null);
    setTaskFeedback('✅ Tarefa concluída com sucesso!');
    setTimeout(() => setTaskFeedback(null), 3000);

    if (playerId) {
      await supabase
        .from('room_players')
        .update({ completed_tasks: newCompleted as any })
        .eq('id', playerId);
    }
  };

  // Se o jogador estiver eliminado, exibe a tela de morte sem fantasmas
  if (playerStatus === 'ELIMINATED') {
    const meAsPlayer: PlayerGameState = {
      id: playerId || 'self',
      nickname: playerName,
      color: playerColor,
      role: playerRole,
      is_alive: false,
      is_host: false,
      completed_tasks: completedTasks.length,
      total_tasks: 4,
      has_voted: false,
      voted_for_id: null,
    };

    return (
      <div className="min-h-screen bg-slate-950 p-4 flex items-center justify-center">
        <EliminationScreen
          eliminatedPlayer={meAsPlayer}
          players={allPlayers.length > 0 ? allPlayers : [meAsPlayer]}
          onReturnToLobby={() => {
            setPlayerStatus('ALIVE');
          }}
        />
      </div>
    );
  }

  // Se a sala estiver em Reunião de Emergência / Votação
  if (roomStatus === 'EMERGENCY_MEETING') {
    return (
      <div className="min-h-screen bg-slate-950 p-4 flex items-center justify-center">
        <VotingSessionScreen
          roomId={roomId}
          currentPlayerId={playerId}
          reporterName="Alguém"
          onVotingEnded={() => setRoomStatus('PLAYING')}
        />
      </div>
    );
  }

  // Se a sala estiver no Lobby aguardando início
  if (roomStatus === 'LOBBY') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col justify-between max-w-md mx-auto font-sans relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-10 left-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <header className="flex flex-col gap-2 border-b border-slate-800 pb-3 z-10">
          <div className="flex justify-between items-center">
            <h1 className="text-sm font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Among Us RP • #{roomId.substring(0, 4)}</span>
            </h1>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase animate-pulse">
              Lobby de Espera
            </span>
          </div>

          <ConnectionStatusHUD
            roomId={roomId}
            connectionState={connectionState}
            latency={latency}
          />
        </header>


        <main className="my-auto space-y-6 text-center z-10">
          <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-3xl shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
              <Users className="w-8 h-8 animate-bounce" />
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-100 uppercase tracking-wider">
                Aguardando Host...
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                O Host está configurando o mapa tático da nave. A partida começará em breve.
              </p>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Seu Perfil RP:</span>
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-slate-900"
                  style={{ backgroundColor: playerColor }}
                />
                <span className="font-bold text-slate-200">{playerName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Sincronizando em tempo real com Supabase</span>
          </div>
        </main>

        <footer className="z-10 text-center text-[10px] text-slate-600">
          Among Us RP Presencial • Código da Sala: <strong className="text-slate-400">{roomId}</strong>
        </footer>
      </div>
    );
  }

  // Estado de Jogo Ativo (PLAYING)
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col justify-between max-w-md mx-auto font-sans relative">
      {/* Header */}
      <header className="flex flex-col gap-2 border-b border-slate-800 pb-3 z-10">
        <div className="flex justify-between items-center">
          <h1 className="text-sm font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Among Us RP • #{roomId.substring(0, 4)}</span>
          </h1>
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              playerRole === 'IMPOSTOR'
                ? 'bg-red-600/20 text-red-400 border border-red-500/60'
                : 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/60'
            }`}
          >
            {playerRole === 'IMPOSTOR' ? '🔪 IMPOSTOR' : '🟢 TRIPULANTE'}
          </div>
        </div>

        <ConnectionStatusHUD
          roomId={roomId}
          connectionState={connectionState}
          latency={latency}
        />
      </header>


      {/* Feedback Toast */}
      {taskFeedback && (
        <div className="bg-emerald-600 text-white text-xs font-bold p-3 rounded-2xl shadow-xl text-center border border-emerald-400 animate-fade-in z-30">
          {taskFeedback}
        </div>
      )}

      {/* Exibição do Mapa Interativo Phygital */}
      <main className="my-auto space-y-4 z-10 py-4">
        {mapData ? (
          <GameMapHUD
            mapData={mapData}
            completedTasks={completedTasks}
            onSelectTaskNode={(node: TaskNode) => {
              setSelectedTask(node);
            }}
            isSabotaged={isSabotaged}
          />
        ) : (
          <div className="text-center text-xs text-slate-500 py-12 bg-slate-900/50 rounded-3xl border border-slate-800">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
            Carregando mapa tático da sala...
          </div>
        )}
      </main>

      {/* Modal de Seleção / Execução de Tarefa */}
      {selectedTask && !activeMinigame && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4 text-center shadow-2xl relative">
            <button
              onClick={() => setSelectedTask(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center mx-auto">
              <Wrench className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-100 uppercase">
                {selectedTask.room_name}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Tipo: <span className="text-cyan-400 font-mono font-bold">{selectedTask.type}</span>
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => setActiveMinigame('qr')}
                className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-extrabold rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all"
              >
                <QrCode className="w-4 h-4" />
                <span>Escanear QR Code Físico</span>
              </button>

              <button
                onClick={() => setActiveMinigame('wires')}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs uppercase tracking-wider border border-slate-700 transition-all"
              >
                <Wrench className="w-4 h-4 text-amber-400" />
                <span>Minigame de Fiação</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minigame QR Code Reader */}
      {activeMinigame === 'qr' && (
        <div className="fixed inset-0 bg-slate-950 z-50 p-4 flex items-center justify-center">
          <div className="w-full max-w-md">
            <TaskQrReader
              expectedTaskTitle={selectedTask?.room_name}
              onScanSuccess={(code) => {
                if (isLightsSabotaged || code.includes('LIGHTS') || code.includes('SABOTAGE') || code.includes('POINT_01')) {
                  setActiveMinigame(null);
                  setSelectedTask(null);
                  setShowBreakerGame(true);
                } else {
                  handleCompleteTask(selectedTask?.id || code);
                }
              }}
              onCancel={() => {
                setActiveMinigame(null);
                setSelectedTask(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Minigame de Fiação */}
      {activeMinigame === 'wires' && (
        <div className="fixed inset-0 bg-slate-950 z-50 p-4 flex items-center justify-center">
          <div className="w-full max-w-md">
            <WireMinigame
              onComplete={() => {
                handleCompleteTask(selectedTask?.id || 'wire-task');
              }}
              onCancel={() => {
                setActiveMinigame(null);
                setSelectedTask(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Minigame de Disjuntores (Breaker Minigame) */}
      {showBreakerGame && (
        <BreakerMinigame
          onComplete={handleFixLightsSabotage}
          onClose={() => setShowBreakerGame(false)}
        />
      )}

      {/* Overlay de Escuridão Dinâmica com Lanterna (Apenas para Crewmates Vivos) */}
      {isLightsSabotaged && playerRole !== 'IMPOSTOR' && playerStatus === 'ALIVE' && (
        <DarknessOverlay
          onOpenGenerator={() => setShowBreakerGame(true)}
          generatorLocationName="Gerador Principal (POINT_01)"
        />
      )}

      {/* Visão Noturna e Alerta de Sabotagem Exclusivos para Impostor */}
      {playerRole === 'IMPOSTOR' && roomStatus === 'PLAYING' && (
        <>
          {isLightsSabotaged && (
            <div className="fixed top-16 left-4 right-4 z-40 bg-red-950/90 border border-red-500/80 text-red-200 text-xs font-bold p-2.5 rounded-2xl text-center shadow-lg backdrop-blur-md animate-pulse flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span>SABOTAGEM DE LUZES ATIVA (VISÃO NOTURNA DE IMPOSTOR)</span>
            </div>
          )}

          <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-3 items-end">
            {!isLightsSabotaged && (
              <button
                onClick={handleTriggerLightsSabotage}
                className="flex items-center gap-2 bg-gradient-to-r from-yellow-600 to-amber-700 hover:from-yellow-500 hover:to-amber-600 text-white text-xs font-black uppercase px-4 py-3 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.4)] border border-amber-400/40 transition-all active:scale-95"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Sabotar Luzes</span>
              </button>
            )}

            {/* Botão de Abate */}
            <ImpostorKillButton
              roomId={roomId}
              roomCode={isValidUuid(roomId) ? undefined : roomId}
              impostorId={playerId}
              players={allPlayers}
              sendBroadcast={broadcastEvent}
            />
          </div>
        </>
      )}
    </div>
  );
}
