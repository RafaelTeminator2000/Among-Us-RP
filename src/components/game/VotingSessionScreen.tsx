"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Siren,
  Vote,
  CheckCircle,
  Skull,
  Clock,
  UserCheck,
  AlertTriangle,
  Sparkles,
  Shield,
  Ghost,
  MessageSquare,
  Lock,
  Users,
  FastForward,
  Trophy,
  Megaphone,
  Check,
  X,
} from "lucide-react";

export interface VotingPlayer {
  id: string;
  player_name: string;
  color_hex: string;
  status: "ALIVE" | "ELIMINATED";
  role?: string | null;
  has_voted?: boolean;
}

interface VotingSessionProps {
  roomId: string;
  roomCode?: string;
  currentPlayerId: string;
  currentPlayerName?: string;
  reporterName: string;
  connectedPlayers?: VotingPlayer[];
  rolesMap?: Record<string, "CREWMATE" | "IMPOSTOR">;
  discussionTimeSeconds?: number;
  votingTimeSeconds?: number;
  confirmEjects?: boolean;
  isHost?: boolean;
  sendBroadcast?: (event: string, payload: any) => Promise<void>;
  onVotingEnded?: (result?: {
    ejectedPlayerId?: string | null;
    ejectedPlayerName?: string | null;
    isImpostor?: boolean;
    ejectedRole?: string | null;
    wasTieOrSkipped?: boolean;
  }) => void;
}

const DEMO_FALLBACK_PLAYERS: VotingPlayer[] = [
  { id: "p1", player_name: "Vermelho", color_hex: "#ef4444", status: "ALIVE", has_voted: false },
  { id: "p2", player_name: "Azul", color_hex: "#3b82f6", status: "ALIVE", has_voted: false },
  { id: "p3", player_name: "Amarelo", color_hex: "#eab308", status: "ALIVE", has_voted: false },
];

