'use client';

import React, { useState, useEffect, use, useCallback, useMemo } from 'react';
import { useRealtimeGame } from '@/lib/realtime-game';
import { useGameAudio } from '@/hooks/use-game-audio';
import { ConnectionStatusHUD } from '@/components/game/ConnectionStatusHUD';
import { TaskProgressBar } from '@/components/game/TaskProgressBar';
import { ReportBodyScanner } from '@/components/game/ReportBodyScanner';

import { createClient } from '@/lib/supabase/client';
import { generateUUID } from '@/lib/utils';
import { getRoomSyncStateAction } from '@/app/room/actions';
import { PlayerTaskList } from '@/components/tasks/PlayerTaskList';
import { ImpostorKillButton } from '@/components/game/ImpostorKillButton';
import { VotingSessionScreen } from '@/components/game/VotingSessionScreen';
import { EliminationScreen } from '@/components/minigames/EliminationScreen';
import { TaskQrReader } from '@/components/minigames/TaskQrReader';
import { WireMinigame } from '@/components/minigames/WireMinigame';
import { SwipeCardMinigame } from '@/components/minigames/SwipeCardMinigame';
import { ManifoldsMinigame } from '@/components/minigames/ManifoldsMinigame';
import { CalibrateDistributorMinigame } from '@/components/minigames/CalibrateDistributorMinigame';
import { KeypadMinigame } from '@/components/minigames/KeypadMinigame';
import { StartReactorMinigame } from '@/components/minigames/StartReactorMinigame';
import { AsteroidsMinigame } from '@/components/minigames/AsteroidsMinigame';
import { EmptyGarbageMinigame } from '@/components/minigames/EmptyGarbageMinigame';
import { CleanO2FilterMinigame } from '@/components/minigames/CleanO2FilterMinigame';
import { AlignEngineMinigame } from '@/components/minigames/AlignEngineMinigame';
import { RefuelEngineMinigame } from '@/components/minigames/RefuelEngineMinigame';
import { InspectSampleMinigame } from '@/components/minigames/InspectSampleMinigame';
import { DivertPowerMinigame } from '@/components/minigames/DivertPowerMinigame';
import { UploadDataMinigame } from '@/components/minigames/UploadDataMinigame';
import { EmergencyButtonModal } from '@/components/minigames/EmergencyButtonModal';
import { DarknessOverlay } from '@/components/game/DarknessOverlay';
import { BreakerMinigame } from '@/components/minigames/BreakerMinigame';
import { ScratchMapPlan, TaskNode, DEFAULT_DEMO_MAP } from '@/types/grid-editor';
import { PlayerGameState, RoomStatus } from '@/types/game';
import { getAssignedTasks } from '@/lib/game-utils';
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
  Skull,
} from 'lucide-react';

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { id: roomId } = use(params);

  const isValidUuid = (str?: string) =>
    typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  const [roomStatus, setRoomStatus] = useState<RoomStatus>(() => {
    if (typeof window !== 'undefined') {
      const saved =
        localStorage.getItem(`room_status_${roomId}`) ||
        localStorage.getItem(`room_status_${roomId.toUpperCase()}`);
      if (saved === 'PLAYING' || saved === 'EMERGENCY_MEETING' || saved === 'FINISHED') {
        return saved as RoomStatus;
      }
    }
    return 'LOBBY';
  });
  const [playerStatus, setPlayerStatus] = useState<'ALIVE' | 'ELIMINATED'>('ALIVE');
  const [playerRole, setPlayerRole] = useState<'CREWMATE' | 'IMPOSTOR' | null>(() => {
    if (typeof window !== 'undefined') {
      const savedRole =
        localStorage.getItem(`player_role_${roomId}`) ||
        localStorage.getItem(`player_role_${roomId.toUpperCase()}`);
      if (savedRole === 'CREWMATE' || savedRole === 'IMPOSTOR') {
        return savedRole as 'CREWMATE' | 'IMPOSTOR';
      }
      const storedPlayerId =
        localStorage.getItem(`room_player_${roomId}`) ||
        localStorage.getItem('current_player_id');
      const rolesMapStr =
        localStorage.getItem(`room_roles_${roomId}`) ||
        localStorage.getItem(`room_roles_${roomId.toUpperCase()}`);
      if (rolesMapStr && storedPlayerId) {
        try {
          const parsed = JSON.parse(rolesMapStr);
          if (parsed[storedPlayerId]) return parsed[storedPlayerId];
        } catch {}
      }
    }
    return null;
  });
  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('Jogador');
  const [playerColor, setPlayerColor] = useState<string>('#ef4444');
  const [reporterName, setReporterName] = useState<string>('Tripulante');
  const [discussionTimeSeconds, setDiscussionTimeSeconds] = useState<number>(30);
  const [votingTimeSeconds, setVotingTimeSeconds] = useState<number>(35);
  const [allPlayers, setAllPlayers] = useState<PlayerGameState[]>([]);
  const [roomUuid, setRoomUuid] = useState<string>(roomId);
  const [roomCode, setRoomCode] = useState<string>(() => {
    if (!isValidUuid(roomId)) return roomId.toUpperCase();
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const c = urlParams.get('code');
      if (c) return c.toUpperCase();
      const saved = localStorage.getItem(`room_code_${roomId}`);
      if (saved) return saved;
    }
    return '';
  });
  const [mapData, setMapData] = useState<ScratchMapPlan | null>(null);
  const [taskCount, setTaskCount] = useState<number>(4);
  const [gameStartTime, setGameStartTime] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(`room_game_time_${roomId}`);
        if (stored) return Number(stored);
      }
    } catch {}
    return 0;
  });

  const [completedTasks, setCompletedTasks] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored =
        localStorage.getItem(`completed_tasks_${roomId}`) ||
        localStorage.getItem(`completed_tasks_${roomId.toUpperCase()}`);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
    }
    return [];
  });
  const [isSabotaged, setIsSabotaged] = useState<boolean>(false);
  const [isLightsSabotaged, setIsLightsSabotaged] = useState<boolean>(false);
  const [showBreakerGame, setShowBreakerGame] = useState<boolean>(false);
  const [showReportScanner, setShowReportScanner] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);
  const [activeMinigame, setActiveMinigame] = useState<
    | 'qr'
    | 'wires'
    | 'card_swipe'
    | 'manifolds'
    | 'distributor'
    | 'keypad'
    | 'reactor'
    | 'asteroids'
    | 'garbage'
    | 'clean_o2'
    | 'align_engine'
    | 'refuel'
    | 'inspect_sample'
    | 'divert_power'
    | 'upload_data'
    | 'emergency_button'
    | null
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
    winnerTeam?: 'CREWMATE' | 'IMPOSTOR';
    impostorName: string;
    countdown: number;
    reason?: string;
  } | null>(null);

  // Lista de tarefas atribuídas exclusivamente para este jogador (respeitando a quantidade de tarefas por tripulante configurada pelo host)
  const assignedTasks = useMemo(() => {
    const nodes = mapData?.nodes && mapData.nodes.length > 0 ? mapData.nodes : DEFAULT_DEMO_MAP.nodes;
    const seed = `${roomId}_${gameStartTime}_${playerId || playerName || 'player'}`;
    return getAssignedTasks(nodes, taskCount, seed);
  }, [mapData, taskCount, roomId, gameStartTime, playerId, playerName]);
  const [roleRevealToast, setRoleRevealToast] = useState<{
    role: 'CREWMATE' | 'IMPOSTOR';
  } | null>(null);
  const [showTestDrawer, setShowTestDrawer] = useState<boolean>(false);
  const [isRoomClosed, setIsRoomClosed] = useState<boolean>(false);

  // Verificar se a sala atual é estritamente a sala de teste (A7X9 ou DEMO)
  const isTestRoom = useMemo(() => {
    const cleanId = (roomId || '').trim().toUpperCase();
    const cleanUuid = (roomUuid || '').trim().toUpperCase();
    if (
      cleanId === 'A7X9' ||
      cleanId === 'DEMO' ||
      cleanId === 'DEMO-ROOM-ID' ||
      cleanUuid === 'A7X9' ||
      cleanUuid === 'DEMO'
    ) {
      return true;
    }
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const codeParam = (urlParams.get('code') || '').trim().toUpperCase();
      if (codeParam === 'A7X9' || codeParam === 'DEMO') {
        return true;
      }
    }
    return false;
  }, [roomId, roomUuid]);

  const { initAudio, playSiren, playEmergencyBuzzer, playTaskBeep, stopAll } = useGameAudio();
  const supabase = useMemo(() => createClient(), []);

  // Iniciar partida sandbox local/demo para testes de minigames
  const startSandboxMatch = (roleToSet: 'CREWMATE' | 'IMPOSTOR' = 'CREWMATE') => {
    initAudio();
    setRoomStatus('PLAYING');
    setVictoryModal(null);
    setCompletedTasks([]);
    setIsLightsSabotaged(false);
    setIsSabotaged(false);
    setPlayerStatus('ALIVE');
    setPlayerRole(roleToSet);
    setMapData(DEFAULT_DEMO_MAP);

    const demoPlayers: PlayerGameState[] = [
      {
        id: playerId || 'p-self',
        nickname: playerName || 'Você',
        color: playerColor || '#ef4444',
        role: roleToSet,
        is_alive: true,
        is_host: false,
        completed_tasks: 0,
        total_tasks: 4,
        has_voted: false,
        voted_for_id: null,
      },
      {
        id: 'p2',
        nickname: 'Azul',
        color: '#3b82f6',
        role: roleToSet === 'IMPOSTOR' ? 'CREWMATE' : 'IMPOSTOR',
        is_alive: true,
        is_host: false,
        completed_tasks: 2,
        total_tasks: 4,
        has_voted: false,
        voted_for_id: null,
      },
      {
        id: 'p3',
        nickname: 'Amarelo',
        color: '#eab308',
        role: 'CREWMATE',
        is_alive: true,
        is_host: false,
        completed_tasks: 1,
        total_tasks: 4,
        has_voted: false,
        voted_for_id: null,
      },
      {
        id: 'p4',
        nickname: 'Verde',
        color: '#10b981',
        role: 'CREWMATE',
        is_alive: true,
        is_host: false,
        completed_tasks: 0,
        total_tasks: 4,
        has_voted: false,
        voted_for_id: null,
      },
    ];

    setAllPlayers(demoPlayers);
  };

  // Sincronização abrangente do estado da sala e do jogador via Server Action
  const syncRoomState = useCallback(async () => {
    let currentPid = playerId;
    if (!currentPid && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      currentPid =
        urlParams.get('playerId') ||
        localStorage.getItem(`room_player_${roomId}`) ||
        localStorage.getItem('current_player_id') ||
        '';
    }

    const res = await getRoomSyncStateAction({
      roomId,
      playerId: currentPid,
    });

    if (res.success && res.room) {
      const { room, player, allPlayers: fetchedPlayers } = res;

      if (room.status) {
        setRoomStatus((prev) => {
          if (prev !== room.status) return room.status as RoomStatus;
          return prev;
        });
        if (typeof window !== 'undefined') {
          localStorage.setItem(`room_status_${roomId}`, room.status);
          if (room.code) localStorage.setItem(`room_status_${room.code}`, room.status);
        }
      }

      if (room.id) setRoomUuid(room.id);
      if (room.code) {
        setRoomCode(room.code.toUpperCase());
        if (typeof window !== 'undefined') {
          localStorage.setItem(`room_code_${roomId}`, room.code.toUpperCase());
          if (room.id) localStorage.setItem(`room_code_${room.id}`, room.code.toUpperCase());
        }
      }
      if (room.map_data) setMapData(room.map_data as unknown as ScratchMapPlan);
      if (room.rules) {
        const tc = (room.rules as any).task_count || (room.rules as any).taskCount;
        if (tc) setTaskCount(Number(tc));
        if (room.rules.discussion_time || room.rules.discussionTime) {
          setDiscussionTimeSeconds(Number(room.rules.discussion_time || room.rules.discussionTime));
        }
        if (room.rules.voting_time || room.rules.votingTime) {
          setVotingTimeSeconds(Number(room.rules.voting_time || room.rules.votingTime));
        }
      }

      if (room.is_lights_sabotaged) {
        setIsLightsSabotaged(true);
        setIsSabotaged(true);
      }

      if (player) {
        if (player.player_name) setPlayerName(player.player_name);
        if (player.color_hex) setPlayerColor(player.color_hex);
        if (player.role) {
          setPlayerRole(player.role as any);
          if (typeof window !== 'undefined') {
            localStorage.setItem(`player_role_${roomId}`, player.role);
            if (room.id) localStorage.setItem(`player_role_${room.id}`, player.role);
          }
        }
        if (player.status) setPlayerStatus(player.status as any);
        if (Array.isArray(player.completed_tasks)) {
          setCompletedTasks(player.completed_tasks as string[]);
        }
      }

      if (fetchedPlayers && fetchedPlayers.length > 0) {
        const formatted: PlayerGameState[] = fetchedPlayers.map((p) => ({
          id: p.id,
          nickname: p.player_name,
          color: p.color_hex || '#3b82f6',
          role: (p.role as any) || 'CREWMATE',
          is_alive: p.status === 'ALIVE',
          is_host: false,
          completed_tasks: Array.isArray(p.completed_tasks) ? p.completed_tasks.length : 0,
          total_tasks: taskCount,
          has_voted: false,
          voted_for_id: null,
        }));
        setAllPlayers(formatted);
      }
    }
  }, [roomId, playerId, taskCount]);

  // 1. Carregar dados iniciais da sala e do jogador na sessão atual
  useEffect(() => {
    const initSession = async () => {
      // Recuperar o ID, Nome e Cor do jogador salvos no localStorage ou URL durante o Guest Join
      let storedPlayerId = '';
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        storedPlayerId =
          urlParams.get('playerId') ||
          localStorage.getItem(`room_player_${roomId}`) ||
          localStorage.getItem('current_player_id') ||
          '';
      }

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
      } else if (typeof window !== 'undefined') {
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

      await syncRoomState();
    };

    initSession();
  }, [roomId, syncRoomState]);

  // 2. Ouvintes de ciclo de vida (Standby, Foco e Polling no Lobby)
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncRoomState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // No Lobby de espera, faz checagem periódica a cada 3s para garantir que jogadores
    // que perderam o broadcast ou estavam com celular bloqueado entrem na partida imediatamente
    let lobbyInterval: NodeJS.Timeout | null = null;
    if (roomStatus === 'LOBBY') {
      lobbyInterval = setInterval(() => {
        syncRoomState();
      }, 3000);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      if (lobbyInterval) clearInterval(lobbyInterval);
    };
  }, [roomStatus, syncRoomState]);

  // Conexão e sincronização em tempo real via canal privado (WebSocket)
  const { connectionState, triggerSabotage, fixSabotage, broadcastEvent } = useRealtimeGame({
    roomId: roomUuid || roomId,
    roomCode: roomCode || (!isValidUuid(roomId) ? roomId.toUpperCase() : undefined),
    playerId,
    playerName,
    playerColor,
    playerRole,
    isAlive: playerStatus === 'ALIVE',
    onChannelSubscribed: syncRoomState,
    onGameStarted: (payload) => {
      initAudio();
      setRoomStatus('PLAYING');
      if (typeof window !== 'undefined') {
        localStorage.setItem(`room_status_${roomId}`, 'PLAYING');
        localStorage.removeItem(`completed_tasks_${roomId}`);
      }
      setVictoryModal(null);
      setCompletedTasks([]);
      setIsLightsSabotaged(false);
      setIsSabotaged(false);
      setPlayerStatus('ALIVE');

      const tc = payload.rules?.taskCount || payload.rules?.task_count;
      if (tc) {
        setTaskCount(Number(tc));
      }
      const gTime = payload.timestamp || Date.now();
      setGameStartTime(gTime);
      try {
        localStorage.setItem(`room_game_time_${roomId}`, String(gTime));
      } catch {}

      if (payload.roles) {
        setRolesMap(payload.roles);
        try {
          localStorage.setItem(`room_roles_${roomId}`, JSON.stringify(payload.roles));
        } catch {}

        if (playerId && payload.roles[playerId]) {
          const newRole = payload.roles[playerId];
          setPlayerRole(newRole);
          if (typeof window !== 'undefined') {
            localStorage.setItem(`player_role_${roomId}`, newRole);
          }
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
      setRoomStatus('FINISHED');
      setVictoryModal((prev) => {
        if (prev) return prev;
        return {
          winnerTeam: 'CREWMATE',
          impostorName: payload?.impostorName || 'O Impostor',
          countdown: 5,
          reason: payload?.reason,
        };
      });
    },
    onImpostorVictory: (payload) => {
      stopAll();
      playEmergencyBuzzer();
      setRoomStatus('FINISHED');
      setVictoryModal((prev) => {
        if (prev) return prev;
        return {
          winnerTeam: 'IMPOSTOR',
          impostorName: payload?.impostorName || 'Os Impostores',
          countdown: 5,
          reason: payload?.reason || 'Os Impostores dominaram a nave!',
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

      setAllPlayers((prev) => {
        const targetVictimId = payload.victimId || (payload as any).targetId;
        const updated = prev.map((p) =>
          p.id === targetVictimId || (payload as any).victimName === p.nickname
            ? { ...p, is_alive: false }
            : p
        );

        const alive = updated.filter((p) => p.is_alive !== false);
        const aliveImps = alive.filter((p) => p.role === 'IMPOSTOR').length;
        const aliveCrews = alive.filter((p) => p.role !== 'IMPOSTOR').length;

        if (aliveImps > 0 && aliveImps >= aliveCrews && roomStatus === 'PLAYING') {
          stopAll();
          playEmergencyBuzzer();
          setVictoryModal((modal) => {
            if (modal) return modal;
            return {
              winnerTeam: 'IMPOSTOR',
              impostorName: 'Os Impostores',
              countdown: 5,
              reason: 'Os Impostores eliminaram a tripulação!',
            };
          });

          broadcastEvent('IMPOSTOR_VICTORY', {
            winnerTeam: 'IMPOSTOR',
            reason: 'IMPOSTOR_DOMINANCE',
            timestamp: Date.now(),
          }).catch(() => {});
        }

        return updated;
      });
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
    onTaskCompleted: (payload) => {
      if (payload && payload.playerId) {
        setAllPlayers((prev) =>
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
    onRoomStatusChanged: (newStatus) => {
      setRoomStatus(newStatus as any);
      syncRoomState();
      if (typeof window !== 'undefined') {
        localStorage.setItem(`room_status_${roomId}`, newStatus);
      }
      if (newStatus === 'EMERGENCY_MEETING') {
        playEmergencyBuzzer();
      } else if (newStatus === 'PLAYING') {
        stopAll();
      } else if (newStatus === 'LOBBY') {
        stopAll();
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`player_role_${roomId}`);
          localStorage.removeItem(`completed_tasks_${roomId}`);
          if (roomCode) {
            localStorage.removeItem(`player_role_${roomCode}`);
            localStorage.removeItem(`completed_tasks_${roomCode}`);
            localStorage.setItem(`room_status_${roomCode}`, 'LOBBY');
          }
          if (roomUuid) {
            localStorage.removeItem(`player_role_${roomUuid}`);
            localStorage.removeItem(`completed_tasks_${roomUuid}`);
            localStorage.setItem(`room_status_${roomUuid}`, 'LOBBY');
          }
          localStorage.setItem(`room_status_${roomId}`, 'LOBBY');
        }
        setPlayerRole(null);
        setPlayerStatus('ALIVE');
        setCompletedTasks([]);
        setIsLightsSabotaged(false);
        setIsSabotaged(false);
        setVictoryModal(null);
        setSelectedTask(null);
        setActiveMinigame(null);
        setShowReportScanner(false);
        setShowBreakerGame(false);
        setAllPlayers((prev) =>
          prev.map((p) => ({
            ...p,
            role: 'CREWMATE',
            is_alive: true,
            completed_tasks: 0,
            has_voted: false,
            voted_for_id: null,
          }))
        );
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
    onPlayerKicked: (payload) => {
      const targetId = payload?.playerId || payload?.kickedId;
      if (targetId && (targetId === playerId || targetId === (typeof window !== 'undefined' ? localStorage.getItem('current_player_id') : null))) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`room_player_${roomId}`);
          localStorage.removeItem('current_player_id');
        }
        alert('Você foi removido da sala pelo Host.');
        window.location.href = '/';
      }
    },
    onRoomClosed: () => {
      stopAll();
      setIsRoomClosed(true);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`room_player_${roomId}`);
        localStorage.removeItem('current_player_id');
        localStorage.removeItem(`room_roles_${roomId}`);
      }
      setTimeout(() => {
        window.location.href = '/';
      }, 3500);
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

  // Escutar alterações em tempo real de todos os room_players da sala para atualizar progresso de tarefas
  useEffect(() => {
    if (!roomUuid || !isValidUuid(roomUuid)) return;

    const channel = supabase
      .channel(`room_players_sync_${roomUuid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_players',
          filter: `room_id=eq.${roomUuid}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const inserted = payload.new as any;
            setAllPlayers((prev) => {
              if (prev.some((p) => p.id === inserted.id)) return prev;
              return [
                ...prev,
                {
                  id: inserted.id,
                  nickname: inserted.player_name || 'Tripulante',
                  color: inserted.color_hex || '#3b82f6',
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
            setAllPlayers((prev) => prev.filter((p) => p.id !== payload.old.id));
            if (payload.old.id === playerId || payload.old.id === (typeof window !== 'undefined' ? localStorage.getItem('current_player_id') : null)) {
              if (typeof window !== 'undefined') {
                localStorage.removeItem(`room_player_${roomId}`);
                localStorage.removeItem('current_player_id');
              }
              alert('Você foi removido da sala pelo Host.');
              window.location.href = '/';
            }
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new as any;
            const tasksCount = Array.isArray(updated.completed_tasks)
              ? updated.completed_tasks.length
              : typeof updated.completed_tasks === 'number'
              ? updated.completed_tasks
              : 0;

            setAllPlayers((prev) =>
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
  }, [roomUuid, supabase]);

  // Função para o jogador sair voluntariamente da sala
  const handleLeaveRoom = async () => {
    if (playerId && isValidUuid(playerId)) {
      await supabase.from('room_players').delete().eq('id', playerId);
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`room_player_${roomId}`);
      localStorage.removeItem('current_player_id');
    }
    window.location.href = '/';
  };

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
        localStorage.removeItem(`inspect_sample_start_${roomId}_${playerId}`);
        localStorage.removeItem(`inspect_sample_anomaly_${roomId}_${playerId}`);
        localStorage.removeItem(`inspect_sample_start_${roomId}_p-self`);
        localStorage.removeItem(`inspect_sample_anomaly_${roomId}_p-self`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sample_status_changed'));
        }
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

  // Função para retornar todos os jogadores para a sala de espera do Host (LOBBY)
  const handleReturnToLobby = useCallback(async () => {
    stopAll();
    setRoomStatus('LOBBY');
    if (typeof window !== 'undefined') {
      localStorage.setItem(`room_status_${roomId}`, 'LOBBY');
      localStorage.removeItem(`player_role_${roomId}`);
      localStorage.removeItem(`completed_tasks_${roomId}`);
    }
    setPlayerStatus('ALIVE');
    setCompletedTasks([]);
    setIsLightsSabotaged(false);
    setIsSabotaged(false);
    setVictoryModal(null);
    setSelectedTask(null);
    setActiveMinigame(null);
    setShowReportScanner(false);
    setShowBreakerGame(false);

    try {
      localStorage.removeItem(`inspect_sample_start_${roomId}_${playerId}`);
      localStorage.removeItem(`inspect_sample_anomaly_${roomId}_${playerId}`);
      localStorage.removeItem(`inspect_sample_start_${roomId}_p-self`);
      localStorage.removeItem(`inspect_sample_anomaly_${roomId}_p-self`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sample_status_changed'));
      }
    } catch {}

    setAllPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        is_alive: true,
        completed_tasks: 0,
        has_voted: false,
        voted_for_id: null,
      }))
    );

    // 1. Transmitir evento broadcast de retorno ao lobby para toda a sala
    const lobbyPayload = { status: 'LOBBY', timestamp: Date.now() };
    await broadcastEvent('RETURN_TO_LOBBY', lobbyPayload);
    await broadcastEvent('return_to_lobby', lobbyPayload);

    // 2. Atualizar status da sala e dos jogadores no Supabase se for UUID válido
    if (isValidUuid(roomId)) {
      try {
        await supabase
          .from('rooms')
          .update({
            status: 'LOBBY',
            is_lights_sabotaged: false,
          })
          .eq('id', roomId);

        const currentList = allPlayers.length > 0 ? allPlayers : [{ id: playerId }];
        for (const p of currentList) {
          if (isValidUuid(p.id)) {
            await supabase
              .from('room_players')
              .update({
                status: 'ALIVE',
                completed_tasks: [] as any,
              })
              .eq('id', p.id);
          }
        }
      } catch (e) {
        console.warn('[RoomPage] Erro ao atualizar banco para LOBBY:', e);
      }
    }
  }, [stopAll, roomId, isValidUuid, supabase, broadcastEvent, allPlayers, playerId]);

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

      if (result?.ejectedPlayerId) {
        const isMe = result.ejectedPlayerId === playerId;
        if (isMe) {
          setPlayerStatus('ELIMINATED');
        }

        setAllPlayers((prev) => {
          const updatedPlayers = prev.map((p) =>
            p.id === result.ejectedPlayerId ? { ...p, is_alive: false } : p
          );

          const alivePlayers = updatedPlayers.filter((p) => p.is_alive !== false);
          const aliveImpostors = alivePlayers.filter(
            (p) => (rolesMap[p.id] || p.role) === 'IMPOSTOR'
          ).length;
          const aliveCrewmates = alivePlayers.filter(
            (p) => (rolesMap[p.id] || p.role) !== 'IMPOSTOR'
          ).length;

          // Se todos os impostores foram eliminados (ou se o único impostor foi ejetado)
          if (aliveImpostors === 0 && (result.isImpostor || Object.keys(rolesMap).length > 0)) {
            const impName = result.ejectedPlayerName || 'O Impostor';
            playTaskBeep();
            setRoomStatus('FINISHED');

            setVictoryModal((prevModal) => {
              if (prevModal) return prevModal;
              return {
                winnerTeam: 'CREWMATE',
                impostorName: impName,
                countdown: 5,
                reason: `${impName} foi ejetado da nave! A tripulação venceu.`,
              };
            });

            broadcastEvent('CREWMATE_VICTORY', {
              impostorName: impName,
              ejectedPlayerId: result.ejectedPlayerId,
              timestamp: Date.now(),
            }).catch(() => {});
          } else if (aliveImpostors > 0 && aliveImpostors >= aliveCrewmates) {
            playEmergencyBuzzer();
            setRoomStatus('FINISHED');
            const reasonMsg = result.isImpostor
              ? 'Apesar do ejetamento, os impostores restantes dominaram a nave!'
              : `${result.ejectedPlayerName || 'Tripulante'} foi ejetado e os Impostores dominaram a nave!`;

            setVictoryModal((prevModal) => {
              if (prevModal) return prevModal;
              return {
                winnerTeam: 'IMPOSTOR',
                impostorName: 'Os Impostores',
                countdown: 5,
                reason: reasonMsg,
              };
            });

            broadcastEvent('IMPOSTOR_VICTORY', {
              winnerTeam: 'IMPOSTOR',
              reason: 'IMPOSTOR_DOMINANCE',
              timestamp: Date.now(),
            }).catch(() => {});
          } else {
            setRoomStatus('PLAYING');
            const ejectedName = result.ejectedPlayerName || 'Jogador';
            if (result.isImpostor) {
              setTaskFeedback(`⚠️ ${ejectedName} ERA um Impostor! A partida continua.`);
            } else {
              setTaskFeedback(`⚠️ ${ejectedName} NÃO era o Impostor! A partida continua.`);
            }
            setTimeout(() => setTaskFeedback(null), 5000);
          }

          return updatedPlayers;
        });
      } else {
        setRoomStatus('PLAYING');
        setTaskFeedback('⚖️ Ninguém foi ejetado da nave. A partida continua.');
        setTimeout(() => setTaskFeedback(null), 4000);
      }
    },
    [playerId, stopAll, playTaskBeep, playEmergencyBuzzer, broadcastEvent, rolesMap]
  );

  // Countdown automático para retorno ao lobby após vitória dos tripulantes
  useEffect(() => {
    if (!victoryModal) return;

    if (victoryModal.countdown > 0) {
      const timer = setTimeout(() => {
        setVictoryModal((prev) => (prev && prev.countdown > 0 ? { ...prev, countdown: prev.countdown - 1 } : null));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (victoryModal.countdown === 0) {
      setVictoryModal(null);
      handleReturnToLobby();
    }
  }, [victoryModal, handleReturnToLobby]);

  // Lista memoizada de jogadores para a tela de votação (evita vazamento de papéis secretos)
  const formattedConnectedPlayers = useMemo(() => {
    if (allPlayers.length === 0) return undefined;
    return allPlayers.map((p) => ({
      id: p.id,
      player_name: p.nickname || 'Tripulante',
      color_hex: p.color || '#3b82f6',
      status: (p.is_alive !== false ? 'ALIVE' : 'ELIMINATED') as 'ALIVE' | 'ELIMINATED',
      role: p.id === playerId ? playerRole : (roomStatus === 'FINISHED' ? (p.role || rolesMap[p.id]) : undefined),
    }));
  }, [allPlayers, rolesMap, playerId, playerRole, roomStatus]);

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

  // Validar se uma tarefa (por código QR, ID ou tipo) pertence às tarefas pessoais atribuídas ao jogador
  const checkTaskAssignment = useCallback(
    (codeOrType: string): { allowed: boolean; message: string; targetNode?: TaskNode } => {
      if (!assignedTasks || assignedTasks.length === 0) {
        return {
          allowed: false,
          message: '⚠️ Nenhuma tarefa atribuída a você nesta partida!',
        };
      }

      const inputUpper = codeOrType.toUpperCase().trim();

      // 1. Match direto por ID exato do nó ou token_hash dentro de assignedTasks
      const directMatch = assignedTasks.find(
        (t) => t.id === codeOrType || (t.token_hash && t.token_hash.toUpperCase() === inputUpper)
      );

      if (directMatch) {
        if (completedTasks.includes(directMatch.id)) {
          return {
            allowed: false,
            message: playerRole === 'IMPOSTOR'
              ? '⚠️ Você já simulou esta tarefa falsa!'
              : '⚠️ Você já concluiu esta tarefa!',
          };
        }
        return { allowed: true, message: '', targetNode: directMatch };
      }

      // 2. Mapear string do QR Code / input para o TaskType correspondente
      let targetType = inputUpper
        .replace('TASK_', '')
        .replace('-TASK', '')
        .replace('_TASK', '');

      if (inputUpper.includes('WIRE')) targetType = 'WIRE';
      else if (inputUpper.includes('CARD')) targetType = 'CARD_SWIPE';
      else if (inputUpper.includes('MANIFOLD')) targetType = 'MANIFOLDS';
      else if (inputUpper.includes('DISTRIBUTOR')) targetType = 'DISTRIBUTOR';
      else if (inputUpper.includes('KEYPAD') || inputUpper.includes('OXYGEN')) targetType = 'KEYPAD';
      else if (inputUpper.includes('REACTOR')) targetType = 'REACTOR';
      else if (inputUpper.includes('ASTEROID')) targetType = 'ASTEROIDS';
      else if (inputUpper.includes('GARBAGE') || inputUpper.includes('TRASH')) targetType = 'GARBAGE';
      else if (inputUpper.includes('CLEAN_O2') || inputUpper.includes('FILTER')) targetType = 'CLEAN_O2';
      else if (inputUpper.includes('ALIGN') || inputUpper.includes('ENGINE')) targetType = 'ALIGN_ENGINE';
      else if (inputUpper.includes('REFUEL') || inputUpper.includes('FUEL')) targetType = 'REFUEL';
      else if (inputUpper.includes('SAMPLE') || inputUpper.includes('INSPECT')) targetType = 'INSPECT_SAMPLE';
      else if (inputUpper.includes('DIVERT') || inputUpper.includes('POWER')) targetType = 'DIVERT_POWER';
      else if (inputUpper.includes('UPLOAD') || inputUpper.includes('DATA') || inputUpper.includes('DOWNLOAD')) targetType = 'UPLOAD_DATA';

      // 3. Verificar se existe algum nó em assignedTasks com esse tipo
      const assignedNodesOfSameType = assignedTasks.filter((t) => {
        const nodeType = t.type.toUpperCase();
        return (
          nodeType === targetType ||
          (nodeType.length > 2 && targetType.length > 2 && (nodeType.includes(targetType) || targetType.includes(nodeType)))
        );
      });

      if (assignedNodesOfSameType.length === 0) {
        // Se for impostor, permitir interagir com tarefas do mapa para simular disfarce
        if (playerRole === 'IMPOSTOR') {
          const mapNodes = mapData?.nodes || DEFAULT_DEMO_MAP.nodes;
          const mapNode = mapNodes.find((n) => n.type.toUpperCase() === targetType);
          if (mapNode) {
            return { allowed: true, message: '', targetNode: mapNode };
          }
        }

        return {
          allowed: false,
          message: '⚠️ Esta tarefa não pertence às suas tarefas pessoais!',
        };
      }

      // 4. Verificar se ainda há algum nó pendente (não concluído) desse tipo
      const uncompletedNode = assignedNodesOfSameType.find((t) => !completedTasks.includes(t.id));

      if (!uncompletedNode) {
        // Se for impostor e já fez as de sua lista, permitir simular qualquer nó do mapa
        if (playerRole === 'IMPOSTOR') {
          const mapNodes = mapData?.nodes || DEFAULT_DEMO_MAP.nodes;
          const mapNode = mapNodes.find((n) => n.type.toUpperCase() === targetType);
          if (mapNode) {
            return { allowed: true, message: '', targetNode: mapNode };
          }
        }

        return {
          allowed: false,
          message: playerRole === 'IMPOSTOR'
            ? '⚠️ Você já simulou todas as suas tarefas deste tipo!'
            : '⚠️ Você já concluiu todas as suas tarefas deste tipo!',
        };
      }

      return { allowed: true, message: '', targetNode: uncompletedNode };
    },
    [playerRole, assignedTasks, completedTasks, mapData]
  );

  const handleLaunchTestMinigame = (codeOrType: string, minigameKey: typeof activeMinigame) => {
    setShowTestDrawer(false);
    const validation = checkTaskAssignment(codeOrType);
    if (!validation.allowed) {
      setActiveMinigame(null);
      setSelectedTask(null);
      setTaskFeedback(validation.message);
      setTimeout(() => setTaskFeedback(null), 3500);
      return;
    }
    if (validation.targetNode) {
      setSelectedTask(validation.targetNode);
    }
    setActiveMinigame(minigameKey);
  };

  // Encontrar o nó de tarefa atribuído ao jogador (apenas tarefas da lista pessoal)
  const findAssignedTaskToComplete = useCallback(
    (rawTaskId: string, taskType?: string): TaskNode | null => {
      if (!assignedTasks || assignedTasks.length === 0) return null;

      const targetType = (taskType || rawTaskId)
        .toUpperCase()
        .replace('TASK_', '')
        .replace('-TASK', '')
        .replace('_TASK', '');

      // 1. Se selectedTask estiver ativo, verificar se ele corresponde ao tipo/ID do minigame executado
      if (selectedTask) {
        const isSameId = selectedTask.id === rawTaskId;
        const selectedType = selectedTask.type.toUpperCase();
        const isSameType =
          selectedType === targetType ||
          (selectedType.length > 2 && targetType.length > 2 && (selectedType.includes(targetType) || targetType.includes(selectedType)));

        if ((isSameId || isSameType) && !completedTasks.includes(selectedTask.id)) {
          const assignedMatch = assignedTasks.find((t) => t.id === selectedTask.id);
          if (assignedMatch) return assignedMatch;
          // Se for impostor com tarefa de mapa selecionada
          if (playerRole === 'IMPOSTOR') return selectedTask;
        }
      }

      // 2. Match por ID exato do nó dentro de assignedTasks
      const directIdMatch = assignedTasks.find(
        (t) => t.id === rawTaskId && !completedTasks.includes(t.id)
      );
      if (directIdMatch) return directIdMatch;

      // 3. Match estrito por tipo de tarefa dentro de assignedTasks (apenas nós pendentes)
      const typeMatch = assignedTasks.find((t) => {
        if (completedTasks.includes(t.id)) return false;
        const nodeType = t.type.toUpperCase();
        return (
          nodeType === targetType ||
          (nodeType.length > 2 && targetType.length > 2 && (nodeType.includes(targetType) || targetType.includes(nodeType)))
        );
      });

      if (typeMatch) return typeMatch;

      // 4. Se for impostor, permitir fallback para qualquer nó do mapa
      if (playerRole === 'IMPOSTOR') {
        const mapNodes = mapData?.nodes || DEFAULT_DEMO_MAP.nodes;
        const mapMatch = mapNodes.find((n) => n.type.toUpperCase() === targetType || n.id === rawTaskId);
        if (mapMatch) return mapMatch;
      }

      return null;
    },
    [selectedTask, assignedTasks, completedTasks, playerRole, mapData]
  );

  // Concluir uma tarefa e persistir com áudio
  const handleCompleteTask = async (rawTaskId: string, taskType?: string) => {
    // Caso seja impostor, minigames são apenas simulações: atualiza a lista de tarefas local do impostor (risca da tela), mas não altera a barra global nem o banco
    if (playerRole === 'IMPOSTOR') {
      const targetNode = findAssignedTaskToComplete(rawTaskId, taskType);
      const taskId = targetNode?.id || rawTaskId;

      if (!completedTasks.includes(taskId)) {
        setCompletedTasks((prev) => [...prev, taskId]);
      }
      setSelectedTask(null);
      setActiveMinigame(null);
      playTaskBeep();
      setTaskFeedback('✅ Tarefa falsa simulada! (Disfarce mantido)');
      setTimeout(() => setTaskFeedback(null), 3000);
      return;
    }

    const targetNode = findAssignedTaskToComplete(rawTaskId, taskType);

    if (!targetNode) {
      setSelectedTask(null);
      setActiveMinigame(null);
      setTaskFeedback('⚠️ Esta tarefa não pertence à sua lista de tarefas!');
      setTimeout(() => setTaskFeedback(null), 3000);
      return;
    }

    const taskId = targetNode.id;
    if (completedTasks.includes(taskId)) return;

    const newCompleted = [...completedTasks, taskId];
    setCompletedTasks(newCompleted);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`completed_tasks_${roomId}`, JSON.stringify(newCompleted));
    }
    setSelectedTask(null);
    setActiveMinigame(null);
    playTaskBeep();
    setTaskFeedback('✅ Tarefa concluída com sucesso!');
    setTimeout(() => setTaskFeedback(null), 3000);

    // Broadcast instantâneo (<50ms) da tarefa concluída para Host, TV e demais jogadores
    broadcastEvent('TASK_COMPLETED', {
      taskId,
      playerId,
      playerName: playerName || 'Tripulante',
      completedCount: newCompleted.length,
    }).catch(() => {});
    broadcastEvent('task_completed', {
      taskId,
      playerId,
      playerName: playerName || 'Tripulante',
      completedCount: newCompleted.length,
    }).catch(() => {});

    // Atualizar estado local de allPlayers para atualizar imediatamente o progresso no HUD do jogador
    setAllPlayers((prev) =>
      prev.map((p) =>
        p.id === playerId ? { ...p, completed_tasks: newCompleted.length } : p
      )
    );

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

  // Helper para contar tarefas de um jogador de forma segura (lidando com arrays ou números)
  const getPlayerTaskCount = (p: PlayerGameState, isSelf: boolean) => {
    let count = 0;
    if (Array.isArray((p as any).completed_tasks)) {
      count = (p as any).completed_tasks.length;
    } else if (typeof p.completed_tasks === 'number') {
      count = p.completed_tasks;
    }
    if (isSelf) {
      count = Math.max(count, completedTasks.length);
    }
    return count;
  };

  // Calcular progresso de tarefas da equipe (apenas Tripulantes - denominador fixo pela contagem total)
  const crewmates = allPlayers.filter((p) => (rolesMap[p.id] || p.role) !== 'IMPOSTOR');
  const totalCrewmatesCount = crewmates.length > 0 ? crewmates.length : Math.max(1, allPlayers.length);
  const totalTasksCount = Math.max(1, totalCrewmatesCount * taskCount);
  const myCompletedCount = completedTasks.length;
  const globalCompletedCount = crewmates.length > 0
    ? crewmates.reduce((acc, curr) => acc + getPlayerTaskCount(curr, curr.id === playerId), 0)
    : myCompletedCount;
  const progressPercentage = Math.min(100, Math.round((globalCompletedCount / totalTasksCount) * 100));

  // Disparar vitória dos tripulantes quando todas as tarefas forem concluídas (100%)
  useEffect(() => {
    if (progressPercentage >= 100 && roomStatus === 'PLAYING' && !victoryModal) {
      stopAll();
      playTaskBeep();
      const msg = 'Todas as tarefas da nave foram concluídas!';

      setVictoryModal({
        impostorName: msg,
        countdown: 5,
      });

      broadcastEvent('CREWMATE_VICTORY', {
        reason: 'TASKS_COMPLETED',
        impostorName: msg,
        timestamp: Date.now(),
      }).catch(() => {});

      broadcastEvent('crewmate_victory', {
        reason: 'TASKS_COMPLETED',
        impostorName: msg,
        timestamp: Date.now(),
      }).catch(() => {});
    }
  }, [progressPercentage, roomStatus, victoryModal, stopAll, playTaskBeep, broadcastEvent]);

  // Se a sala tiver sido encerrada definitivamente pelo Host
  if (isRoomClosed) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center font-sans select-none text-center animate-in fade-in">
        <div className="w-full max-w-sm bg-slate-900 border-2 border-red-500/80 rounded-3xl p-8 shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400 mx-auto animate-pulse">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h2
              style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
              className="text-2xl uppercase tracking-wider text-white"
            >
              SALA ENCERRADA
            </h2>
            <p className="text-xs text-slate-400 mt-2">
              A partida foi encerrada pelo Diretor / Host. Obrigado por jogar!
            </p>
          </div>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-950/50 cursor-pointer active:scale-95 transition-all"
            >
              Voltar à Tela Inicial
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Se o jogador estiver eliminado, exibe a tela de morte sem fantasmas (apenas se a partida continuar e não houver modal de vitória)
  if (playerStatus === 'ELIMINATED' && roomStatus !== 'EMERGENCY_MEETING' && roomStatus !== 'LOBBY' && roomStatus !== 'FINISHED' && !victoryModal) {
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
            handleReturnToLobby();
          }}
        />
      </div>
    );
  }

  // Se a sala estiver em Reunião de Emergência / Votação (e a partida não estiver finalizada)
  if (roomStatus === 'EMERGENCY_MEETING' && !victoryModal) {
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-950/60 text-red-400 border border-red-500/40 uppercase hover:bg-red-900 active:scale-95 cursor-pointer flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>SAIR</span>
              </button>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase animate-pulse">
                Lobby de Espera
              </span>
            </div>
          </div>

          <ConnectionStatusHUD
            roomId={roomId}
            connectionState={connectionState}
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
            {/* Botões de Inicialização Rápida apenas para a Sala de Teste A7X9 */}
            {isTestRoom && (
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => startSandboxMatch('CREWMATE')}
                  className="w-full h-[52px] rounded-2xl btn-3d-green text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95"
                >
                  <span>🚀 INICIAR TESTE COMO TRIPULANTE</span>
                </button>
                <button
                  type="button"
                  onClick={() => startSandboxMatch('IMPOSTOR')}
                  className="w-full h-[46px] rounded-2xl btn-3d-red text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95"
                >
                  <span>🔪 INICIAR TESTE COMO IMPOSTOR</span>
                </button>
              </div>
            )}
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
      {/* Header com Papel, Conexão, Barra de Tarefas e Botão Sandbox */}
      <header className="flex flex-col gap-2.5 border-b border-slate-800 pb-3 z-10">
        <div className="flex justify-between items-center">
          <h1 className="text-sm font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Among Us RP • #{roomId.substring(0, 5)}</span>
          </h1>

          <div className="flex items-center gap-2">
            {isTestRoom && (
              <button
                type="button"
                onClick={() => setShowTestDrawer(true)}
                className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-purple-950/80 text-purple-300 border border-purple-500/80 shadow-md hover:bg-purple-900 active:scale-95 cursor-pointer flex items-center gap-1"
              >
                <span>🧪 TESTAR</span>
              </button>
            )}

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
        </div>

        {/* Barra de Progresso Global de Tarefas no topo do HUD */}
        <TaskProgressBar progressPercentage={progressPercentage} />

        <ConnectionStatusHUD
          roomId={roomId}
          connectionState={connectionState}
        />
      </header>

      {/* Feedback Toast */}
      {taskFeedback && (
        <div className="bg-emerald-600 text-white text-xs font-bold p-3 rounded-2xl shadow-xl text-center border border-emerald-400 animate-fade-in z-30">
          {taskFeedback}
        </div>
      )}

      {/* Lista Informativa de Tarefas do Jogador */}
      <main className="my-auto space-y-4 z-10 py-3 flex-1 flex flex-col justify-start">
        <PlayerTaskList
          tasks={assignedTasks}
          completedTasks={completedTasks}
          playerRole={playerRole}
          roomId={roomId}
          playerId={playerId}
        />
      </main>

      {/* Barra Inferior de Ações RP (Zona do Polegar) */}
      <div className="z-20 pt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowReportScanner(true)}
          className="flex-1 h-[54px] rounded-2xl btn-3d-red flex items-center justify-center gap-2 text-xs font-black uppercase shadow-lg active:scale-95 cursor-pointer"
        >
          <Megaphone className="w-5 h-5 stroke-[2.5]" />
          <span>REPORTAR</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMinigame('qr')}
          className="flex-1 h-[54px] rounded-2xl btn-3d-cyan flex items-center justify-center gap-2 text-xs font-black uppercase shadow-lg active:scale-95 cursor-pointer"
        >
          <QrCode className="w-5 h-5 stroke-[2.5]" />
          <span>USAR / ESCANEAR</span>
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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-slate-700 p-6 rounded-3xl max-w-sm w-full space-y-4 text-center shadow-2xl relative animate-in fade-in">
            <button
              onClick={() => setSelectedTask(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-md ${
              selectedTask.type === 'EMERGENCY_BUTTON'
                ? 'bg-red-500/20 text-red-400 border-2 border-red-500/40'
                : selectedTask.type === 'CARD_SWIPE'
                ? 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500/40'
                : selectedTask.type === 'MANIFOLDS'
                ? 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500/40'
                : selectedTask.type === 'KEYPAD'
                ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-500/40'
                : selectedTask.type === 'DISTRIBUTOR'
                ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-500/40'
                : 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500/40'
            }`}>
              {selectedTask.type === 'EMERGENCY_BUTTON' && <Megaphone className="w-7 h-7 animate-pulse" />}
              {selectedTask.type === 'CARD_SWIPE' && <CreditCard className="w-7 h-7" />}
              {selectedTask.type === 'MANIFOLDS' && <KeyRound className="w-7 h-7" />}
              {selectedTask.type === 'KEYPAD' && <Zap className="w-7 h-7" />}
              {selectedTask.type === 'DISTRIBUTOR' && <Gauge className="w-7 h-7" />}
              {selectedTask.type !== 'EMERGENCY_BUTTON' &&
                selectedTask.type !== 'CARD_SWIPE' &&
                selectedTask.type !== 'MANIFOLDS' &&
                selectedTask.type !== 'KEYPAD' &&
                selectedTask.type !== 'DISTRIBUTOR' && <Wrench className="w-7 h-7" />}
            </div>

            <div>
              <h3
                style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
                className="text-xl font-black text-slate-100 uppercase tracking-wider"
              >
                {selectedTask.room_name}
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                TIPO: <span className="text-cyan-400 font-bold">{selectedTask.type}</span>
              </p>
            </div>

            {selectedTask.type === 'EMERGENCY_BUTTON' ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMinigame('emergency_button');
                  }}
                  className="w-full h-[52px] rounded-2xl btn-3d-red text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg animate-pulse"
                >
                  <Megaphone className="w-4 h-4" />
                  <span>ABRIR MESA DE EMERGÊNCIA</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveMinigame('qr')}
                  className="w-full h-[48px] rounded-2xl btn-3d-cyan text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>ESCANEAR QR CODE FÍSICO</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const validation = checkTaskAssignment(selectedTask.id || selectedTask.type);
                    if (!validation.allowed) {
                      setSelectedTask(null);
                      setTaskFeedback(validation.message);
                      setTimeout(() => setTaskFeedback(null), 3500);
                      return;
                    }

                    const t = selectedTask.type?.toUpperCase();
                    if (t === 'CARD_SWIPE') {
                      setActiveMinigame('card_swipe');
                    } else if (t === 'MANIFOLDS') {
                      setActiveMinigame('manifolds');
                    } else if (t === 'KEYPAD' || t === 'OXYGEN') {
                      setActiveMinigame('keypad');
                    } else if (t === 'DISTRIBUTOR') {
                      setActiveMinigame('distributor');
                    } else if (t === 'REACTOR') {
                      setActiveMinigame('reactor');
                    } else if (t === 'ASTEROIDS') {
                      setActiveMinigame('asteroids');
                    } else if (t === 'GARBAGE') {
                      setActiveMinigame('garbage');
                    } else if (t === 'CLEAN_O2') {
                      setActiveMinigame('clean_o2');
                    } else if (t === 'ALIGN_ENGINE') {
                      setActiveMinigame('align_engine');
                    } else if (t === 'REFUEL') {
                      setActiveMinigame('refuel');
                    } else if (t === 'INSPECT_SAMPLE') {
                      setActiveMinigame('inspect_sample');
                    } else if (t === 'DIVERT_POWER') {
                      setActiveMinigame('divert_power');
                    } else if (t === 'UPLOAD_DATA') {
                      setActiveMinigame('upload_data');
                    } else {
                      setActiveMinigame('wires');
                    }
                  }}
                  className="w-full h-[48px] rounded-2xl btn-3d-slate text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  {selectedTask.type === 'CARD_SWIPE' && (
                    <>
                      <CreditCard className="w-4 h-4 text-cyan-400" />
                      <span>PASSAR O CARTÃO</span>
                    </>
                  )}
                  {selectedTask.type === 'MANIFOLDS' && (
                    <>
                      <KeyRound className="w-4 h-4 text-cyan-400" />
                      <span>COLETORES (1 A 10)</span>
                    </>
                  )}
                  {selectedTask.type === 'KEYPAD' && (
                    <>
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>DIGITAR CÓDIGO</span>
                    </>
                  )}
                  {selectedTask.type === 'DISTRIBUTOR' && (
                    <>
                      <Gauge className="w-4 h-4 text-amber-400" />
                      <span>CALIBRAR DISTRIBUIDOR</span>
                    </>
                  )}
                  {selectedTask.type === 'REACTOR' && (
                    <>
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span>INICIAR REATOR (SIMON SAYS)</span>
                    </>
                  )}
                  {selectedTask.type === 'ASTEROIDS' && (
                    <>
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <span>DESTRUIR ASTEROIDES</span>
                    </>
                  )}
                  {selectedTask.type === 'GARBAGE' && (
                    <>
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>ESVAZIAR LIXO</span>
                    </>
                  )}
                  {selectedTask.type === 'CLEAN_O2' && (
                    <>
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span>LIMPAR FILTRO DE O2</span>
                    </>
                  )}
                  {selectedTask.type === 'ALIGN_ENGINE' && (
                    <>
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>ALINHAR MOTOR</span>
                    </>
                  )}
                  {selectedTask.type === 'REFUEL' && (
                    <>
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span>ABASTECER MOTOR</span>
                    </>
                  )}
                  {selectedTask.type === 'INSPECT_SAMPLE' && (
                    <>
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span>ANALISAR AMOSTRA</span>
                    </>
                  )}
                  {selectedTask.type === 'DIVERT_POWER' && (
                    <>
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>DIRECIONAR ENERGIA</span>
                    </>
                  )}
                  {selectedTask.type === 'UPLOAD_DATA' && (
                    <>
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span>ENVIAR DADOS</span>
                    </>
                  )}
                  {selectedTask.type !== 'CARD_SWIPE' &&
                    selectedTask.type !== 'MANIFOLDS' &&
                    selectedTask.type !== 'KEYPAD' &&
                    selectedTask.type !== 'DISTRIBUTOR' &&
                    selectedTask.type !== 'REACTOR' &&
                    selectedTask.type !== 'ASTEROIDS' &&
                    selectedTask.type !== 'GARBAGE' &&
                    selectedTask.type !== 'CLEAN_O2' &&
                    selectedTask.type !== 'ALIGN_ENGINE' &&
                    selectedTask.type !== 'REFUEL' &&
                    selectedTask.type !== 'INSPECT_SAMPLE' &&
                    selectedTask.type !== 'DIVERT_POWER' &&
                    selectedTask.type !== 'UPLOAD_DATA' && (
                      <>
                        <Wrench className="w-4 h-4 text-amber-400" />
                        <span>REPARAR FIAÇÃO</span>
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
                const cleanCode = code.trim().toUpperCase();

                if (cleanCode.includes('REPORT_BODY') || cleanCode === 'REPORT') {
                  setActiveMinigame(null);
                  setSelectedTask(null);
                  handleBodyReported('Corpo Encontrado (QR Físico)');
                  return;
                }
                if (cleanCode.includes('EMERGENCY_BUTTON')) {
                  setActiveMinigame('emergency_button');
                  return;
                }
                if (
                  isLightsSabotaged ||
                  cleanCode.includes('TASK_BREAKER') ||
                  cleanCode.includes('LIGHTS') ||
                  cleanCode.includes('SABOTAGE') ||
                  cleanCode.includes('POINT_01')
                ) {
                  setActiveMinigame(null);
                  setSelectedTask(null);
                  setShowBreakerGame(true);
                  return;
                }

                // Validar se a tarefa do QR code escaneado pertence às tarefas pessoais do jogador
                const validation = checkTaskAssignment(cleanCode);

                if (!validation.allowed) {
                  setActiveMinigame(null);
                  setSelectedTask(null);
                  setTaskFeedback(validation.message);
                  setTimeout(() => setTaskFeedback(null), 3500);
                  return;
                }

                if (validation.targetNode) {
                  setSelectedTask(validation.targetNode);
                }

                if (cleanCode.includes('TASK_WIRE') || cleanCode === 'WIRE') {
                  setActiveMinigame('wires');
                } else if (cleanCode.includes('TASK_CARD_SWIPE') || cleanCode === 'CARD_SWIPE') {
                  setActiveMinigame('card_swipe');
                } else if (cleanCode.includes('TASK_MANIFOLDS') || cleanCode === 'MANIFOLDS') {
                  setActiveMinigame('manifolds');
                } else if (cleanCode.includes('TASK_DISTRIBUTOR') || cleanCode === 'DISTRIBUTOR') {
                  setActiveMinigame('distributor');
                } else if (cleanCode.includes('TASK_KEYPAD') || cleanCode === 'KEYPAD') {
                  setActiveMinigame('keypad');
                } else if (cleanCode.includes('TASK_REACTOR') || cleanCode === 'REACTOR') {
                  setActiveMinigame('reactor');
                } else if (cleanCode.includes('TASK_ASTEROIDS') || cleanCode === 'ASTEROIDS') {
                  setActiveMinigame('asteroids');
                } else if (cleanCode.includes('TASK_GARBAGE') || cleanCode === 'GARBAGE') {
                  setActiveMinigame('garbage');
                } else if (cleanCode.includes('TASK_CLEAN_O2') || cleanCode === 'CLEAN_O2') {
                  setActiveMinigame('clean_o2');
                } else if (cleanCode.includes('TASK_ALIGN_ENGINE') || cleanCode === 'ALIGN_ENGINE') {
                  setActiveMinigame('align_engine');
                } else if (cleanCode.includes('TASK_REFUEL') || cleanCode === 'REFUEL') {
                  setActiveMinigame('refuel');
                } else if (cleanCode.includes('TASK_INSPECT_SAMPLE') || cleanCode === 'INSPECT_SAMPLE' || cleanCode.includes('SAMPLE')) {
                  setActiveMinigame('inspect_sample');
                } else if (cleanCode.includes('TASK_DIVERT_POWER') || cleanCode === 'DIVERT_POWER' || cleanCode.includes('DIVERT')) {
                  setActiveMinigame('divert_power');
                } else if (cleanCode.includes('TASK_UPLOAD_DATA') || cleanCode === 'UPLOAD_DATA' || cleanCode.includes('UPLOAD')) {
                  setActiveMinigame('upload_data');
                } else if (validation.targetNode) {
                  const t = validation.targetNode.type;
                  if (t === 'WIRE') setActiveMinigame('wires');
                  else if (t === 'CARD_SWIPE') setActiveMinigame('card_swipe');
                  else if (t === 'MANIFOLDS') setActiveMinigame('manifolds');
                  else if (t === 'DISTRIBUTOR') setActiveMinigame('distributor');
                  else if (t === 'KEYPAD') setActiveMinigame('keypad');
                  else if (t === 'REACTOR') setActiveMinigame('reactor');
                  else if (t === 'ASTEROIDS') setActiveMinigame('asteroids');
                  else if (t === 'GARBAGE') setActiveMinigame('garbage');
                  else if (t === 'CLEAN_O2') setActiveMinigame('clean_o2');
                  else if (t === 'ALIGN_ENGINE') setActiveMinigame('align_engine');
                  else if (t === 'REFUEL') setActiveMinigame('refuel');
                  else if (t === 'INSPECT_SAMPLE') setActiveMinigame('inspect_sample');
                  else if (t === 'DIVERT_POWER') setActiveMinigame('divert_power');
                  else if (t === 'UPLOAD_DATA') setActiveMinigame('upload_data');
                  else {
                    handleCompleteTask(validation.targetNode.id);
                    setActiveMinigame(null);
                    setSelectedTask(null);
                  }
                } else {
                  handleCompleteTask(selectedTask?.id || code);
                  setActiveMinigame(null);
                  setSelectedTask(null);
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
                handleCompleteTask(selectedTask?.id || 'wire-task', 'WIRE');
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
            handleCompleteTask(selectedTask?.id || 'card-swipe-task', 'CARD_SWIPE');
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
            handleCompleteTask(selectedTask?.id || 'manifolds-task', 'MANIFOLDS');
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
            handleCompleteTask(selectedTask?.id || 'distributor-task', 'DISTRIBUTOR');
          }}
          onCancel={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Minigame: Teclado Numérico (Keypad / Oxygen) */}
      {activeMinigame === 'keypad' && (
        <KeypadMinigame
          onComplete={() => {
            handleCompleteTask(selectedTask?.id || 'keypad-task', 'KEYPAD');
          }}
          onClose={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Minigame: Iniciar Reator (Simon Says) */}
      {activeMinigame === 'reactor' && (
        <StartReactorMinigame
          onComplete={() => {
            handleCompleteTask(selectedTask?.id || 'reactor-task', 'REACTOR');
          }}
          onCancel={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Minigame: Destruir Asteroides */}
      {activeMinigame === 'asteroids' && (
        <AsteroidsMinigame
          onComplete={() => {
            handleCompleteTask(selectedTask?.id || 'asteroids-task', 'ASTEROIDS');
          }}
          onCancel={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Minigame: Esvaziar Lixo */}
      {activeMinigame === 'garbage' && (
        <EmptyGarbageMinigame
          onComplete={() => {
            handleCompleteTask(selectedTask?.id || 'garbage-task', 'GARBAGE');
          }}
          onCancel={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Minigame: Limpar Filtro de O2 */}
      {activeMinigame === 'clean_o2' && (
        <CleanO2FilterMinigame
          onComplete={() => {
            handleCompleteTask(selectedTask?.id || 'clean-o2-task', 'CLEAN_O2');
          }}
          onCancel={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Minigame: Alinhar Motor */}
      {activeMinigame === 'align_engine' && (
        <AlignEngineMinigame
          onComplete={() => {
            handleCompleteTask(selectedTask?.id || 'align-engine-task', 'ALIGN_ENGINE');
          }}
          onCancel={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Minigame: Abastecer Combustível */}
      {activeMinigame === 'refuel' && (
        <RefuelEngineMinigame
          onComplete={() => {
            handleCompleteTask(selectedTask?.id || 'refuel-task', 'REFUEL');
          }}
          onCancel={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Minigame: Enviar / Analisar Amostra (MedBay 60s) */}
      {activeMinigame === 'inspect_sample' && (
        <InspectSampleMinigame
          roomId={roomId}
          playerId={playerId}
          onComplete={() => {
            handleCompleteTask(selectedTask?.id || 'sample-task', 'INSPECT_SAMPLE');
          }}
          onCancel={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Minigame: Direcionar Energia (2 Etapas: Hotwire + Disjuntores) */}
      {activeMinigame === 'divert_power' && (
        <DivertPowerMinigame
          rooms={mapData?.rooms}
          onComplete={() => {
            handleCompleteTask(selectedTask?.id || 'divert-task', 'DIVERT_POWER');
          }}
          onCancel={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Minigame: Enviar Dados (2 Etapas: Download na Sala -> Upload na Sede) */}
      {activeMinigame === 'upload_data' && (
        <UploadDataMinigame
          roomName={selectedTask?.room_name || 'Armas'}
          roomId={roomId}
          playerId={playerId}
          onComplete={() => {
            handleCompleteTask(selectedTask?.id || 'upload-task', 'UPLOAD_DATA');
          }}
          onCancel={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Modal: Botão de Emergência Central */}
      {activeMinigame === 'emergency_button' && (
        <EmergencyButtonModal
          playerName={playerName}
          remainingMeetings={1}
          onTriggerMeeting={() => {
            setActiveMinigame(null);
            setSelectedTask(null);
            const taskName = selectedTask?.room_name || 'Botão de Emergência Central';
            handleBodyReported(taskName);
          }}
          onClose={() => {
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

      {/* Modal de Vitória dos Tripulantes / Impostores com Contagem Regressiva */}
      {victoryModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-fade-in font-sans select-none">
          {victoryModal.winnerTeam === 'IMPOSTOR' ? (
            <div className="max-w-sm w-full bg-slate-950 border-2 border-red-600/90 rounded-3xl p-6 text-center space-y-5 shadow-[0_0_60px_rgba(220,38,38,0.5)] relative overflow-hidden animate-in zoom-in-95">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-red-600 animate-pulse" />

              <div className="w-20 h-20 rounded-full bg-red-950/80 border-2 border-red-500 text-red-500 mx-auto flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.4)] animate-bounce font-sans">
                <Skull className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-950/90 px-3 py-1 rounded-full border border-red-800/80 inline-flex items-center gap-1">
                  <Skull className="w-3 h-3" />
                  <span>Partida Finalizada</span>
                </span>
                <h2 className="text-2xl font-black text-red-500 uppercase tracking-wider font-mono">
                  Vitória dos Impostores! 🔪
                </h2>
                <p className="text-xs text-slate-300">
                  {victoryModal.reason || 'Os Impostores dominaram a nave! A tripulação não pode mais detê-los.'}
                </p>
              </div>

              <div className="p-3 bg-slate-900/90 rounded-2xl border border-red-900/50 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Retornando à tela de espera em:</span>
                <span className="font-black text-red-400 text-base">
                  {victoryModal.countdown}s
                </span>
              </div>

              <button
                onClick={() => handleReturnToLobby()}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Voltar à Tela de Espera</span>
              </button>
            </div>
          ) : (
            <div className="max-w-sm w-full bg-slate-900 border-2 border-emerald-500/80 rounded-3xl p-6 text-center space-y-5 shadow-[0_0_50px_rgba(16,185,129,0.3)] relative overflow-hidden animate-in zoom-in-95">
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
                  {victoryModal.impostorName.includes('tarefas') ? (
                    <strong className="text-emerald-400 font-black">{victoryModal.impostorName}</strong>
                  ) : (
                    <>O Impostor <strong className="text-emerald-400 font-black">{victoryModal.impostorName}</strong> foi ejetado da nave.</>
                  )}
                </p>
              </div>

              <div className="p-3 bg-slate-950/90 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Retornando ao Lobby em:</span>
                <span className="font-mono font-black text-cyan-400 text-sm">
                  {victoryModal.countdown}s
                </span>
              </div>

              <button
                onClick={() => handleReturnToLobby()}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Voltar à Sala de Espera</span>
              </button>
            </div>
          )}
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

      {/* Modal de Gaveta de Testes / Sandbox (Exclusivo da Sala de Teste A7X9) */}
      {isTestRoom && showTestDrawer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border-4 border-purple-500 rounded-3xl p-5 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowTestDrawer(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center pt-1 border-b border-slate-800 pb-3">
              <span className="text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-600/60 px-3 py-0.5 rounded-full uppercase tracking-wider">
                🧪 MESA DE TESTES RP
              </span>
              <h3
                style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
                className="text-xl font-black text-white uppercase tracking-wider mt-1"
              >
                TESTAR MINIGAMES & AÇÕES
              </h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Sala: <strong className="text-cyan-400">{roomId}</strong>
              </p>
            </div>

            {/* Alternância de Papel */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                1. Papel do Jogador:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPlayerRole('CREWMATE');
                    setShowTestDrawer(false);
                  }}
                  className={`h-10 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1 cursor-pointer transition ${
                    playerRole === 'CREWMATE'
                      ? 'bg-cyan-600 text-slate-950 ring-2 ring-cyan-400 shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>🟢 TRIPULANTE</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlayerRole('IMPOSTOR');
                    setShowTestDrawer(false);
                  }}
                  className={`h-10 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1 cursor-pointer transition ${
                    playerRole === 'IMPOSTOR'
                      ? 'bg-red-600 text-white ring-2 ring-red-400 shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>🔪 IMPOSTOR</span>
                </button>
              </div>
            </div>

            {/* Minigames Interativos */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                2. Abrir Minigames:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleLaunchTestMinigame('WIRE', 'wires')}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>🔌</span>
                  <span className="truncate">Fiação (4 Fios)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchTestMinigame('CARD_SWIPE', 'card_swipe')}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>💳</span>
                  <span className="truncate">Passar Cartão</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchTestMinigame('MANIFOLDS', 'manifolds')}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>🔢</span>
                  <span className="truncate">Coletores (1 a 10)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchTestMinigame('DISTRIBUTOR', 'distributor')}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>🎛️</span>
                  <span className="truncate">Distribuidor</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchTestMinigame('KEYPAD', 'keypad')}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>📟</span>
                  <span className="truncate">Teclado / Oxigênio</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowTestDrawer(false);
                    setShowBreakerGame(true);
                  }}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-yellow-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>⚡</span>
                  <span className="truncate">Disjuntores (5 Luzes)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchTestMinigame('REACTOR', 'reactor')}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>🧠</span>
                  <span className="truncate">Reator (Simon Says)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchTestMinigame('ASTEROIDS', 'asteroids')}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>🚀</span>
                  <span className="truncate">Asteroides (Armas)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchTestMinigame('GARBAGE', 'garbage')}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>🗑️</span>
                  <span className="truncate">Esvaziar Lixo</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchTestMinigame('CLEAN_O2', 'clean_o2')}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>🍃</span>
                  <span className="truncate">Limpar Filtro O2</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchTestMinigame('ALIGN_ENGINE', 'align_engine')}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>🎯</span>
                  <span className="truncate">Alinhar Motor</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchTestMinigame('REFUEL', 'refuel')}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-yellow-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>⛽</span>
                  <span className="truncate">Abastecer Motor</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchTestMinigame('INSPECT_SAMPLE', 'inspect_sample')}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>🧪</span>
                  <span className="truncate">Amostra (60s)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchTestMinigame('DIVERT_POWER', 'divert_power')}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>⚡</span>
                  <span className="truncate">Direcionar Energia</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunchTestMinigame('UPLOAD_DATA', 'upload_data')}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-400 text-left text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <span>📡</span>
                  <span className="truncate">Enviar Dados</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowTestDrawer(false);
                  setActiveMinigame('emergency_button');
                }}
                className="w-full p-2.5 rounded-xl bg-red-950/60 border border-red-500/60 text-red-300 text-xs font-black uppercase flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <span>🚨 MESA / BOTÃO DE EMERGÊNCIA</span>
              </button>
            </div>

            {/* Ações RP & Sabotagens */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                3. Ações & Eventos RP:
              </span>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowTestDrawer(false);
                    handleTriggerLightsSabotage();
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-black uppercase flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Zap className="w-4 h-4" />
                  <span>SABOTAR LUZES (ESCURIDÃO + LANTERNA)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowTestDrawer(false);
                    handleBodyReported('Mesa Central');
                  }}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Megaphone className="w-4 h-4" />
                  <span>DISPARAR REUNIÃO & VOTAÇÃO</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowTestDrawer(false);
                    handleReturnToLobby();
                  }}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Voltar ao Lobby de Espera</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
