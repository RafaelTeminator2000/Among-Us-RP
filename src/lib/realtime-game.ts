'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export type RealtimeConnectionState =
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'ERROR';

export interface PresencePlayer {
  id: string;
  user_id: string;
  name: string;
  color_hex?: string;
  role: 'CREWMATE' | 'IMPOSTOR' | null;
  is_alive: boolean;
  online_at: string;
}

export interface PlayerKilledPayload {
  victimId: string;
  attackerId: string;
}

export interface EmergencyMeetingPayload {
  reporterId: string;
  reporterName: string;
}

export interface SabotageTriggeredPayload {
  type: 'LIGHTS' | 'REACTOR' | 'O2';
  initiatorId: string;
}

export interface SabotageFixedPayload {
  fixedByPlayerId: string;
}

export interface GameStartedPayload {
  status: string;
  roles?: Record<string, 'CREWMATE' | 'IMPOSTOR'>;
  rules?: any;
  timestamp: number;
}

export interface TaskCompletedPayload {
  taskId?: string;
  playerId?: string;
  playerName?: string;
  completedCount?: number;
}

export interface UseRealtimeGameProps {
  roomId: string;
  roomCode?: string;
  playerId?: string;
  playerName?: string;
  playerColor?: string;
  playerRole?: 'CREWMATE' | 'IMPOSTOR' | null;
  isAlive?: boolean;
  onGameStarted?: (payload: GameStartedPayload) => void;
  onPlayerKilled?: (payload: PlayerKilledPayload) => void;
  onEmergencyMeeting?: (payload: EmergencyMeetingPayload) => void;
  onSabotageTriggered?: (payload: SabotageTriggeredPayload) => void;
  onSabotageFixed?: (payload: SabotageFixedPayload) => void;
  onTaskCompleted?: (payload: TaskCompletedPayload) => void;
  onSkipDiscussion?: () => void;
  onVoteCast?: (payload: any) => void;
  onVotingFinished?: (payload: any) => void;
  onCrewmateVictory?: (payload: { impostorName?: string; reason?: string; timestamp?: number }) => void;
  onImpostorVictory?: (payload: { impostorName?: string; reason?: string; timestamp?: number }) => void;
  onRoomStatusChanged?: (newStatus: string) => void;
  onPlayersPresenceChanged?: (players: PresencePlayer[]) => void;
  onPlayerKicked?: (payload: { playerId: string; kickedId?: string }) => void;
  onRoomClosed?: (payload: { reason?: string }) => void;
  onChannelSubscribed?: () => void;
}

