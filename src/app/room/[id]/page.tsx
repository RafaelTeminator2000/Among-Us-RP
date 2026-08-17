'use client';

import React, { useState, useEffect, use, useCallback, useMemo } from 'react';
import { useRealtimeGame } from '@/lib/realtime-game';
import { useGameAudio } from '@/hooks/use-game-audio';
import { ConnectionStatusHUD } from '@/components/game/ConnectionStatusHUD';
import { TaskProgressBar } from '@/components/game/TaskProgressBar';
import { ReportBodyScanner } from '@/components/game/ReportBodyScanner';

import { createClient } from '@/lib/supabase/client';
import { generateUUID } from '@/lib/utils';
import { GameMapHUD } from '@/components/map/GameMapHUD';
import { ImpostorKillButton } from '@/components/game/ImpostorKillButton';
import { VotingSessionScreen } from '@/components/game/VotingSessionScreen';
import { EliminationScreen } from '@/components/minigames/EliminationScreen';
import { TaskQrReader } from '@/components/minigames/TaskQrReader';
import { WireMinigame } from '@/components/minigames/WireMinigame';
import { SwipeCardMinigame } from '@/components/minigames/SwipeCardMinigame';
import { ManifoldsMinigame } from '@/components/minigames/ManifoldsMinigame';
import { CalibrateDistributorMinigame } from '@/components/minigames/CalibrateDistributorMinigame';
import { DarknessOverlay } from '@/components/game/DarknessOverlay';
import { BreakerMinigame } from '@/components/minigames/BreakerMinigame';
import { ScratchMapPlan, TaskNode, DEFAULT_DEMO_MAP } from '@/types/grid-editor';
import { PlayerGameState } from '@/types/game';
import {
  Users,
  Shield,
  Megaphone,
  QrCode,
  Wrench,
  X,
  RefreshCw,
  Zap,
  CreditCard,
  KeyRound,
  Gauge,
  Trophy,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

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
  const [reporterName, setReporterName] = useState<string>('Tripulante');
  const [discussionTimeSeconds, setDiscussionTimeSeconds] = useState<number>(30);
  const [votingTimeSeconds, setVotingTimeSeconds] = useState<number>(35);
  const [allPlayers, setAllPlayers] = useState<PlayerGameState[]>([]);
  const [mapData, setMapData] = useState<ScratchMapPlan | null>(null);

  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [isSabotaged, setIsSabotaged] = useState<boolean>(false);
  const [isLightsSabotaged, setIsLightsSabotaged] = useState<boolean>(false);
  const [showBreakerGame, setShowBreakerGame] = useState<boolean>(false);
  const [showReportScanner, setShowReportScanner] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);
  const [activeMinigame, setActiveMinigame] = useState<
    'qr' | 'wires' | 'card_swipe' | 'manifolds' | 'distributor' | null
  >(null);
  const [taskFeedback, setTaskFeedback] = useState<string | null>(null);
  const [rolesMap, setRolesMap] = useState<Record<string, 'CREWMATE' | 'IMPOSTOR'>>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored =
          localStorage.getItem(`room_roles_${roomId}`) ||
          localStorage.getItem(`room_roles_${roomId.toUpperCase()}`);
        if (stored) return JSON.parse(stored);
      }
    } catch {}
    return {};
  });
  const [victoryModal, setVictoryModal] = useState<{
    impostorName: string;
    countdown: number;
  } | null>(null);
  const [roleRevealToast, setRoleRevealToast] = useState<{
    role: 'CREWMATE' | 'IMPOSTOR';
  } | null>(null);

  const { initAudio, playSiren, playEmergencyBuzzer, playTaskBeep, stopAll } = useGameAudio();
  const supabase = useMemo(() => createClient(), []);

  // 1. Carregar dados iniciais da sala e do jogador na sessão atual
  useEffect(() => {
    const initSession = async () => {
      // Recuperar o ID, Nome e Cor do jogador salvos no localStorage durante o Guest Join
      let storedPlayerId =
        localStorage.getItem(`room_player_${roomId}`) ||
        localStorage.getItem('current_player_id');

      const storedPlayerName =
        localStorage.getItem(`player_name_${roomId}`) ||
        localStorage.getItem('current_player_name');

      const storedPlayerColor =
        localStorage.getItem(`player_color_${roomId}`) ||
        localStorage.getItem('current_player_color');

      if (!storedPlayerId) {
        storedPlayerId = generateUUID();
        localStorage.setItem(`room_player_${roomId}`, storedPlayerId);
        localStorage.setItem('current_player_id', storedPlayerId);
      }

      setPlayerId(storedPlayerId);
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
          .maybeSingle();

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
          .maybeSingle();

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
          .maybeSingle();

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
    roomCode: !isValidUuid(roomId) ? roomId.toUpperCase() : undefined,
    playerId,
    playerName,
    playerColor,
    playerRole,
    isAlive: playerStatus === 'ALIVE',
    onGameStarted: (payload) => {
      initAudio();
      setRoomStatus('PLAYING');
      setVictoryModal(null);
      setCompletedTasks([]);
      setIsLightsSabotaged(false);
      setIsSabotaged(false);
      setPlayerStatus('ALIVE');

      if (payload.roles) {
        setRolesMap(payload.roles);
        try {
          localStorage.setItem(`room_roles_${roomId}`, JSON.stringify(payload.roles));
        } catch {}

        if (playerId && payload.roles[playerId]) {
          const newRole = payload.roles[playerId];
          setPlayerRole(newRole);
          setRoleRevealToast({ role: newRole });
          setTimeout(() => setRoleRevealToast(null), 4000);
        }

        setAllPlayers((prev) =>
          prev.map((p) => ({
            ...p,
            role: payload.roles![p.id] || p.role || 'CREWMATE',
            is_alive: true,
            completed_tasks: 0,
          }))
        );
      }

      if (payload.rules?.discussionTime || payload.rules?.discussion_time) {
        setDiscussionTimeSeconds(Number(payload.rules.discussionTime || payload.rules.discussion_time));
      }
      if (payload.rules?.votingTime || payload.rules?.voting_time) {
        setVotingTimeSeconds(Number(payload.rules.votingTime || payload.rules.voting_time));
      }
    },
    onCrewmateVictory: (payload) => {
      stopAll();
      playTaskBeep();
      setVictoryModal((prev) => {
        if (prev) return prev;
        return {
          impostorName: payload?.impostorName || 'O Impostor',
          countdown: 5,
        };
      });
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
    onEmergencyMeeting: (payload) => {
      playEmergencyBuzzer();
      if (payload?.reporterName) {
        setReporterName(payload.reporterName);
      }
      setRoomStatus('EMERGENCY_MEETING');
    },
    onSabotageTriggered: (payload) => {
      if (!payload || payload.type === 'LIGHTS') {
        setIsLightsSabotaged(true);
        setIsSabotaged(true);
        playSiren();
      }
    },
    onSabotageFixed: () => {
      setIsLightsSabotaged(false);
      setIsSabotaged(false);
      setShowBreakerGame(false);
      stopAll();
    },
    onRoomStatusChanged: (newStatus) => {
      setRoomStatus(newStatus as any);
      if (newStatus === 'EMERGENCY_MEETING') {
        playEmergencyBuzzer();
      } else if (newStatus === 'PLAYING') {
        stopAll();
      }
    },
    onPlayersPresenceChanged: (presences) => {
      if (presences && presences.length > 0) {
        setAllPlayers((prev) => {
          let hasChanged = false;
          const map = new Map(prev.map((p) => [p.id, p]));

          presences.forEach((p) => {
            if (map.has(p.id)) {
              const existing = map.get(p.id)!;
              if (existing.is_alive !== p.is_alive || (p.role && existing.role !== p.role)) {
                map.set(p.id, {
                  ...existing,
                  is_alive: p.is_alive,
                  role: p.role || existing.role,
                });
                hasChanged = true;
              }
            } else {
              map.set(p.id, {
                id: p.id,
                nickname: p.name,
                color: p.color_hex || '#3b82f6',
                role: p.role,
                is_alive: p.is_alive,
                is_host: false,
                completed_tasks: 0,
                total_tasks: 4,
                has_voted: false,
                voted_for_id: null,
              });
              hasChanged = true;
            }
          });

          if (!hasChanged && prev.length === map.size) {
            return prev;
          }

          return Array.from(map.values());
        });
      }
    },
  });

  // Escutar alterações diretas no banco de dados room_players para a eliminação do jogador
  useEffect(() => {
    if (!playerId) return;

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

  // Função para sortear novo impostor e reiniciar a partida
  const handleRestartGame = useCallback(
    async (prevImpostorName?: string) => {
      stopAll();

      // 1. Coletar lista de jogadores da sala
      const currentList =
        allPlayers.length > 0
          ? allPlayers
          : [
              {
                id: playerId || 'self',
                nickname: playerName,
                color: playerColor,
                role: 'CREWMATE' as const,
                is_alive: true,
                is_host: false,
                completed_tasks: 0,
                total_tasks: 4,
                has_voted: false,
                voted_for_id: null,
              },
            ];

      // 2. Sortear novo impostor aleatoriamente entre todos os jogadores
      const shuffled = [...currentList].sort(() => 0.5 - Math.random());
      const newImpostorId = shuffled[0]?.id || playerId;

      const newRoles: Record<string, 'CREWMATE' | 'IMPOSTOR'> = {};
      currentList.forEach((p) => {
        newRoles[p.id] = p.id === newImpostorId ? 'IMPOSTOR' : 'CREWMATE';
      });

      // 3. Atualizar estado local
      setRolesMap(newRoles);
      const myNewRole = newRoles[playerId] || (playerId === newImpostorId ? 'IMPOSTOR' : 'CREWMATE');
      setPlayerRole(myNewRole);
      setPlayerStatus('ALIVE');
      setCompletedTasks([]);
      setIsLightsSabotaged(false);
      setIsSabotaged(false);
      setVictoryModal(null);
      setRoomStatus('PLAYING');

      setRoleRevealToast({ role: myNewRole });
      setTimeout(() => setRoleRevealToast(null), 4500);

      try {
        localStorage.setItem(`room_roles_${roomId}`, JSON.stringify(newRoles));
      } catch {}

      // 4. Atualizar Supabase se a sala for um UUID válido
      if (isValidUuid(roomId)) {
        try {
          await supabase
            .from('rooms')
            .update({
              status: 'PLAYING',
              is_lights_sabotaged: false,
            })
            .eq('id', roomId);

          for (const p of currentList) {
            if (isValidUuid(p.id)) {
              await supabase
                .from('room_players')
                .update({
                  role: newRoles[p.id],
                  status: 'ALIVE',
                  completed_tasks: [] as any,
                })
                .eq('id', p.id);
            }
          }
        } catch (e) {
          console.warn('[RoomPage] Erro ao atualizar banco no restart:', e);
        }
      }

      // 5. Transmitir eventos de reinício para toda a sala
      const restartPayload = {
        status: 'PLAYING',
        roles: newRoles,
        previousImpostorName: prevImpostorName,
        timestamp: Date.now(),
      };

      await broadcastEvent('GAME_RESTARTED', restartPayload);
      await broadcastEvent('game_restarted', restartPayload);
      await broadcastEvent('GAME_STARTED', restartPayload);
      await broadcastEvent('game_started', restartPayload);
    },
    [allPlayers, playerId, playerName, playerColor, roomId, isValidUuid, supabase, broadcastEvent, stopAll]
  );

  // Callback de finalização da sessão de votação e ejeção
  const handleVotingEnded = useCallback(
    (result?: {
      ejectedPlayerId?: string | null;
      ejectedPlayerName?: string | null;
      isImpostor?: boolean;
      ejectedRole?: string | null;
      wasTieOrSkipped?: boolean;
    }) => {
      stopAll();
      setRoomStatus('PLAYING');

      if (result?.ejectedPlayerId) {
        const isMe = result.ejectedPlayerId === playerId;
        if (isMe) {
          setPlayerStatus('ELIMINATED');
        }

        // Atualizar status de vivo na lista local de jogadores
        setAllPlayers((prev) =>
          prev.map((p) =>
            p.id === result.ejectedPlayerId ? { ...p, is_alive: false } : p
          )
        );

        if (result.isImpostor) {
          // O Impostor foi ejetado! Os tripulantes ganharam!
          const impName = result.ejectedPlayerName || 'O Impostor';
          playTaskBeep();

          // Exibir modal de vitória com contagem regressiva para nova partida
          setVictoryModal((prev) => {
            if (prev) return prev;
            return {
              impostorName: impName,
              countdown: 5,
            };
          });

          // Broadcast de vitória para toda a sala
          broadcastEvent('CREWMATE_VICTORY', {
            impostorName: impName,
            ejectedPlayerId: result.ejectedPlayerId,
            timestamp: Date.now(),
          }).catch(() => {});
        } else {
          // Um Tripulante foi ejetado ao invés do Impostor: A partida continua!
          const crewName = result.ejectedPlayerName || 'Tripulante';
          setTaskFeedback(`⚠️ ${crewName} NÃO era o Impostor! A partida continua.`);
          setTimeout(() => setTaskFeedback(null), 5000);
        }
      } else {
        setTaskFeedback('⚖️ Ninguém foi ejetado da nave. A partida continua.');
        setTimeout(() => setTaskFeedback(null), 4000);
      }
    },
    [playerId, stopAll, playTaskBeep, broadcastEvent]
  );

  // Countdown automático para reinício após vitória dos tripulantes
  useEffect(() => {
    if (!victoryModal) return;

    if (victoryModal.countdown > 0) {
      const timer = setTimeout(() => {
        setVictoryModal((prev) => (prev && prev.countdown > 0 ? { ...prev, countdown: prev.countdown - 1 } : null));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (victoryModal.countdown === 0) {
      const impName = victoryModal.impostorName;
      setVictoryModal(null);
      handleRestartGame(impName);
    }
  }, [victoryModal, handleRestartGame]);

  // Lista memoizada de jogadores para a tela de votação (evita recriação desnecessária de array)
  const formattedConnectedPlayers = useMemo(() => {
    if (allPlayers.length === 0) return undefined;
    return allPlayers.map((p) => ({
      id: p.id,
      player_name: p.nickname || 'Tripulante',
      color_hex: p.color || '#3b82f6',
      status: (p.is_alive !== false ? 'ALIVE' : 'ELIMINATED') as 'ALIVE' | 'ELIMINATED',
      role: p.role || rolesMap[p.id] || (p.id === playerId ? playerRole : undefined),
    }));
  }, [allPlayers, rolesMap, playerId, playerRole]);

  // Disparar Sabotagem de Luzes pelo Impostor
  const handleTriggerLightsSabotage = async () => {
    setIsLightsSabotaged(true);
    setIsSabotaged(true);
    playSiren();
    await triggerSabotage('LIGHTS');

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
    stopAll();
    await fixSabotage();

    if (isValidUuid(roomId)) {
      await supabase
        .from('rooms')
        .update({ is_lights_sabotaged: false })
        .eq('id', roomId);
    }
  };

  // Concluir uma tarefa e persistir com áudio
  const handleCompleteTask = async (taskId: string) => {
    if (completedTasks.includes(taskId)) return;

    const newCompleted = [...completedTasks, taskId];
    setCompletedTasks(newCompleted);
    setSelectedTask(null);
    setActiveMinigame(null);
    playTaskBeep();
    setTaskFeedback('✅ Tarefa concluída com sucesso!');
    setTimeout(() => setTaskFeedback(null), 3000);

    if (playerId && isValidUuid(playerId)) {
      await supabase
        .from('room_players')
        .update({ completed_tasks: newCompleted as any })
        .eq('id', playerId);
    }
  };

  // Reportar corpo de um jogador encontrado
  const handleBodyReported = (deadPlayerName: string) => {
    playEmergencyBuzzer();
    setShowReportScanner(false);
    const myName = playerName || 'Tripulante';
    setReporterName(myName);
    setRoomStatus('EMERGENCY_MEETING');

    broadcastEvent('EMERGENCY_MEETING', {
      reporterId: playerId,
      reporterName: myName,
      deadPlayerName,
      timestamp: Date.now(),
    });
    broadcastEvent('emergency_meeting', {
      reporterId: playerId,
      reporterName: myName,
      deadPlayerName,
      timestamp: Date.now(),
    });
  };

  // Calcular progresso de tarefas da equipe
  const alivePlayers = allPlayers.filter((p) => p.is_alive);
  const totalTasksCount = Math.max(1, (alivePlayers.length > 0 ? alivePlayers.length : 1) * 4);
  const myCompletedCount = completedTasks.length;
  const globalCompletedCount = allPlayers.length > 0
    ? allPlayers.reduce((acc, curr) => acc + (curr.completed_tasks || 0), 0)
    : myCompletedCount;
  const progressPercentage = Math.min(100, Math.round((globalCompletedCount / totalTasksCount) * 100));

  // Se o jogador estiver eliminado, exibe a tela de morte sem fantasmas
  if (playerStatus === 'ELIMINATED' && roomStatus !== 'EMERGENCY_MEETING') {
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
    const isCurrentUserHost = Boolean(
      (typeof window !== 'undefined' && (
        localStorage.getItem(`is_host_${roomId}`) === 'true' ||
        localStorage.getItem('is_room_host') === 'true' ||
        localStorage.getItem(`is_host_${!isValidUuid(roomId) ? roomId.toUpperCase() : ''}`) === 'true'
      )) ||
      allPlayers.find((p) => p.id === playerId)?.is_host
    );

    return (
      <div className="min-h-screen bg-slate-950 p-4 flex items-center justify-center">
        <VotingSessionScreen
          roomId={roomId}
          roomCode={!isValidUuid(roomId) ? roomId.toUpperCase() : undefined}
          currentPlayerId={playerId}
          currentPlayerName={playerName}
          reporterName={reporterName}
          connectedPlayers={formattedConnectedPlayers}
          rolesMap={rolesMap}
          discussionTimeSeconds={discussionTimeSeconds}
          votingTimeSeconds={votingTimeSeconds}
          isHost={isCurrentUserHost}
          sendBroadcast={broadcastEvent}
          onVotingEnded={handleVotingEnded}
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
      {/* Header com Papel, Conexão e Barra de Tarefas */}
      <header className="flex flex-col gap-2.5 border-b border-slate-800 pb-3 z-10">
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

        {/* Barra de Progresso Global de Tarefas no topo do HUD */}
        <TaskProgressBar progressPercentage={progressPercentage} />

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

      {/* Barra Inferior de Ações RP (Reportar Corpo + Sabotagem/Abate) */}
      <div className="z-20 pt-2 flex items-center justify-between gap-2">
        <button
          onClick={() => setShowReportScanner(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-950/80 hover:bg-red-900/80 border border-red-600/70 text-red-300 font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all"
        >
          <Megaphone className="w-4 h-4 text-red-400 animate-pulse" />
          <span>Reportar Corpo</span>
        </button>
      </div>

      {/* Modal de Scanner de Report de Corpos */}
      {showReportScanner && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <ReportBodyScanner
            roomId={roomId}
            roomCode={!isValidUuid(roomId) ? roomId.toUpperCase() : undefined}
            reporterId={playerId}
            reporterName={playerName}
            sendBroadcast={broadcastEvent}
            onBodyReported={handleBodyReported}
            onClose={() => setShowReportScanner(false)}
          />
        </div>
      )}

      {/* Modal de Seleção / Execução de Tarefa */}
      {selectedTask && !activeMinigame && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4 text-center shadow-2xl relative">
            <button
              onClick={() => setSelectedTask(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
              selectedTask.type === 'EMERGENCY_BUTTON'
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : selectedTask.type === 'CARD_SWIPE'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : selectedTask.type === 'MANIFOLDS'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : selectedTask.type === 'DISTRIBUTOR'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
            }`}>
              {selectedTask.type === 'EMERGENCY_BUTTON' && <Megaphone className="w-6 h-6 animate-pulse" />}
              {selectedTask.type === 'CARD_SWIPE' && <CreditCard className="w-6 h-6" />}
              {selectedTask.type === 'MANIFOLDS' && <KeyRound className="w-6 h-6" />}
              {selectedTask.type === 'DISTRIBUTOR' && <Gauge className="w-6 h-6" />}
              {selectedTask.type !== 'EMERGENCY_BUTTON' &&
                selectedTask.type !== 'CARD_SWIPE' &&
                selectedTask.type !== 'MANIFOLDS' &&
                selectedTask.type !== 'DISTRIBUTOR' && <Wrench className="w-6 h-6" />}
            </div>

            <div>
              <h3 className="text-base font-black text-slate-100 uppercase">
                {selectedTask.room_name}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Tipo: <span className="text-cyan-400 font-mono font-bold">{selectedTask.type}</span>
              </p>
            </div>

            {selectedTask.type === 'EMERGENCY_BUTTON' ? (
              <div className="pt-2">
                <button
                  onClick={() => {
                    const taskName = selectedTask.room_name || 'Botão de Emergência Central';
                    setSelectedTask(null);
                    handleBodyReported(taskName);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-red-950/50 border border-red-400/40 transition-all active:scale-95 animate-pulse"
                >
                  <Megaphone className="w-4 h-4" />
                  <span>Acionar Reunião de Emergência</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => setActiveMinigame('qr')}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-extrabold rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Escanear QR Code Físico</span>
                </button>

                <button
                  onClick={() => {
                    const t = selectedTask.type?.toUpperCase();
                    if (t === 'CARD_SWIPE') {
                      setActiveMinigame('card_swipe');
                    } else if (t === 'MANIFOLDS') {
                      setActiveMinigame('manifolds');
                    } else if (t === 'DISTRIBUTOR') {
                      setActiveMinigame('distributor');
                    } else {
                      setActiveMinigame('wires');
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs uppercase tracking-wider border border-slate-700 transition-all active:scale-95"
                >
                  {selectedTask.type === 'CARD_SWIPE' && (
                    <>
                      <CreditCard className="w-4 h-4 text-cyan-400" />
                      <span>Passar o Cartão</span>
                    </>
                  )}
                  {selectedTask.type === 'MANIFOLDS' && (
                    <>
                      <KeyRound className="w-4 h-4 text-cyan-400" />
                      <span>Desbloquear Coletores (1-10)</span>
                    </>
                  )}
                  {selectedTask.type === 'DISTRIBUTOR' && (
                    <>
                      <Gauge className="w-4 h-4 text-amber-400" />
                      <span>Calibrar Distribuidor</span>
                    </>
                  )}
                  {selectedTask.type !== 'CARD_SWIPE' &&
                    selectedTask.type !== 'MANIFOLDS' &&
                    selectedTask.type !== 'DISTRIBUTOR' && (
                      <>
                        <Wrench className="w-4 h-4 text-amber-400" />
                        <span>Minigame de Fiação</span>
                      </>
                    )}
                </button>
              </div>
            )}
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

      {/* Minigame: Passar Cartão */}
      {activeMinigame === 'card_swipe' && (
        <SwipeCardMinigame
          onComplete={() => {
            handleCompleteTask(selectedTask?.id || 'card-swipe-task');
          }}
          onCancel={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Minigame: Desbloquear Coletores (1-10) */}
      {activeMinigame === 'manifolds' && (
        <ManifoldsMinigame
          onComplete={() => {
            handleCompleteTask(selectedTask?.id || 'manifolds-task');
          }}
          onCancel={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Minigame: Calibrar Distribuidor */}
      {activeMinigame === 'distributor' && (
        <CalibrateDistributorMinigame
          onComplete={() => {
            handleCompleteTask(selectedTask?.id || 'distributor-task');
          }}
          onCancel={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
          }}
        />
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
            <div className="fixed top-24 left-4 right-4 z-40 bg-red-950/90 border border-red-500/80 text-red-200 text-xs font-bold p-2.5 rounded-2xl text-center shadow-lg backdrop-blur-md animate-pulse flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span>SABOTAGEM DE LUZES ATIVA (VISÃO NOTURNA DE IMPOSTOR)</span>
            </div>
          )}

          <div className="fixed bottom-20 right-6 z-30 flex flex-col gap-3 items-end">
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

      {/* Modal de Vitória dos Tripulantes com Contagem Regressiva para Nova Partida */}
      {victoryModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="max-w-sm w-full bg-slate-900 border-2 border-emerald-500/80 rounded-3xl p-6 text-center space-y-5 shadow-[0_0_50px_rgba(16,185,129,0.3)] relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500" />

            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 mx-auto flex items-center justify-center shadow-lg animate-bounce">
              <Trophy className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/80 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Partida Finalizada</span>
              </span>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">
                Vitória dos Tripulantes!
              </h2>
              <p className="text-xs text-slate-300">
                O Impostor <strong className="text-emerald-400 font-black">{victoryModal.impostorName}</strong> foi ejetado da nave.
              </p>
            </div>

            <div className="p-3 bg-slate-950/90 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Nova partida em:</span>
              <span className="font-mono font-black text-cyan-400 text-sm">
                {victoryModal.countdown}s
              </span>
            </div>

            <button
              onClick={() => handleRestartGame(victoryModal.impostorName)}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              Reiniciar Agora
            </button>
          </div>
        </div>
      )}

      {/* Toast / Banner de Revelação do Novo Papel Secreto */}
      {roleRevealToast && (
        <div className="fixed top-16 left-4 right-4 z-50 animate-bounce">
          <div
            className={`p-4 rounded-2xl border text-center shadow-2xl backdrop-blur-md ${
              roleRevealToast.role === 'IMPOSTOR'
                ? 'bg-red-950/95 border-red-500 text-red-100 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
                : 'bg-emerald-950/95 border-emerald-500 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.4)]'
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-widest block opacity-80">
              Nova Partida Iniciada • Seu Papel:
            </span>
            <span className="text-base font-black tracking-wider block mt-0.5">
              {roleRevealToast.role === 'IMPOSTOR' ? '🔪 VOCÊ É O IMPOSTOR' : '🟢 VOCÊ É TRIPULANTE'}
            </span>
            <p className="text-[11px] opacity-80 mt-1">
              {roleRevealToast.role === 'IMPOSTOR'
                ? 'Sabote a nave e elimine a tripulação sem ser descoberto!'
                : 'Complete todas as suas tarefas e descubra o impostor!'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
