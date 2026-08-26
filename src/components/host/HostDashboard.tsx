"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Crown,
  Users,
  Shield,
  Zap,
  Play,
  Copy,
  Check,
  Flame,
  Radio,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Printer,
  Clock,
  MessageSquare,
  X,
  AlertTriangle,
  Lightbulb,
  Activity,
  Tv,
  RotateCcw,
} from "lucide-react";

interface Player {
  id: string;
  room_id: string;
  player_name: string;
  color_hex: string;
  status: string;
  role?: string | null;
  completed_tasks?: any;
}

interface HostDashboardProps {
  roomId: string;
  roomCode: string;
  initialPlayers?: Player[];
  onGameStarted?: () => void;
}

type HostTab = "JOGO" | "TASKS" | "LOBBY" | "MASTER";

export const HostDashboard: React.FC<HostDashboardProps> = ({
  roomId,
  roomCode,
  initialPlayers,
  onGameStarted,
}) => {
  const supabase = createClient();

  // Sub-Estado / Aba Ativa
  const [activeTab, setActiveTab] = useState<HostTab>("LOBBY");

  // Estado do Jogo
  const [players, setPlayers] = useState<Player[]>(initialPlayers || []);
  const [isGameRunning, setIsGameRunning] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [globalTaskProgress, setGlobalTaskProgress] = useState<number>(0);
  const [actionLogs, setActionLogs] = useState<string[]>([
    "Host abriu o lobby presencial.",
    "Aguardando tripulantes escanearem o código.",
  ]);

  // Configurações Gerais (Estado 3.1: JOGO)
  const [impostorCount, setImpostorCount] = useState<number>(1);
  const [killCooldown, setKillCooldown] = useState<number>(30);
  const [discussionTime, setDiscussionTime] = useState<number>(15);
  const [votingTime, setVotingTime] = useState<number>(30);
  const [anonymousVotes, setAnonymousVotes] = useState<boolean>(false);
  const [confirmEjections, setConfirmEjections] = useState<boolean>(true);

  // Configurações de Tasks & Phygital (Estado 3.2: TASKS)
  const [taskCount, setTaskCount] = useState<number>(4);
  const [taskBarUpdateMode, setTaskBarUpdateMode] = useState<"ALWAYS" | "MEETINGS">("ALWAYS");
  const [enableLightsSabotage, setEnableLightsSabotage] = useState<boolean>(true);
  const [enableReactorSabotage, setEnableReactorSabotage] = useState<boolean>(true);

  // UI States
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const channelRef = useRef<any>(null);

  // Cronômetro da partida quando em jogo
  useEffect(() => {
    let interval: any = null;
    if (isGameRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGameRunning]);

  // Recálculo dinâmico do progresso global de tarefas considerando APENAS tripulantes (desconsidera Impostores)
  const crewmates = players.filter((p) => p.role !== "IMPOSTOR");
  const aliveCrewmates = crewmates.filter((p) => p.status === "ALIVE" || (p as any).is_alive !== false);
  const crewmateCount = aliveCrewmates.length > 0
    ? aliveCrewmates.length
    : (crewmates.length > 0 ? crewmates.length : Math.max(1, players.length));
  const totalRoomTasks = Math.max(1, crewmateCount * taskCount);
  const totalCompletedTasks = crewmates.reduce((acc, p) => {
    let count = 0;
    if (Array.isArray(p.completed_tasks)) {
      count = p.completed_tasks.length;
    } else if (typeof p.completed_tasks === "number") {
      count = p.completed_tasks;
    }
    return acc + count;
  }, 0);
  const calculatedGlobalTaskProgress = Math.min(
    100,
    Math.round((totalCompletedTasks / totalRoomTasks) * 100)
  );

  useEffect(() => {
    setGlobalTaskProgress(calculatedGlobalTaskProgress);
  }, [calculatedGlobalTaskProgress]);

  useEffect(() => {
    if (typeof window !== 'undefined' && roomId) {
      localStorage.setItem('host_current_room_id', roomId);
      if (roomCode) localStorage.setItem('host_current_room_code', roomCode);
    }
  }, [roomId, roomCode]);

  // Escuta Realtime e Presença
  useEffect(() => {
    if (!roomId) return;

    const isUuid = (str?: string) =>
      typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const topicKey = (roomCode || roomId).trim().toLowerCase();
    const channelTopic = `room:${topicKey}:game_flow`;
    const channel = supabase.channel(channelTopic, {
      config: {
        broadcast: { self: true },
        presence: {
          key: `host_${Date.now()}`,
        },
      },
    });

    channelRef.current = channel;

    // Registrar ouvintes postgres_changes de forma SÍNCRONA antes de chamar subscribe()
    if (isUuid(roomId)) {
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "room_players",
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              setPlayers((prev) => {
                if (prev.some((p) => p.id === (payload.new as Player).id)) return prev;
                return [...prev, payload.new as Player];
              });
            } else if (payload.eventType === "DELETE") {
              setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id));
            } else if (payload.eventType === "UPDATE") {
              setPlayers((prev) =>
                prev.map((p) => (p.id === (payload.new as Player).id ? (payload.new as Player) : p))
              );
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "rooms",
            filter: `id=eq.${roomId}`,
          },
          (payload: any) => {
            const newStatus = payload.new?.status;
            if (newStatus === "PLAYING" || newStatus === "EMERGENCY_MEETING") {
              setIsGameRunning(true);
              setActiveTab("MASTER");
            } else if (newStatus === "LOBBY" || newStatus === "ENDED" || newStatus === "FINISHED") {
              setIsGameRunning(false);
              setActiveTab("LOBBY");
            }
          }
        );
    }

    const fetchRoomAndPlayers = async () => {
      const cleanCode = (roomCode || roomId || "").trim().toUpperCase();
      let resolvedUuid = isUuid(roomId) ? roomId : null;

      // 1. Buscar status atual da sala no banco de dados por UUID ou CODE de 4 dígitos
      let roomQuery = supabase.from("rooms").select("id, status, rules");
      if (resolvedUuid) {
        roomQuery = roomQuery.eq("id", resolvedUuid);
      } else if (cleanCode) {
        roomQuery = roomQuery.eq("code", cleanCode);
      }

      const { data: roomData } = await roomQuery.maybeSingle();

      if (roomData) {
        resolvedUuid = roomData.id;

        if (roomData.status === "PLAYING" || roomData.status === "EMERGENCY_MEETING") {
          setIsGameRunning(true);
          setActiveTab("MASTER");
        } else if (roomData.status === "LOBBY" || roomData.status === "ENDED" || roomData.status === "FINISHED") {
          setIsGameRunning(false);
          setActiveTab("LOBBY");
        }

        if (roomData.rules) {
          const rules = roomData.rules as any;
          if (rules.impostor_count || rules.impostorCount) setImpostorCount(Number(rules.impostor_count || rules.impostorCount));
          if (rules.kill_cooldown || rules.killCooldown) setKillCooldown(Number(rules.kill_cooldown || rules.killCooldown));
          if (rules.task_count || rules.taskCount) setTaskCount(Number(rules.task_count || rules.taskCount));
          if (rules.discussion_time || rules.discussionTime) setDiscussionTime(Number(rules.discussion_time || rules.discussionTime));
          if (rules.voting_time || rules.votingTime) setVotingTime(Number(rules.voting_time || rules.votingTime));
        }
      }

      // 2. Buscar lista de jogadores cadastrados na sala (apenas se for um UUID válido no Postgres)
      const targetRoomId = resolvedUuid || (isUuid(roomId) ? roomId : null);
      if (targetRoomId && isUuid(targetRoomId)) {
        const { data: playersData, error: playersError } = await supabase
          .from("room_players")
          .select("*")
          .eq("room_id", targetRoomId);

        if (playersError) {
          console.error("Erro ao buscar jogadores do Supabase:", playersError.message || playersError);
        } else if (playersData) {
          setPlayers(playersData as Player[]);
        }
      } else if (initialPlayers && initialPlayers.length > 0) {
        setPlayers(initialPlayers);
      }
    };

    fetchRoomAndPlayers();

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const activePresencePlayersMap = new Map<string, Player>();

        Object.values(state).forEach((presences) => {
          presences.forEach((p: any) => {
            if (p && (p.id || p.playerId) && (p.name || p.player_name || p.playerName)) {
              const pid = (p.id || p.playerId || "").toString();
              const pName = (p.name || p.player_name || p.playerName || "").toString().toLowerCase();

              // Ignorar presenças de sistema (Telão da TV e Console do Host)
              if (
                pid.startsWith("host_") ||
                pid.startsWith("tv_") ||
                pName.includes("telão central") ||
                pName.includes("telao central") ||
                pName.includes("host suite") ||
                p.is_system === true
              ) {
                return;
              }

              activePresencePlayersMap.set(pid, {
                id: pid,
                room_id: roomId,
                player_name: p.name || p.player_name || p.playerName || "Tripulante",
                color_hex: p.color_hex || p.colorHex || "#3b82f6",
                status: p.is_alive !== false ? "ALIVE" : "ELIMINATED",
                role: p.role || null,
              });
            }
          });
        });

        setPlayers((prev) => {
          const mergedMap = new Map<string, Player>();
          prev.forEach((player) => {
            // Manter se for bot ou se estiver no Presence ativo
            if (player.id.startsWith("bot_")) {
              mergedMap.set(player.id, player);
            } else if (activePresencePlayersMap.has(player.id)) {
              const pres = activePresencePlayersMap.get(player.id)!;
              mergedMap.set(player.id, {
                ...pres,
                role: pres.role || player.role || null,
                completed_tasks: player.completed_tasks ?? pres.completed_tasks,
              });
            } else if (isGameRunning) {
              // Se em jogo, manter jogador (pode ter sido desconectado temporariamente)
              mergedMap.set(player.id, player);
            }
            // Se no Lobby e não está no Presence nem é bot, é removido!
          });

          // Adicionar novos jogadores do Presence
          activePresencePlayersMap.forEach((player, pid) => {
            if (!mergedMap.has(pid)) {
              mergedMap.set(pid, player);
            }
          });

          return Array.from(mergedMap.values()).filter((p) => {
            const name = (p.player_name || "").toLowerCase();
            const id = (p.id || "").toString();
            return (
              !id.startsWith("tv_") &&
              !id.startsWith("host_") &&
              !name.includes("telão central") &&
              !name.includes("telao central")
            );
          });
        });
      })
      .on("broadcast", { event: "PLAYER_JOINED" }, ({ payload }) => {
        if (payload && (payload.id || payload.playerId)) {
          const pid = (payload.id || payload.playerId || "").toString();
          const pName = (payload.player_name || payload.name || payload.playerName || "").toString().toLowerCase();

          if (
            pid.startsWith("host_") ||
            pid.startsWith("tv_") ||
            pName.includes("telão central") ||
            pName.includes("telao central") ||
            pName.includes("host suite") ||
            payload.is_system === true
          ) {
            return;
          }
          const newPlayer: Player = {
            id: payload.id || payload.playerId,
            room_id: roomId,
            player_name: payload.player_name || payload.name || payload.playerName || "Tripulante",
            color_hex: payload.color_hex || payload.colorHex || "#3b82f6",
            status: "ALIVE",
            role: payload.role || null,
          };
          setPlayers((prev) => {
            if (prev.some((p) => p.id === newPlayer.id)) return prev;
            return [...prev, newPlayer];
          });
          setActionLogs((prev) => [
            `+ ${newPlayer.player_name} entrou no lobby.`,
            ...prev.slice(0, 8),
          ]);
        }
      })
      .on("broadcast", { event: "TASK_COMPLETED" }, ({ payload }) => {
        if (payload?.playerId) {
          setPlayers((prev) =>
            prev.map((p) => {
              if (p.id === payload.playerId) {
                const currentCount = Array.isArray(p.completed_tasks)
                  ? p.completed_tasks.length
                  : typeof p.completed_tasks === "number"
                  ? p.completed_tasks
                  : 0;
                const newCount = payload.completedCount ?? (currentCount + 1);
                return { ...p, completed_tasks: newCount };
              }
              return p;
            })
          );
        }
        setActionLogs((prev) => [
          `✓ Tarefa concluída por ${payload?.playerName || payload?.name || "Tripulante"}`,
          ...prev.slice(0, 8),
        ]);
      })
      .on("broadcast", { event: "task_completed" }, ({ payload }) => {
        if (payload?.playerId) {
          setPlayers((prev) =>
            prev.map((p) => {
              if (p.id === payload.playerId) {
                const currentCount = Array.isArray(p.completed_tasks)
                  ? p.completed_tasks.length
                  : typeof p.completed_tasks === "number"
                  ? p.completed_tasks
                  : 0;
                const newCount = payload.completedCount ?? (currentCount + 1);
                return { ...p, completed_tasks: newCount };
              }
              return p;
            })
          );
        }
      })
      .on("broadcast", { event: "KILL_PERFORMED" }, ({ payload }) => {
        setActionLogs((prev) => [
          `💀 Um tripulante foi abatido em segredo!`,
          ...prev.slice(0, 8),
        ]);
      })
      .on("broadcast", { event: "EMERGENCY_TRIGGERED" }, ({ payload }) => {
        setActionLogs((prev) => [
          `🚨 REUNIÃO DE EMERGÊNCIA acionada por ${payload?.reporterName || "Tripulante"}!`,
          ...prev.slice(0, 8),
        ]);
      })
      .on("broadcast", { event: "CREWMATE_VICTORY" }, ({ payload }) => {
        setStatusMessage("🎉 Vitória dos Tripulantes! Todas as tarefas foram concluídas (100%).");
        setActionLogs((prev) => [
          `🏆 VITÓRIA DOS TRIPULANTES! Todas as tarefas concluídas.`,
          ...prev.slice(0, 8),
        ]);
      })
      .on("broadcast", { event: "crewmate_victory" }, ({ payload }) => {
        setStatusMessage("🎉 Vitória dos Tripulantes! Todas as tarefas foram concluídas (100%).");
        setActionLogs((prev) => [
          `🏆 VITÓRIA DOS TRIPULANTES! Todas as tarefas concluídas.`,
          ...prev.slice(0, 8),
        ]);
      })
      .on("broadcast", { event: "IMPOSTOR_VICTORY" }, ({ payload }) => {
        setStatusMessage("🔪 Vitória dos Impostores! Os impostores dominaram a tripulação.");
        setActionLogs((prev) => [
          `🔪 VITÓRIA DOS IMPOSTORES! Tripulação eliminada.`,
          ...prev.slice(0, 8),
        ]);
      })
      .on("broadcast", { event: "impostor_victory" }, ({ payload }) => {
        setStatusMessage("🔪 Vitória dos Impostores! Os impostores dominaram a tripulação.");
        setActionLogs((prev) => [
          `🔪 VITÓRIA DOS IMPOSTORES! Tripulação eliminada.`,
          ...prev.slice(0, 8),
        ]);
      })
      .on("broadcast", { event: "RETURN_TO_LOBBY" }, () => {
        setIsGameRunning(false);
        setActiveTab("LOBBY");
        setStatusMessage("Retornado ao Lobby de espera.");
      })
      .on("broadcast", { event: "return_to_lobby" }, () => {
        setIsGameRunning(false);
        setActiveTab("LOBBY");
        setStatusMessage("Retornado ao Lobby de espera.");
      });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, roomCode, initialPlayers, supabase]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Expulsar jogador
  const handleKickPlayer = async (playerId: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    setActionLogs((prev) => [`✕ Jogador expulso pelo host.`, ...prev.slice(0, 8)]);

    // Transmitir evento broadcast PLAYER_KICKED em tempo real
    if (channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event: "PLAYER_KICKED",
        payload: { playerId, kickedId: playerId },
      }).catch(() => {});
    }

    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);
    if (isValidUuid) {
      await supabase.from("room_players").delete().eq("id", playerId);
    }
  };

  // Iniciar Partida
  const handleStartGame = async () => {
    if (players.length < 1) {
      setStatusMessage("Aguarde ao menos 1 jogador conectar para iniciar.");
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }

    setIsStarting(true);
    setStatusMessage("Sorteando papéis secretos e iniciando partida...");

    try {
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);

      // Sortear papéis
      const shuffled = [...players].sort(() => 0.5 - Math.random());
      const numImpostors = players.length === 1 ? 1 : Math.max(1, Math.min(impostorCount, players.length - 1));
      const impostorIds = new Set(shuffled.slice(0, numImpostors).map((p) => p.id));

      const rolesMap: Record<string, "CREWMATE" | "IMPOSTOR"> = {};
      players.forEach((p) => {
        rolesMap[p.id] = impostorIds.has(p.id) ? "IMPOSTOR" : "CREWMATE";
      });

      // Atualizar papéis dos jogadores localmente no estado do Host
      setPlayers((prev) =>
        prev.map((p) => ({
          ...p,
          role: rolesMap[p.id] || p.role || "CREWMATE",
        }))
      );

      if (isValidUuid) {
        const isPlayerUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        for (const player of players) {
          const role = rolesMap[player.id];
          if (isPlayerUuid(player.id)) {
            await supabase
              .from("room_players")
              .update({ role })
              .eq("id", player.id);
          }
        }

        await supabase
          .from("rooms")
          .update({
            status: "PLAYING",
            rules: {
              kill_cooldown: killCooldown,
              impostor_count: impostorCount,
              task_count: taskCount,
              discussion_time: discussionTime,
              voting_time: votingTime,
              confirm_ejects: confirmEjections,
              anonymous_votes: anonymousVotes,
            },
          })
          .eq("id", roomId);
      }

      const payload = {
        status: "PLAYING",
        roles: rolesMap,
        rules: {
          killCooldown,
          impostorCount,
          taskCount,
          task_count: taskCount,
          discussionTime,
          votingTime,
          confirmEjections,
          anonymousVotes,
        },
        timestamp: Date.now(),
      };

      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "GAME_STARTED",
          payload,
        });
      }

      setIsGameRunning(true);
      setActiveTab("MASTER");
      setStatusMessage("Partida iniciada com sucesso!");

      if (onGameStarted) {
        onGameStarted();
      }
    } catch (error: any) {
      console.error("Erro ao iniciar partida:", error?.message || error);
      setStatusMessage("Erro ao iniciar partida.");
    } finally {
      setIsStarting(false);
    }
  };

  // Disparar Reunião Forçada pelo Host
  const handleForceMeeting = async () => {
    if (channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event: "EMERGENCY_TRIGGERED",
        payload: {
          reporterId: "HOST_CONSOLE",
          reporterName: "HOST (Console Central)",
          discussionTime,
          votingTime,
        },
      });
      setActionLogs((prev) => ["🚨 Reunião forçada disparada pelo Host!", ...prev.slice(0, 8)]);
    }
  };

  // Acionar Sabotagem de Luzes
  const handleTriggerLightsSabotage = async () => {
    if (channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event: "SABOTAGE_TRIGGERED",
        payload: {
          type: "LIGHTS",
          timestamp: Date.now(),
        },
      });
      setActionLogs((prev) => ["⚡ Sabotagem de Luzes acionada!", ...prev.slice(0, 8)]);
    }
  };

  // Formatação de Tempo MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative w-full max-w-md mx-auto min-h-[92vh] bg-deep-space-stars text-white rounded-3xl overflow-hidden console-card flex flex-col justify-between p-4 select-none font-sans shadow-2xl">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER DO CONSOLE: HOST AVATAR & ABAS ESTILO CONSOLE */}
      <header className="z-10 space-y-3 border-b border-slate-800 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 shadow-md">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold uppercase text-cyan-400 tracking-wider">
                HOST SUITE
              </div>
              <h1
                style={{ fontFamily: "var(--font-anton), Anton, sans-serif" }}
                className="text-lg uppercase tracking-wider text-white"
              >
                PAINEL DO DIRETOR
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/room/${roomCode}/tv`}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-400 transition-all flex items-center justify-center shadow-md cursor-pointer"
              title="Abrir Modo Telão TV"
            >
              <Tv className="w-4 h-4" />
            </Link>

            <Link
              href="/admin/print"
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-400 transition-all flex items-center justify-center shadow-md cursor-pointer"
              title="Imprimir Folha de QR Codes"
            >
              <Printer className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* NAVEGAÇÃO POR ABAS CONSOLE */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("LOBBY")}
            className={`py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
              activeTab === "LOBBY"
                ? "bg-cyan-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Lobby
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("JOGO")}
            className={`py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
              activeTab === "JOGO"
                ? "bg-cyan-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Jogo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("TASKS")}
            className={`py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
              activeTab === "TASKS"
                ? "bg-cyan-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("MASTER")}
            className={`py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
              activeTab === "MASTER"
                ? "bg-red-500 text-white shadow-md animate-pulse"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Master
          </button>
        </div>
      </header>

      {/* MENSAGEM DE STATUS */}
      {statusMessage && (
        <div className="z-10 my-2 p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-200 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CORPO CENTRAL DINÂMICO CONFORME A ABA SELECIONADA                         */}
      {/* ========================================================================= */}
      <main className="z-10 my-auto flex-1 flex flex-col justify-between py-2 overflow-y-auto pr-1">
        {/* ----------------------------------------------------------------------- */}
        {/* ESTADO 3.1: CONFIGURAÇÕES GERAIS (JOGO)                                 */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === "JOGO" && (
          <div className="space-y-3 animate-in fade-in">
            <div className="text-xs font-mono font-bold uppercase text-slate-400 flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              <span>Ajustes de Partida</span>
            </div>

            {/* Stepper: Nº de Impostores */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-red-400" />
                  Nº de Impostores
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Alerta Vermelho</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImpostorCount((prev) => Math.max(1, prev - 1))}
                  className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 text-lg font-bold text-slate-200 hover:border-cyan-400 active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <span
                  style={{ fontFamily: "var(--font-barlow), Barlow, sans-serif" }}
                  className="w-12 text-center text-xl font-bold text-cyan-400"
                >
                  {impostorCount}
                </span>
                <button
                  type="button"
                  onClick={() => setImpostorCount((prev) => Math.min(3, prev + 1))}
                  className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 text-lg font-bold text-slate-200 hover:border-cyan-400 active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Stepper: Cooldown de Morte */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Cooldown de Morte
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Tempo entre abates</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setKillCooldown((prev) => Math.max(10, prev - 5))}
                  className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 text-lg font-bold text-slate-200 hover:border-cyan-400 active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <span
                  style={{ fontFamily: "var(--font-barlow), Barlow, sans-serif" }}
                  className="w-12 text-center text-xl font-bold text-cyan-400"
                >
                  {killCooldown}s
                </span>
                <button
                  type="button"
                  onClick={() => setKillCooldown((prev) => Math.min(60, prev + 5))}
                  className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 text-lg font-bold text-slate-200 hover:border-cyan-400 active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Stepper: Tempo de Discussão */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  Tempo de Discussão
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Deslocamento presencial</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDiscussionTime((prev) => Math.max(0, prev - 5))}
                  className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 text-lg font-bold text-slate-200 hover:border-cyan-400 active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <span
                  style={{ fontFamily: "var(--font-barlow), Barlow, sans-serif" }}
                  className="w-12 text-center text-xl font-bold text-cyan-400"
                >
                  {discussionTime}s
                </span>
                <button
                  type="button"
                  onClick={() => setDiscussionTime((prev) => Math.min(120, prev + 5))}
                  className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 text-lg font-bold text-slate-200 hover:border-cyan-400 active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Stepper: Tempo de Votação */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Tempo de Votação
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Voto no tablet móvel</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVotingTime((prev) => Math.max(15, prev - 5))}
                  className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 text-lg font-bold text-slate-200 hover:border-cyan-400 active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <span
                  style={{ fontFamily: "var(--font-barlow), Barlow, sans-serif" }}
                  className="w-12 text-center text-xl font-bold text-cyan-400"
                >
                  {votingTime}s
                </span>
                <button
                  type="button"
                  onClick={() => setVotingTime((prev) => Math.min(180, prev + 5))}
                  className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 text-lg font-bold text-slate-200 hover:border-cyan-400 active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Toggles: Votos Anônimos e Confirmar Ejeções */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAnonymousVotes(!anonymousVotes)}
                className={`p-3 rounded-2xl border flex flex-col justify-between text-left transition-all cursor-pointer ${
                  anonymousVotes
                    ? "bg-cyan-950/60 border-cyan-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                <span className="text-[11px] font-bold">Votos Anônimos</span>
                <span className="text-[10px] font-mono text-cyan-400 font-bold mt-1">
                  {anonymousVotes ? "[ ON ]" : "[ OFF ]"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmEjections(!confirmEjections)}
                className={`p-3 rounded-2xl border flex flex-col justify-between text-left transition-all cursor-pointer ${
                  confirmEjections
                    ? "bg-cyan-950/60 border-cyan-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                <span className="text-[11px] font-bold">Confirmar Ejeções</span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold mt-1">
                  {confirmEjections ? "[ ON ]" : "[ OFF ]"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* ESTADO 3.2: CONFIGURAÇÃO DE TASKS & PHYGITAL (TASKS)                    */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === "TASKS" && (
          <div className="space-y-3 animate-in fade-in">
            <div className="text-xs font-mono font-bold uppercase text-slate-400 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Configuração Phygital & Tarefas</span>
            </div>

            {/* Stepper: Tarefas por Tripulante */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200">Tarefas por Tripulante</span>
                <span className="text-[10px] text-slate-400 block font-mono">Qtd. sorteada por jogador</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTaskCount((prev) => Math.max(1, prev - 1))}
                  className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 text-lg font-bold text-slate-200 hover:border-emerald-400 active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <span
                  style={{ fontFamily: "var(--font-barlow), Barlow, sans-serif" }}
                  className="w-12 text-center text-xl font-bold text-emerald-400"
                >
                  {taskCount}
                </span>
                <button
                  type="button"
                  onClick={() => setTaskCount((prev) => Math.min(8, prev + 1))}
                  className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 text-lg font-bold text-slate-200 hover:border-emerald-400 active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Seletor de Atualização da Barra de Tarefas */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-200 block">Atualização da Barra Global</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTaskBarUpdateMode("ALWAYS")}
                  className={`py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                    taskBarUpdateMode === "ALWAYS"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  Sempre Visível
                </button>
                <button
                  type="button"
                  onClick={() => setTaskBarUpdateMode("MEETINGS")}
                  className={`py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                    taskBarUpdateMode === "MEETINGS"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  Nas Reuniões
                </button>
              </div>
            </div>

            {/* Sabotagens Físicas Habilitadas */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-200 block">Sabotagens Permitidas</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEnableLightsSabotage(!enableLightsSabotage)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold cursor-pointer ${
                    enableLightsSabotage
                      ? "bg-red-950/60 border-red-500 text-white"
                      : "bg-slate-900 border-slate-800 text-slate-500"
                  }`}
                >
                  <span>⚡ Apagar Luzes</span>
                  <span className="font-mono">{enableLightsSabotage ? "✓" : "✕"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEnableReactorSabotage(!enableReactorSabotage)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold cursor-pointer ${
                    enableReactorSabotage
                      ? "bg-red-950/60 border-red-500 text-white"
                      : "bg-slate-900 border-slate-800 text-slate-500"
                  }`}
                >
                  <span>🔥 Reator Crítico</span>
                  <span className="font-mono">{enableReactorSabotage ? "✓" : "✕"}</span>
                </button>
              </div>
            </div>

            {/* Ação Secundária: Imprimir Folha de QR Codes */}
            <Link
              href="/admin/print"
              className="w-full h-[50px] rounded-2xl btn-3d-amber flex items-center justify-center gap-2 text-sm font-black uppercase cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ IMPRIMIR FOLHA DE QR CODES</span>
            </Link>
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* ESTADO 3.3: LOBBY DA SALA (AGUARDANDO INÍCIO)                           */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === "LOBBY" && (
          <div className="space-y-3 animate-in fade-in">
            {/* Card Superior: Código em Destaque & Contador */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  CÓDIGO DA SALA
                </div>
                <div
                  style={{ fontFamily: "var(--font-mono), Space Mono, monospace" }}
                  className="text-2xl font-black text-cyan-400 tracking-widest"
                >
                  {roomCode}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-slate-200 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                  <span>{copiedCode ? "COPIADO" : "LINK"}</span>
                </button>

                <div className="px-3 py-2 rounded-xl bg-cyan-950 border border-cyan-800 text-xs font-mono font-black text-cyan-300">
                  {players.length}/15
                </div>
              </div>
            </div>

            {/* Pílula de Regras Resumida */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center font-mono text-[11px] text-slate-300">
              {impostorCount} Impostor • {killCooldown}s Cooldown • {taskCount} Tasks • {discussionTime}s Disp.
            </div>

            {/* Grid de Participantes (2 Colunas com cards compactos) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
                <span>TRIPULANTES NO LOBBY ({players.length})</span>
                <button
                  type="button"
                  onClick={() => {
                    const bot: Player = {
                      id: `bot_${Date.now()}`,
                      room_id: roomId,
                      player_name: `Bot ${players.length + 1}`,
                      color_hex: "#10b981",
                      status: "ALIVE",
                      role: "CREWMATE",
                    };
                    setPlayers((prev) => [...prev, bot]);
                  }}
                  className="text-[10px] text-cyan-400 hover:underline font-mono cursor-pointer"
                >
                  + Adicionar Bot
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="p-2 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between shadow-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-4 h-4 rounded-full shrink-0 border border-slate-700 shadow-sm"
                        style={{ backgroundColor: p.color_hex || "#ef4444" }}
                      />
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {p.player_name}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleKickPlayer(p.id)}
                      className="w-5 h-5 rounded-full hover:bg-red-950 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Expulsar intruso"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {players.length === 0 && (
                  <div className="col-span-2 py-6 text-center text-xs text-slate-500 font-mono bg-slate-950/60 rounded-xl border border-dashed border-slate-800">
                    Aguardando convidados entrarem pelo celular...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* ESTADO 3.4: MASTER CONTROL (EM JOGO)                                    */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === "MASTER" && (
          <div className="space-y-3 animate-in fade-in">
            {/* Barra de Status */}
            <div className="p-3 bg-red-950/50 border border-red-500/60 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                <span
                  style={{ fontFamily: "var(--font-anton), Anton, sans-serif" }}
                  className="text-sm uppercase tracking-wider text-red-300"
                >
                  🔴 EM JOGO AO VIVO
                </span>
              </div>
              <span
                style={{ fontFamily: "var(--font-mono), Space Mono, monospace" }}
                className="text-sm font-black text-amber-300"
              >
                {formatTime(elapsedSeconds)}
              </span>
            </div>

            {/* Métricas em Tempo Real */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Progresso Geral das Tasks</span>
                <span className="font-bold text-emerald-400">{globalTaskProgress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${globalTaskProgress}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                <div className="p-2 bg-slate-900 rounded-xl text-center">
                  <span className="text-slate-400 block text-[10px]">VIVOS</span>
                  <span className="text-sm font-bold text-cyan-400">
                    {players.filter((p) => p.status === "ALIVE").length}/{players.length}
                  </span>
                </div>
                <div className="p-2 bg-slate-900 rounded-xl text-center">
                  <span className="text-slate-400 block text-[10px]">IMPOSTORES</span>
                  <span className="text-sm font-bold text-red-400">
                    {impostorCount} ativo{impostorCount > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Ações de Emergência */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleForceMeeting}
                className="w-full h-[50px] rounded-2xl btn-3d-red flex items-center justify-center gap-2 text-sm font-black uppercase cursor-pointer"
              >
                <AlertTriangle className="w-5 h-5" />
                <span>🚨 DISPARAR REUNIÃO FORÇADA</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerLightsSabotage}
                className="w-full h-[46px] rounded-2xl btn-3d-amber flex items-center justify-center gap-2 text-xs font-black uppercase cursor-pointer"
              >
                <Lightbulb className="w-4 h-4" />
                <span>⚡ ACIONAR SABOTAGEM DE LUZ</span>
              </button>
            </div>

            {/* Feed de Ações */}
            <div className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
              <div className="text-[10px] font-mono font-bold uppercase text-slate-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-cyan-400" />
                <span>FEED DE ACONTECIMENTOS</span>
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[10px] text-slate-300">
                {actionLogs.map((log, idx) => (
                  <div key={idx} className="truncate border-b border-slate-900 pb-0.5">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER CTA FIXO (INICIAR OU SALVAR) */}
      <footer className="z-10 pt-2 border-t border-slate-800">
        {activeTab !== "MASTER" ? (
          <button
            type="button"
            disabled={isStarting || players.length < 1}
            onClick={handleStartGame}
            className="w-full h-[54px] rounded-2xl btn-3d-green flex items-center justify-center gap-2 text-base font-black uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStarting ? (
              <>
                <CheckCircle2 className="w-5 h-5 animate-spin" />
                <span>SORTEANDO PAPÉIS...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-slate-950" />
                <span>🚀 INICIAR PARTIDA ({players.length})</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsGameRunning(false);
              setActiveTab("LOBBY");
              setActionLogs((prev) => ["Partida encerrada pelo host.", ...prev]);
            }}
            className="w-full h-[50px] rounded-2xl btn-3d-slate flex items-center justify-center gap-2 text-sm font-black uppercase cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>ENCERRAR PARTIDA & VOLTAR AO LOBBY</span>
          </button>
        )}
      </footer>
    </div>
  );
};