export function useRealtimeGame({
  roomId,
  roomCode,
  playerId,
  playerName = 'Jogador',
  playerColor = '#ef4444',
  playerRole = null,
  isAlive = true,
  onGameStarted,
  onPlayerKilled,
  onEmergencyMeeting,
  onSabotageTriggered,
  onSabotageFixed,
  onTaskCompleted,
  onSkipDiscussion,
  onVoteCast,
  onVotingFinished,
  onCrewmateVictory,
  onImpostorVictory,
  onRoomStatusChanged,
  onPlayersPresenceChanged,
  onPlayerKicked,
  onRoomClosed,
  onChannelSubscribed,
}: UseRealtimeGameProps) {
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('CONNECTING');
  const [presencePlayers, setPresencePlayers] = useState<PresencePlayer[]>([]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Manter refs atualizadas de callbacks e props do jogador para evitar re-subscriptions infinitos
  const callbacksRef = useRef({
    onGameStarted,
    onPlayerKilled,
    onEmergencyMeeting,
    onSabotageTriggered,
    onSabotageFixed,
    onTaskCompleted,
    onSkipDiscussion,
    onVoteCast,
    onVotingFinished,
    onCrewmateVictory,
    onImpostorVictory,
    onRoomStatusChanged,
    onPlayersPresenceChanged,
    onPlayerKicked,
    onRoomClosed,
    onChannelSubscribed,
  });

  const playerRef = useRef({ playerId, playerName, playerColor, playerRole, isAlive });

  useEffect(() => {
    callbacksRef.current = {
      onGameStarted,
      onPlayerKilled,
      onEmergencyMeeting,
      onSabotageTriggered,
      onSabotageFixed,
      onTaskCompleted,
      onSkipDiscussion,
      onVoteCast,
      onVotingFinished,
      onCrewmateVictory,
      onImpostorVictory,
      onRoomStatusChanged,
      onPlayersPresenceChanged,
      onPlayerKicked,
      onRoomClosed,
      onChannelSubscribed,
    };
    playerRef.current = { playerId, playerName, playerColor, playerRole, isAlive };
  }, [
    onGameStarted,
    onPlayerKilled,
    onEmergencyMeeting,
    onSabotageTriggered,
    onSabotageFixed,
    onTaskCompleted,
    onSkipDiscussion,
    onVoteCast,
    onVotingFinished,
    onCrewmateVictory,
    onImpostorVictory,
    onRoomStatusChanged,
    onPlayersPresenceChanged,
    onPlayerKicked,
    onRoomClosed,
    onChannelSubscribed,
    playerId,
    playerName,
    playerColor,
    playerRole,
    isAlive,
  ]);

  useEffect(() => {
    // Se o canal já estiver conectado, enviar presença e anúncio com os dados mais recentes
    if (channelRef.current && connectionState === 'CONNECTED' && playerId) {
      const presencePayload = {
        id: playerId,
        playerId,
        user_id: '',
        name: playerName || 'Tripulante',
        player_name: playerName || 'Tripulante',
        color_hex: playerColor || '#ef4444',
        is_alive: isAlive,
        online_at: new Date().toISOString(),
      };

      channelRef.current.track(presencePayload).catch(() => {});
      channelRef.current.send({
        type: 'broadcast',
        event: 'PLAYER_JOINED',
        payload: presencePayload,
      }).catch(() => {});
    }
  }, [playerId, playerName, playerColor, isAlive, connectionState]);

  // Função genérica de envio de broadcast com validação de canal
  const broadcastEvent = useCallback(
    async (event: string, payload: Record<string, any> = {}) => {
      if (!channelRef.current) {
        console.warn(`[RealtimeGame] Tentativa de envio do evento "${event}" sem canal ativo.`);
        return;
      }

      await channelRef.current.send({
        type: 'broadcast',
        event,
        payload,
      });
    },
    []
  );

  // Gatilho de Abate do Impostor (player_killed)
  const killPlayer = useCallback(
    async (victimId: string) => {
      if (!playerRef.current.playerId) return;
      await broadcastEvent('player_killed', {
        victimId,
        attackerId: playerRef.current.playerId,
      });
    },
    [broadcastEvent]
  );

  // Convocação de Reunião de Emergência (emergency_meeting)
  const triggerEmergencyMeeting = useCallback(
    async (reporterNameOverride?: string) => {
      await broadcastEvent('emergency_meeting', {
        reporterId: playerRef.current.playerId || 'unknown',
        reporterName: reporterNameOverride || playerRef.current.playerName,
      });
    },
    [broadcastEvent]
  );

  // Ativação de Sabotagem (sabotage_triggered)
  const triggerSabotage = useCallback(
    async (type: 'LIGHTS' | 'REACTOR' | 'O2' = 'LIGHTS') => {
      await broadcastEvent('sabotage_triggered', {
        type,
        initiatorId: playerRef.current.playerId || 'unknown',
      });
    },
    [broadcastEvent]
  );

  // Resolução de Sabotagem (sabotage_fixed)
  const fixSabotage = useCallback(async () => {
    await broadcastEvent('sabotage_fixed', {
      fixedByPlayerId: playerRef.current.playerId || 'unknown',
    });
  }, [broadcastEvent]);

  const isTrackedRef = useRef(false);

  useEffect(() => {
    if (!roomId) return;

    let isMounted = true;
    isTrackedRef.current = false;

    const setupRealtimeChannel = async () => {
      const topicKey = (roomCode || roomId).trim().toLowerCase();
      const channelTopic = `room:${topicKey}:game_flow`;

      // Limpar canais anteriores
      const existingChannels = supabase.getChannels().filter(
        (c) => c.topic === channelTopic || c.topic === `realtime:${channelTopic}`
      );
      for (const ch of existingChannels) {
        await supabase.removeChannel(ch);
      }
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      if (!isMounted) return;

      const channel = supabase.channel(channelTopic, {
        config: {
          broadcast: { self: true },
          presence: { key: playerRef.current.playerId || `guest_${Date.now()}` },
        },
      });

      channelRef.current = channel;

      // Inscrição dos Listeners de Broadcast
      channel
        .on('broadcast', { event: 'GAME_STARTED' }, (payload) => {
          const data = payload?.payload as GameStartedPayload;
          if (callbacksRef.current.onGameStarted) callbacksRef.current.onGameStarted(data);
          if (callbacksRef.current.onRoomStatusChanged) callbacksRef.current.onRoomStatusChanged(data?.status || 'PLAYING');
        })
        .on('broadcast', { event: 'game_started' }, (payload) => {
          const data = payload?.payload as GameStartedPayload;
          if (callbacksRef.current.onGameStarted) callbacksRef.current.onGameStarted(data);
          if (callbacksRef.current.onRoomStatusChanged) callbacksRef.current.onRoomStatusChanged(data?.status || 'PLAYING');
        })
        .on('broadcast', { event: 'GAME_RESTARTED' }, (payload) => {
          const data = payload?.payload as GameStartedPayload;
          if (callbacksRef.current.onGameStarted) callbacksRef.current.onGameStarted(data);
          if (callbacksRef.current.onRoomStatusChanged) callbacksRef.current.onRoomStatusChanged(data?.status || 'PLAYING');
        })
        .on('broadcast', { event: 'game_restarted' }, (payload) => {
          const data = payload?.payload as GameStartedPayload;
          if (callbacksRef.current.onGameStarted) callbacksRef.current.onGameStarted(data);
          if (callbacksRef.current.onRoomStatusChanged) callbacksRef.current.onRoomStatusChanged(data?.status || 'PLAYING');
        })
        .on('broadcast', { event: 'RETURN_TO_LOBBY' }, () => {
          if (callbacksRef.current.onRoomStatusChanged) callbacksRef.current.onRoomStatusChanged('LOBBY');
        })
        .on('broadcast', { event: 'return_to_lobby' }, () => {
          if (callbacksRef.current.onRoomStatusChanged) callbacksRef.current.onRoomStatusChanged('LOBBY');
        })
        .on('broadcast', { event: 'ROOM_STATUS_CHANGED' }, (payload) => {
          const newStatus = payload?.payload?.status || payload?.payload;
          if (typeof newStatus === 'string' && callbacksRef.current.onRoomStatusChanged) {
            callbacksRef.current.onRoomStatusChanged(newStatus);
          }
        })
        .on('broadcast', { event: 'room_status_changed' }, (payload) => {
          const newStatus = payload?.payload?.status || payload?.payload;
          if (typeof newStatus === 'string' && callbacksRef.current.onRoomStatusChanged) {
            callbacksRef.current.onRoomStatusChanged(newStatus);
          }
        })
        .on('broadcast', { event: 'PLAYER_KILLED' }, (payload) => {
          const data = payload.payload as PlayerKilledPayload;
          if (callbacksRef.current.onPlayerKilled) callbacksRef.current.onPlayerKilled(data);
          if (playerRef.current.playerId === data.victimId) {
            playerRef.current.isAlive = false;
          }
        })
        .on('broadcast', { event: 'player_killed' }, (payload) => {
          const data = payload.payload as PlayerKilledPayload;
          if (callbacksRef.current.onPlayerKilled) callbacksRef.current.onPlayerKilled(data);
          if (playerRef.current.playerId === data.victimId) {
            playerRef.current.isAlive = false;
          }
        })
        .on('broadcast', { event: 'EMERGENCY_MEETING' }, (payload) => {
          const data = payload.payload as EmergencyMeetingPayload;
          if (callbacksRef.current.onEmergencyMeeting) callbacksRef.current.onEmergencyMeeting(data);
        })
        .on('broadcast', { event: 'emergency_meeting' }, (payload) => {
          const data = payload.payload as EmergencyMeetingPayload;
          if (callbacksRef.current.onEmergencyMeeting) callbacksRef.current.onEmergencyMeeting(data);
        })
        .on('broadcast', { event: 'SABOTAGE_TRIGGERED' }, (payload) => {
          const data = payload.payload as SabotageTriggeredPayload;
          if (callbacksRef.current.onSabotageTriggered) callbacksRef.current.onSabotageTriggered(data);
        })
        .on('broadcast', { event: 'sabotage_triggered' }, (payload) => {
          const data = payload.payload as SabotageTriggeredPayload;
          if (callbacksRef.current.onSabotageTriggered) callbacksRef.current.onSabotageTriggered(data);
        })
        .on('broadcast', { event: 'SABOTAGE_FIXED' }, (payload) => {
          const data = payload?.payload as SabotageFixedPayload;
          if (callbacksRef.current.onSabotageFixed) callbacksRef.current.onSabotageFixed(data);
        })
        .on('broadcast', { event: 'sabotage_fixed' }, (payload) => {
          const data = payload?.payload as SabotageFixedPayload;
          if (callbacksRef.current.onSabotageFixed) callbacksRef.current.onSabotageFixed(data);
        })
        .on('broadcast', { event: 'TASK_COMPLETED' }, (payload) => {
          const data = payload.payload as TaskCompletedPayload;
          if (callbacksRef.current.onTaskCompleted) callbacksRef.current.onTaskCompleted(data);
        })
        .on('broadcast', { event: 'task_completed' }, (payload) => {
          const data = payload.payload as TaskCompletedPayload;
          if (callbacksRef.current.onTaskCompleted) callbacksRef.current.onTaskCompleted(data);
        })
        .on('broadcast', { event: 'SKIP_DISCUSSION' }, () => {
          if (callbacksRef.current.onSkipDiscussion) callbacksRef.current.onSkipDiscussion();
        })
        .on('broadcast', { event: 'skip_discussion' }, () => {
          if (callbacksRef.current.onSkipDiscussion) callbacksRef.current.onSkipDiscussion();
        })
        .on('broadcast', { event: 'PLAYER_VOTED' }, (payload) => {
          if (callbacksRef.current.onVoteCast) callbacksRef.current.onVoteCast(payload.payload);
        })
        .on('broadcast', { event: 'VOTING_FINISHED' }, (payload) => {
          if (callbacksRef.current.onVotingFinished) callbacksRef.current.onVotingFinished(payload.payload);
        })
        .on('broadcast', { event: 'PLAYER_KICKED' }, (payload) => {
          if (callbacksRef.current.onPlayerKicked) callbacksRef.current.onPlayerKicked(payload.payload);
        })
        .on('broadcast', { event: 'player_kicked' }, (payload) => {
          if (callbacksRef.current.onPlayerKicked) callbacksRef.current.onPlayerKicked(payload.payload);
        })
        .on('broadcast', { event: 'CREWMATE_VICTORY' }, (payload) => {
          if (callbacksRef.current.onCrewmateVictory) callbacksRef.current.onCrewmateVictory(payload.payload);
        })
        .on('broadcast', { event: 'crewmate_victory' }, (payload) => {
          if (callbacksRef.current.onCrewmateVictory) callbacksRef.current.onCrewmateVictory(payload.payload);
        })
        .on('broadcast', { event: 'IMPOSTOR_VICTORY' }, (payload) => {
          if (callbacksRef.current.onImpostorVictory) callbacksRef.current.onImpostorVictory(payload.payload);
        })
        .on('broadcast', { event: 'impostor_victory' }, (payload) => {
          if (callbacksRef.current.onImpostorVictory) callbacksRef.current.onImpostorVictory(payload.payload);
        })
        .on('broadcast', { event: 'RETURN_TO_LOBBY' }, () => {
          if (callbacksRef.current.onRoomStatusChanged) callbacksRef.current.onRoomStatusChanged('LOBBY');
        })
        .on('broadcast', { event: 'return_to_lobby' }, () => {
          if (callbacksRef.current.onRoomStatusChanged) callbacksRef.current.onRoomStatusChanged('LOBBY');
        })
        .on('broadcast', { event: 'ROOM_STATUS_CHANGED' }, (payload) => {
          if (payload?.payload?.status && callbacksRef.current.onRoomStatusChanged) {
            callbacksRef.current.onRoomStatusChanged(payload.payload.status);
          }
        })
        .on('broadcast', { event: 'ROOM_CLOSED' }, (payload) => {
          if (callbacksRef.current.onRoomClosed) callbacksRef.current.onRoomClosed(payload.payload || {});
        })
        .on('broadcast', { event: 'room_closed' }, (payload) => {
          if (callbacksRef.current.onRoomClosed) callbacksRef.current.onRoomClosed(payload.payload || {});
        });

      // Listener de Postgres Changes (Apenas se roomId for um UUID válido)
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);
      if (isValidUuid) {
        channel.on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
          (payload: any) => {
            if (payload.new?.status && callbacksRef.current.onRoomStatusChanged) {
              callbacksRef.current.onRoomStatusChanged(payload.new.status);
            }
            if (payload.new?.status === 'ENDED' && callbacksRef.current.onRoomClosed) {
              callbacksRef.current.onRoomClosed({ reason: 'HOST_CLOSED' });
            }
            if (payload.new?.status === 'EMERGENCY_MEETING' && callbacksRef.current.onEmergencyMeeting) {
              callbacksRef.current.onEmergencyMeeting({ reporterId: '', reporterName: 'Tripulante' });
            }
          }
        );
      }

      // Listeners de Presence
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState<PresencePlayer>();
          const activePlayers: PresencePlayer[] = [];

          Object.values(state).forEach((presences) => {
            presences.forEach((p: any) => {
              if (!p) return;
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

              activePlayers.push(p);
            });
          });

          if (isMounted) {
            setPresencePlayers(activePlayers);
            if (callbacksRef.current.onPlayersPresenceChanged) {
              callbacksRef.current.onPlayersPresenceChanged(activePlayers);
            }
          }
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          console.log('[RealtimeGame] Jogador conectado à sala:', newPresences);
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          console.log('[RealtimeGame] Jogador desconectado da sala:', leftPresences);
        });

      // Inscrição do Canal
      channel.subscribe(async (status, err) => {
        if (!isMounted) return;

        if (status === 'SUBSCRIBED') {
          setConnectionState('CONNECTED');

          // Registrar estado inicial do jogador no Presence
          const effectiveId = playerRef.current.playerId || `guest_${Date.now()}`;
          if (!isTrackedRef.current) {
            isTrackedRef.current = true;
            let userId = '';
            try {
              const { data: userData } = await supabase.auth.getUser();
              userId = userData?.user?.id || '';
            } catch {}

            const presencePayload = {
              id: effectiveId,
              playerId: effectiveId,
              user_id: userId,
              name: playerRef.current.playerName || 'Tripulante',
              player_name: playerRef.current.playerName || 'Tripulante',
              color_hex: playerRef.current.playerColor || '#ef4444',
              is_alive: playerRef.current.isAlive,
              online_at: new Date().toISOString(),
            };

            await channel.track(presencePayload).catch(() => {});

            // Enviar evento broadcast imediato para notificar o Host (< 50ms)
            await channel.send({
              type: 'broadcast',
              event: 'PLAYER_JOINED',
              payload: presencePayload,
            }).catch(() => {});
          }

          if (callbacksRef.current.onChannelSubscribed) {
            callbacksRef.current.onChannelSubscribed();
          }
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          setConnectionState('ERROR');
          if (err) console.warn('[RealtimeGame] Erro na conexão com o canal:', err);
        } else if (status === 'CLOSED') {
          setConnectionState('DISCONNECTED');
        }
      });
    };

    setupRealtimeChannel();

    return () => {
      isMounted = false;
      isTrackedRef.current = false;

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, roomCode, supabase]);

  return {
    connectionState,
    latency: 0,
    presencePlayers,
    killPlayer,
    triggerEmergencyMeeting,
    triggerSabotage,
    fixSabotage,
    broadcastEvent,
    channel: channelRef.current,
  };
}
