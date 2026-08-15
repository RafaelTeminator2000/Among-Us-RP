'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  onRoomStatusChanged?: (newStatus: string) => void;
  onPlayersPresenceChanged?: (players: PresencePlayer[]) => void;
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
  onRoomStatusChanged,
  onPlayersPresenceChanged,
}: UseRealtimeGameProps) {
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('CONNECTING');
  const [latency, setLatency] = useState<number | null>(14);
  const [presencePlayers, setPresencePlayers] = useState<PresencePlayer[]>([]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  // Manter refs atualizadas de callbacks e props do jogador para evitar re-subscriptions infinitos
  const callbacksRef = useRef({
    onGameStarted,
    onPlayerKilled,
    onEmergencyMeeting,
    onSabotageTriggered,
    onSabotageFixed,
    onRoomStatusChanged,
    onPlayersPresenceChanged,
  });

  useEffect(() => {
    callbacksRef.current = {
      onGameStarted,
      onPlayerKilled,
      onEmergencyMeeting,
      onSabotageTriggered,
      onSabotageFixed,
      onRoomStatusChanged,
      onPlayersPresenceChanged,
    };
  }, [
    onGameStarted,
    onPlayerKilled,
    onEmergencyMeeting,
    onSabotageTriggered,
    onSabotageFixed,
    onRoomStatusChanged,
    onPlayersPresenceChanged,
  ]);


  const playerRef = useRef({ playerId, playerName, playerColor, playerRole, isAlive });
  useEffect(() => {
    playerRef.current = { playerId, playerName, playerColor, playerRole, isAlive };
  }, [playerId, playerName, playerColor, playerRole, isAlive]);


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

  // Medição periódica de Latência via Ping/Pong (< 50ms requirement)
  const measureLatency = useCallback(() => {
    if (!channelRef.current) return;
    const start = performance.now();
    channelRef.current.send({
      type: 'broadcast',
      event: 'ping_check',
      payload: { timestamp: start },
    });
  }, []);

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

      // Tentar atualizar token de auth RLS
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          await supabase.realtime.setAuth(sessionData.session.access_token);
        }
      } catch (err) {
        console.warn('[RealtimeGame] Aviso ao definir token RLS:', err);
      }

      if (!isMounted) return;

      // Criar canal único
      const channel = supabase.channel(channelTopic, {
        config: {
          broadcast: { self: false },
          presence: {
            key: playerRef.current.playerId || `anon_${Date.now()}`,
          },
        },
      });

      channelRef.current = channel;

      // Listeners de Broadcast
      channel
        .on('broadcast', { event: 'GAME_STARTED' }, (payload) => {
          const data = payload.payload as GameStartedPayload;
          if (callbacksRef.current.onGameStarted) callbacksRef.current.onGameStarted(data);
          if (callbacksRef.current.onRoomStatusChanged) callbacksRef.current.onRoomStatusChanged(data.status || 'PLAYING');
        })
        .on('broadcast', { event: 'game_started' }, (payload) => {
          const data = payload.payload as GameStartedPayload;
          if (callbacksRef.current.onGameStarted) callbacksRef.current.onGameStarted(data);
          if (callbacksRef.current.onRoomStatusChanged) callbacksRef.current.onRoomStatusChanged(data.status || 'PLAYING');
        })
        .on('broadcast', { event: 'player_killed' }, (payload) => {
          const data = payload.payload as PlayerKilledPayload;
          if (callbacksRef.current.onPlayerKilled) callbacksRef.current.onPlayerKilled(data);
        })

        .on('broadcast', { event: 'emergency_meeting' }, (payload) => {
          const data = payload.payload as EmergencyMeetingPayload;
          if (callbacksRef.current.onEmergencyMeeting) callbacksRef.current.onEmergencyMeeting(data);
        })
        .on('broadcast', { event: 'sabotage_triggered' }, (payload) => {
          const data = payload.payload as SabotageTriggeredPayload;
          if (callbacksRef.current.onSabotageTriggered) callbacksRef.current.onSabotageTriggered(data);
        })
        .on('broadcast', { event: 'sabotage_fixed' }, (payload) => {
          const data = payload.payload as SabotageFixedPayload;
          if (callbacksRef.current.onSabotageFixed) callbacksRef.current.onSabotageFixed(data);
        })
        .on('broadcast', { event: 'ping_check' }, (payload) => {
          if (payload.payload?.timestamp && isMounted) {
            const rtt = Math.max(1, Math.round(performance.now() - payload.payload.timestamp));
            setLatency(rtt);
          }
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
          }
        );
      }

      // Listeners de Presence
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState<PresencePlayer>();
          const activePlayers: PresencePlayer[] = [];

          Object.values(state).forEach((presences) => {
            presences.forEach((p) => {
              if (p) activePlayers.push(p);
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

          // Registrar estado inicial do jogador no Presence APENAS UMA VEZ
          if (playerRef.current.playerId && !isTrackedRef.current) {
            isTrackedRef.current = true;
            const { data: userData } = await supabase.auth.getUser();
            const presencePayload = {
              id: playerRef.current.playerId,
              playerId: playerRef.current.playerId,
              user_id: userData?.user?.id || '',
              name: playerRef.current.playerName,
              player_name: playerRef.current.playerName,
              color_hex: playerRef.current.playerColor,
              role: playerRef.current.playerRole,
              is_alive: playerRef.current.isAlive,
              online_at: new Date().toISOString(),
            };

            await channel.track(presencePayload);

            // Enviar evento broadcast imediato para notificar o Host (< 50ms)
            await channel.send({
              type: 'broadcast',
              event: 'PLAYER_JOINED',
              payload: presencePayload,
            });
          }

          // Medição de latência a cada 5s
          if (pingTimerRef.current) clearInterval(pingTimerRef.current);
          pingTimerRef.current = setInterval(() => {
            measureLatency();
          }, 5000);
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

      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, supabase, measureLatency]);

  return {
    connectionState,
    latency,
    presencePlayers,
    killPlayer,
    triggerEmergencyMeeting,
    triggerSabotage,
    fixSabotage,
    broadcastEvent,
    channel: channelRef.current,
  };
}