export const VotingSessionScreen: React.FC<VotingSessionProps> = ({
  roomId,
  roomCode,
  currentPlayerId,
  currentPlayerName,
  reporterName,
  connectedPlayers,
  rolesMap,
  discussionTimeSeconds = 15,
  votingTimeSeconds = 30,
  confirmEjects = true,
  isHost = false,
  sendBroadcast,
  onVotingEnded,
}) => {
  const [players, setPlayers] = useState<VotingPlayer[]>(() => {
    if (connectedPlayers && connectedPlayers.length > 0) {
      return connectedPlayers;
    }
    return DEMO_FALLBACK_PLAYERS;
  });

  const [phase, setPhase] = useState<"DISCUSSION" | "VOTING" | "RESULTS">(() => {
    if (typeof window !== "undefined") {
      const startStr =
        localStorage.getItem(`emergency_meeting_start_${roomId}`) ||
        (roomCode ? localStorage.getItem(`emergency_meeting_start_${roomCode.toUpperCase()}`) : null);
      if (startStr) {
        const elapsed = Math.max(0, Math.floor((Date.now() - Number(startStr)) / 1000));
        if (elapsed < discussionTimeSeconds) {
          return "DISCUSSION";
        } else if (elapsed < discussionTimeSeconds + votingTimeSeconds) {
          return "VOTING";
        }
      }
    }
    return discussionTimeSeconds > 0 ? "DISCUSSION" : "VOTING";
  });

  const [discussionTimeLeft, setDiscussionTimeLeft] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const startStr =
        localStorage.getItem(`emergency_meeting_start_${roomId}`) ||
        (roomCode ? localStorage.getItem(`emergency_meeting_start_${roomCode.toUpperCase()}`) : null);
      if (startStr) {
        const elapsed = Math.max(0, Math.floor((Date.now() - Number(startStr)) / 1000));
        if (elapsed < discussionTimeSeconds) {
          return Math.max(1, discussionTimeSeconds - elapsed);
        }
        return 0;
      }
    }
    return discussionTimeSeconds;
  });

  const [selectedTarget, setSelectedTarget] = useState<string | "SKIP" | null>(() => {
    if (typeof window !== "undefined") {
      const saved =
        localStorage.getItem(`user_voted_target_${roomId}_${currentPlayerId}`) ||
        (roomCode ? localStorage.getItem(`user_voted_target_${roomCode.toUpperCase()}_${currentPlayerId}`) : null);
      if (saved) return saved as string | "SKIP";
    }
    return null;
  });

  const [hasConfirmed, setHasConfirmed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved =
        localStorage.getItem(`user_voted_target_${roomId}_${currentPlayerId}`) ||
        (roomCode ? localStorage.getItem(`user_voted_target_${roomCode.toUpperCase()}_${currentPlayerId}`) : null);
      if (saved) return true;
    }
    return false;
  });

  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const startStr =
        localStorage.getItem(`emergency_meeting_start_${roomId}`) ||
        (roomCode ? localStorage.getItem(`emergency_meeting_start_${roomCode.toUpperCase()}`) : null);
      if (startStr) {
        const elapsed = Math.max(0, Math.floor((Date.now() - Number(startStr)) / 1000));
        if (elapsed >= discussionTimeSeconds && elapsed < discussionTimeSeconds + votingTimeSeconds) {
          return Math.max(1, discussionTimeSeconds + votingTimeSeconds - elapsed);
        }
      }
    }
    return votingTimeSeconds;
  });
  const [resultTimeLeft, setResultTimeLeft] = useState<number>(6);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Mapa de votos: { [voterId]: targetId | 'SKIP' }
  const [votesMap, setVotesMap] = useState<Record<string, string | "SKIP">>({});

  // Resultado final da votação
  const [votingOutcome, setVotingOutcome] = useState<{
    ejectedPlayer: VotingPlayer | null;
    isTie: boolean;
    isSkipped: boolean;
    isImpostor?: boolean;
    ejectedRole?: string | null;
    outcomeText: string;
    subText?: string;
  } | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const topicKey = (roomCode || roomId).trim().toLowerCase();
  const channelRef = useRef<any>(null);
  const hasCalledEndedRef = useRef(false);

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isEliminated = currentPlayer?.status === "ELIMINATED";
  const alivePlayers = players.filter((p) => p.status === "ALIVE");

  // Sincronizar jogadores
  useEffect(() => {
    if (connectedPlayers && connectedPlayers.length > 0) {
      setPlayers((prev) => {
        const isSame =
          prev.length === connectedPlayers.length &&
          prev.every((p, idx) => {
            const cp = connectedPlayers[idx];
            return (
              cp &&
              p.id === cp.id &&
              p.player_name === cp.player_name &&
              p.status === cp.status &&
              p.role === (cp.role || rolesMap?.[cp.id] || p.role)
            );
          });

        if (isSame) return prev;

        return connectedPlayers.map((cp) => {
          const existing = prev.find((p) => p.id === cp.id);
          return {
            id: cp.id,
            player_name: cp.player_name,
            color_hex: cp.color_hex,
            status: cp.status,
            role: cp.role || rolesMap?.[cp.id] || existing?.role,
            has_voted: existing?.has_voted ?? false,
          };
        });
      });
      return;
    }

    const fetchRoomPlayers = async () => {
      try {
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);
        if (isValidUuid) {
          const { data } = await supabase
            .from("room_players")
            .select("id, player_name, color_hex, status, role")
            .eq("room_id", roomId);

          if (data && data.length > 0) {
            setPlayers(
              data.map((p) => ({
                id: p.id,
                player_name: p.player_name,
                color_hex: p.color_hex,
                status: p.status as any,
                role: p.role,
                has_voted: false,
              }))
            );
          }
        }
      } catch (err) {
        console.warn("[VotingSession] Erro ao sincronizar participantes:", err);
      }
    };

    fetchRoomPlayers();
  }, [connectedPlayers, roomId, rolesMap, supabase]);

  // Canal Realtime dedicado
  useEffect(() => {
    const channel = supabase.channel(`room:${topicKey}:voting_live`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "SKIP_DISCUSSION" }, ({ payload }) => {
        setPhase("VOTING");
        setTimeLeft(payload?.votingTimeSeconds || votingTimeSeconds);
      })
      .on("broadcast", { event: "PLAYER_VOTED" }, ({ payload }) => {
        if (payload?.voterId) {
          setVotesMap((prev) => ({
            ...prev,
            [payload.voterId]: payload.targetId || "SKIP",
          }));

          setPlayers((prev) =>
            prev.map((p) =>
              p.id === payload.voterId ? { ...p, has_voted: true } : p
            )
          );
        }
      })
      .on("broadcast", { event: "VOTING_FINISHED" }, ({ payload }) => {
        if (payload?.outcome) {
          setVotingOutcome(payload.outcome);
          setPhase("RESULTS");
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [topicKey, supabase, votingTimeSeconds]);

  const handleSkipDiscussion = async () => {
    setPhase("VOTING");
    setTimeLeft(votingTimeSeconds);

    if (typeof window !== "undefined") {
      const adjustedStart = Date.now() - (discussionTimeSeconds * 1000);
      localStorage.setItem(`emergency_meeting_start_${roomId}`, String(adjustedStart));
      if (roomCode) {
        localStorage.setItem(`emergency_meeting_start_${roomCode.toUpperCase()}`, String(adjustedStart));
      }
    }

    const skipPayload = {
      triggeredBy: currentPlayerId,
      votingTimeSeconds,
      timestamp: Date.now(),
    };

    if (sendBroadcast) {
      await sendBroadcast("SKIP_DISCUSSION", skipPayload);
    }

    if (channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event: "SKIP_DISCUSSION",
        payload: skipPayload,
      });
    }
  };

  // Timer de Discussão
  useEffect(() => {
    if (phase !== "DISCUSSION") return;

    if (discussionTimeLeft > 0) {
      const timer = setInterval(() => {
        setDiscussionTimeLeft((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    } else if (discussionTimeLeft === 0) {
      setPhase("VOTING");
      setTimeLeft(votingTimeSeconds);
    }
  }, [discussionTimeLeft, phase, votingTimeSeconds]);

  // Computar votos
  const computeAndFinalizeVotes = (finalVotes: Record<string, string | "SKIP">) => {
    const voteCounts: Record<string, number> = {};
    let skipCount = 0;

    Object.entries(finalVotes).forEach(([, target]) => {
      if (target === "SKIP") {
        skipCount += 1;
      } else if (target) {
        voteCounts[target] = (voteCounts[target] || 0) + 1;
      }
    });

    let maxVotes = 0;
    let topSuspectId: string | null = null;
    let isTie = false;

    Object.entries(voteCounts).forEach(([suspectId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        topSuspectId = suspectId;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true;
      }
    });

    let ejectedPlayer: VotingPlayer | null = null;
    let isSkipped = false;
    let outcomeText = "";
    let subText = "";
    let isImpostor = false;
    let ejectedRole: string | null = null;

    if (skipCount >= maxVotes && skipCount > 0) {
      isSkipped = true;
      outcomeText = "Ninguém foi ejetado.";
      subText = "(Votação pulada pela maioria)";
    } else if (isTie || maxVotes === 0) {
      outcomeText = "Ninguém foi ejetado.";
      subText = maxVotes === 0 ? "(Tempo esgotado sem votos)" : "(Empate na votação)";
    } else if (topSuspectId) {
      ejectedPlayer = players.find((p) => p.id === topSuspectId) || null;
      if (ejectedPlayer) {
        let storedRoles: Record<string, string> = {};
        try {
          if (typeof window !== "undefined") {
            const raw = localStorage.getItem(`room_roles_${roomId}`) || localStorage.getItem(`room_roles_${topicKey}`);
            if (raw) storedRoles = JSON.parse(raw);
          }
        } catch {}

        ejectedRole =
          ejectedPlayer.role ||
          rolesMap?.[ejectedPlayer.id] ||
          storedRoles[ejectedPlayer.id] ||
          (ejectedPlayer.player_name?.toLowerCase().includes("impostor") ? "IMPOSTOR" : "CREWMATE");

        isImpostor = ejectedRole === "IMPOSTOR";
        outcomeText = `${ejectedPlayer.player_name} foi ejetado.`;

        if (confirmEjects) {
          subText = isImpostor
            ? `${ejectedPlayer.player_name} ERA um Impostor.`
            : `${ejectedPlayer.player_name} NÃO era um Impostor.`;
        }
      } else {
        outcomeText = "Ninguém foi ejetado.";
        subText = "Suspeito não localizado.";
      }
    }

    const outcome = {
      ejectedPlayer,
      isTie: isTie && maxVotes > 0,
      isSkipped,
      isImpostor,
      ejectedRole,
      outcomeText,
      subText,
    };

    hasCalledEndedRef.current = false;
    setVotingOutcome(outcome);
    setPhase("RESULTS");

    if (sendBroadcast) {
      sendBroadcast("VOTING_FINISHED", { outcome }).catch(() => {});
    }

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "VOTING_FINISHED",
        payload: { outcome },
      }).catch(() => {});
    }
  };

  // Timer de Votação
  useEffect(() => {
    if (phase !== "VOTING") return;

    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0) {
      computeAndFinalizeVotes(votesMap);
    }
  }, [timeLeft, phase, votesMap]);

  // Se todos vivos votaram
  useEffect(() => {
    if (phase !== "VOTING") return;
    const aliveCount = alivePlayers.length;
    const votedCount = Object.keys(votesMap).length;

    if (aliveCount > 0 && votedCount >= aliveCount) {
      computeAndFinalizeVotes(votesMap);
    }
  }, [votesMap, alivePlayers.length, phase]);

  // Timer de Resultados
  useEffect(() => {
    if (phase !== "RESULTS") return;

    if (resultTimeLeft > 0) {
      const timer = setInterval(() => {
        setResultTimeLeft((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    } else if (resultTimeLeft === 0 && !hasCalledEndedRef.current) {
      hasCalledEndedRef.current = true;
      if (typeof window !== "undefined") {
        localStorage.removeItem(`emergency_meeting_start_${roomId}`);
        localStorage.removeItem(`user_voted_target_${roomId}_${currentPlayerId}`);
        if (roomCode) {
          localStorage.removeItem(`emergency_meeting_start_${roomCode.toUpperCase()}`);
          localStorage.removeItem(`user_voted_target_${roomCode.toUpperCase()}_${currentPlayerId}`);
        }
      }
      if (onVotingEnded) {
        onVotingEnded({
          ejectedPlayerId: votingOutcome?.ejectedPlayer?.id || null,
          ejectedPlayerName: votingOutcome?.ejectedPlayer?.player_name || null,
          isImpostor: Boolean(votingOutcome?.isImpostor),
          ejectedRole: votingOutcome?.ejectedRole || null,
          wasTieOrSkipped: !votingOutcome?.ejectedPlayer,
        });
      }
    }
  }, [resultTimeLeft, phase, votingOutcome, onVotingEnded, roomId, roomCode, currentPlayerId]);

  // Confirmar Voto
  const handleConfirmVote = async (target: string | "SKIP") => {
    if (hasConfirmed || isEliminated || phase !== "VOTING") return;
    setIsSubmitting(true);

    try {
      setHasConfirmed(true);
      setSelectedTarget(target);
      if (typeof window !== "undefined") {
        localStorage.setItem(`user_voted_target_${roomId}_${currentPlayerId}`, target);
        if (roomCode) {
          localStorage.setItem(`user_voted_target_${roomCode.toUpperCase()}_${currentPlayerId}`, target);
        }
      }

      const updatedVotes = {
        ...votesMap,
        [currentPlayerId]: target,
      };
      setVotesMap(updatedVotes);

      setPlayers((prev) =>
        prev.map((p) => (p.id === currentPlayerId ? { ...p, has_voted: true } : p))
      );

      const votePayload = {
        voterId: currentPlayerId,
        voterName: currentPlayerName || "Tripulante",
        targetId: target,
      };

      if (sendBroadcast) {
        await sendBroadcast("PLAYER_VOTED", votePayload);
      }

      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "PLAYER_VOTED",
          payload: votePayload,
        });
      }
    } catch (err) {
      console.error("[VotingSession] Erro ao registrar voto:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVoteCountFor = (targetId: string | "SKIP") => {
    return Object.values(votesMap).filter((t) => t === targetId).length;
  };

  // =========================================================================
  // FASE 3: RESULTADOS & ANIMAÇÃO DE EJEÇÃO
  // =========================================================================
  if (phase === "RESULTS" && votingOutcome) {
    const isCurrentUserEjected = votingOutcome.ejectedPlayer?.id === currentPlayerId;

    return (
      <div className="min-h-[90vh] bg-deep-space-stars text-white p-5 flex flex-col justify-between max-w-sm mx-auto select-none font-sans console-card border-4 border-slate-700 shadow-2xl relative rounded-3xl overflow-hidden animate-in fade-in">
        <header className="text-center pt-2 pb-2 z-10 relative space-y-1 border-b border-slate-800">
          <div className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-700 text-cyan-400 font-bold px-3 py-1 rounded-full text-[11px] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>RESULTADO DA REUNIÃO</span>
          </div>
          <h2
            style={{ fontFamily: "var(--font-anton), Anton, sans-serif" }}
            className="text-2xl font-black text-white uppercase tracking-wider"
          >
            CONTAGEM DE VOTOS
          </h2>
        </header>

        <main className="my-auto space-y-4 z-10 relative text-center">
          <div className="bg-[#020617] border-2 border-slate-800 p-6 rounded-3xl space-y-4 shadow-inner">
            {votingOutcome.ejectedPlayer ? (
              <div className="space-y-3">
                <div
                  className="w-20 h-20 rounded-full mx-auto shadow-2xl border-4 border-slate-900 flex items-center justify-center relative animate-floating"
                  style={{
                    backgroundColor: votingOutcome.ejectedPlayer.color_hex || "#ef4444",
                  }}
                >
                  <div className="w-10 h-6 bg-cyan-200 rounded-full border-2 border-slate-950 absolute top-4 right-2 shadow-inner" />
                  <Ghost className="w-8 h-8 text-slate-950/40" />
                </div>

                <div>
                  <h3
                    style={{ fontFamily: "var(--font-anton), Anton, sans-serif" }}
                    className="text-2xl font-black text-white uppercase tracking-wider"
                  >
                    {votingOutcome.outcomeText}
                  </h3>
                  {votingOutcome.subText && (
                    <p
                      style={{ fontFamily: "var(--font-mono), Space Mono, monospace" }}
                      className="text-xs font-bold mt-2 text-cyan-300 tracking-wider"
                    >
                      {votingOutcome.subText}
                    </p>
                  )}
                </div>

                {isCurrentUserEjected && (
                  <div className="bg-red-950/80 border border-red-500/60 text-red-300 text-xs py-2 px-3 rounded-xl font-bold font-mono">
                    💀 Você foi ejetado! Continue no jogo como fantasma.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 py-2">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-500 text-amber-400 mx-auto flex items-center justify-center">
                  <Shield className="w-8 h-8" />
                </div>
                <h3
                  style={{ fontFamily: "var(--font-anton), Anton, sans-serif" }}
                  className="text-xl font-black text-white uppercase tracking-wider"
                >
                  {votingOutcome.outcomeText}
                </h3>
                <p
                  style={{ fontFamily: "var(--font-mono), Space Mono, monospace" }}
                  className="text-xs text-slate-400 font-bold"
                >
                  {votingOutcome.subText}
                </p>
              </div>
            )}
          </div>

          {/* Votos Recebidos */}
          <div className="space-y-1.5 text-left">
            <h4 className="text-[10px] font-mono font-bold uppercase text-slate-400 px-1">
              Votos Registrados:
            </h4>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
              {players.map((p) => {
                const count = getVoteCountFor(p.id);
                return (
                  <div
                    key={p.id}
                    className="bg-slate-950 border border-slate-800 p-2 rounded-xl flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-slate-700"
                        style={{ backgroundColor: p.color_hex }}
                      />
                      <span className="text-slate-200 truncate">{p.player_name}</span>
                    </div>
                    <span className="font-bold text-cyan-400">{count}</span>
                  </div>
                );
              })}

              <div className="col-span-2 bg-slate-950 border border-slate-800 p-2 rounded-xl flex items-center justify-between text-xs font-mono">
                <span className="text-amber-400">Pular Voto (Skip):</span>
                <span className="font-bold text-amber-400">{getVoteCountFor("SKIP")}</span>
              </div>
            </div>
          </div>
        </main>

        <footer className="pt-2 z-10 relative">
          <div className="w-full py-3 bg-[#020617] border border-slate-800 text-slate-300 rounded-2xl text-xs font-mono font-bold flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>Retornando à partida em {resultTimeLeft}s...</span>
          </div>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // FASE 1: DISCUSSÃO & DESLOCAMENTO PRESENCIAL
  // =========================================================================
  if (phase === "DISCUSSION") {
    return (
      <div className="min-h-[90vh] bg-deep-space-stars text-white p-4 flex flex-col justify-between max-w-sm mx-auto select-none font-sans console-card border-4 border-slate-700 shadow-2xl relative rounded-3xl overflow-hidden animate-in fade-in">
        {/* Banner de Topo com Sirene */}
        <header className="text-center pt-2 pb-2 z-10 relative space-y-2 border-b border-slate-800">
          <div className="w-full bg-red-600 border-b-4 border-red-800 text-white py-2 rounded-2xl flex items-center justify-center gap-2 shadow-lg animate-pulse">
            <Siren className="w-5 h-5 text-white animate-bounce" />
            <span
              style={{ fontFamily: "var(--font-anton), Anton, sans-serif" }}
              className="text-base uppercase tracking-wider font-black"
            >
              🚨 REUNIÃO DE EMERGÊNCIA
            </span>
          </div>

          <p className="text-xs text-slate-300">
            Reportado por: <strong className="text-white font-bold">{reporterName}</strong>
          </p>

          <div
            style={{ fontFamily: "var(--font-mono), Space Mono, monospace" }}
            className="text-sm font-bold text-yellow-400 bg-[#020617] py-2 px-4 rounded-xl border border-slate-800 inline-flex items-center gap-2 shadow-inner"
          >
            <Clock className="w-4 h-4 text-yellow-400" />
            <span>A votação começa em: {discussionTimeLeft}s</span>
          </div>
        </header>

        {/* Centro: Instruções de Mesa */}
        <main className="my-auto space-y-3 z-10 relative">
          <div className="bg-[#020617] border-2 border-slate-800 p-4 rounded-2xl text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-400 mx-auto flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>

            <h3
              style={{ fontFamily: "var(--font-anton), Anton, sans-serif" }}
              className="text-base uppercase tracking-wider text-white"
            >
              DIRIJAM-SE AO PONTO DE ENCONTRO
            </h3>
            <p className="text-xs text-slate-400">
              Debatam cara a cara quem são os suspeitos. A votação será liberada automaticamente.
            </p>
          </div>

          {/* Lista de Participantes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400 px-1">
              <span>TRIPULANTES ({alivePlayers.length} Vivos):</span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {players.map((p) => {
                const isReporter = p.player_name === reporterName;
                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                      p.status === "ELIMINATED"
                        ? "bg-slate-950/40 border-slate-900 opacity-40 line-through text-slate-600"
                        : "bg-[#020617] border-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className="w-4 h-4 rounded-full shrink-0 border border-slate-700"
                        style={{ backgroundColor: p.color_hex }}
                      />
                      <span className="font-semibold truncate">{p.player_name}</span>
                    </div>

                    {isReporter && <Megaphone className="w-4 h-4 text-red-400 shrink-0" />}
                    {p.status === "ELIMINATED" && <Skull className="w-4 h-4 text-slate-500 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        <footer className="space-y-2 pt-2 z-10 relative">
          {isHost && (
            <button
              type="button"
              onClick={handleSkipDiscussion}
              className="w-full h-[48px] rounded-2xl btn-3d-cyan text-xs font-black uppercase flex items-center justify-center gap-2 cursor-pointer"
            >
              <FastForward className="w-4 h-4" />
              <span>PULAR DISCUSSÃO E ABRIR VOTO (HOST)</span>
            </button>
          )}

          <div className="w-full py-2.5 bg-[#020617] border border-slate-800 text-slate-400 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <span>Fase de Debate Presencial</span>
          </div>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // FASE 2: VOTAÇÃO ATIVA (TABLET UI - FIG 10.37.22 (2))
  // =========================================================================
  return (
    <div className="min-h-[90vh] bg-deep-space-stars text-white p-4 flex flex-col justify-between max-w-sm mx-auto select-none font-sans console-card border-4 border-[#334155] shadow-2xl relative rounded-3xl overflow-hidden animate-in fade-in">
      {/* Moldura / Header do Tablet */}
      <header className="text-center pt-1 pb-2 z-10 relative space-y-1.5 border-b border-slate-800">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>TABLET DE VOTAÇÃO</span>
          </div>
          <span
            style={{ fontFamily: "var(--font-mono), Space Mono, monospace" }}
            className="text-xs font-bold text-yellow-400"
          >
            ⏳ Encerra em: {timeLeft}s
          </span>
        </div>

        <h2
          style={{ fontFamily: "var(--font-anton), Anton, sans-serif" }}
          className="text-2xl uppercase tracking-wider text-white"
        >
          QUEM É O IMPOSTOR?
        </h2>
      </header>

      {/* Grid Central de Votação (2 Colunas com cards estilo Among Us) */}
      <main className="my-auto space-y-2 z-10 relative">
        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {players.map((player) => {
            const isSelected = selectedTarget === player.id;
            const isDead = player.status === "ELIMINATED";
            const cantVote = isDead || isEliminated || hasConfirmed;
            const playerHasVoted = Boolean(votesMap[player.id] || player.has_voted);
            const isReporter = player.player_name === reporterName;

            return (
              <div
                key={player.id}
                className={`p-2.5 rounded-2xl border-2 transition-all relative ${
                  isDead
                    ? "bg-slate-950/40 border-slate-900 opacity-40 cursor-not-allowed"
                    : isSelected
                    ? "bg-red-950/60 border-red-500 shadow-lg scale-[1.02]"
                    : "bg-[#0f172a] border-[#334155] hover:border-cyan-400"
                }`}
              >
                <div
                  onClick={() => !cantVote && setSelectedTarget(player.id)}
                  className={`flex items-center justify-between cursor-pointer ${
                    cantVote ? "cursor-default" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Avatar Circular com Visor */}
                    <div
                      className="w-7 h-7 rounded-full shrink-0 border-2 border-slate-950 relative shadow-sm"
                      style={{ backgroundColor: player.color_hex || "#3b82f6" }}
                    >
                      <div className="w-3.5 h-2 bg-cyan-200 rounded-full border border-slate-950 absolute top-1.5 right-0.5 shadow-inner" />
                      {isDead && (
                        <div className="absolute inset-0 flex items-center justify-center text-red-500 font-black text-sm">
                          ❌
                        </div>
                      )}
                    </div>

                    <span
                      style={{ fontFamily: "var(--font-arimo), Arimo, sans-serif" }}
                      className={`text-xs font-bold truncate ${
                        isDead ? "line-through text-slate-600" : "text-slate-100"
                      }`}
                    >
                      {player.player_name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isReporter && <Megaphone className="w-4 h-4 text-red-400 shrink-0" />}
                    {playerHasVoted && !isDead && (
                      <span className="text-emerald-400 font-bold text-xs" title="Já votou">
                        👍
                      </span>
                    )}
                  </div>
                </div>

                {/* Expansão de Seleção (Confirmar / Cancelar) */}
                {isSelected && !hasConfirmed && !isEliminated && (
                  <div className="mt-2 pt-2 border-t border-slate-800 grid grid-cols-2 gap-1 animate-in fade-in">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleConfirmVote(player.id)}
                      className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px] font-black uppercase flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>VOTAR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTarget(null)}
                      className="h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] font-bold uppercase flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>SAIR</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Rodapé / Thumb Zone */}
      <footer className="space-y-2 pt-2 border-t border-slate-800 z-10 relative">
        {!isEliminated && !hasConfirmed && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleConfirmVote("SKIP")}
              className="w-full h-[52px] rounded-2xl btn-3d-slate flex items-center justify-center gap-2 text-sm font-black uppercase cursor-pointer"
            >
              <span>🚫 PULAR VOTO (SKIP VOTE)</span>
            </button>
          </div>
        )}

        {hasConfirmed && (
          <div className="w-full py-3 bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 rounded-2xl text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-inner">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>VOTO CONFIRMADO! AGUARDANDO OS DEMAIS...</span>
          </div>
        )}

        {isEliminated && (
          <div className="w-full py-3 bg-[#020617] border border-slate-800 text-slate-500 rounded-2xl text-xs font-mono font-bold text-center">
            👻 Espectador Fantasma: Acompanhe em silêncio.
          </div>
        )}
      </footer>
    </div>
  );
};
