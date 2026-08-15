"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Siren,
  Vote,
  CheckCircle,
  Skull,
  Clock,
  UserCheck,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Shield,
  Ghost,
  MessageSquare,
  Lock,
  Unlock,
  Users,
  Radio,
  FastForward,
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
  discussionTimeSeconds?: number;
  votingTimeSeconds?: number;
  confirmEjects?: boolean;
  isHost?: boolean;
  sendBroadcast?: (event: string, payload: any) => Promise<void>;
  onVotingEnded?: (result?: { ejectedPlayerId?: string | null; wasTieOrSkipped?: boolean }) => void;
}

// Fallback demo players apenas se nenhum jogador conectado for passado
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
  discussionTimeSeconds = 30,
  votingTimeSeconds = 35,
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
    return discussionTimeSeconds > 0 ? "DISCUSSION" : "VOTING";
  });

  const [discussionTimeLeft, setDiscussionTimeLeft] = useState<number>(discussionTimeSeconds);
  const [selectedTarget, setSelectedTarget] = useState<string | "SKIP" | null>(null);
  const [hasConfirmed, setHasConfirmed] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(votingTimeSeconds);
  const [resultTimeLeft, setResultTimeLeft] = useState<number>(6);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Mapa de votos registrados: { [voterId]: targetId | 'SKIP' }
  const [votesMap, setVotesMap] = useState<Record<string, string | "SKIP">>({});

  // Resultado final da votação
  const [votingOutcome, setVotingOutcome] = useState<{
    ejectedPlayer: VotingPlayer | null;
    isTie: boolean;
    isSkipped: boolean;
    outcomeText: string;
    subText?: string;
  } | null>(null);

  const supabase = createClient();
  const topicKey = (roomCode || roomId).trim().toLowerCase();
  const channelRef = useRef<any>(null);

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isEliminated = currentPlayer?.status === "ELIMINATED";
  const alivePlayers = players.filter((p) => p.status === "ALIVE");

  // 1. Sincronizar jogadores iniciais recebidos via props ou buscar no Supabase
  useEffect(() => {
    if (connectedPlayers && connectedPlayers.length > 0) {
      setPlayers(connectedPlayers);
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
  }, [connectedPlayers, roomId, supabase]);

  // 2. Canal Realtime dedicado à votação (não interfere no canal principal game_flow)
  useEffect(() => {
    const channel = supabase.channel(`room:${topicKey}:voting_live`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "SKIP_DISCUSSION" }, ({ payload }) => {
        setPhase("VOTING");
        setTimeLeft(payload?.votingTimeSeconds || votingTimeSeconds);
      })
      .on("broadcast", { event: "skip_discussion" }, ({ payload }) => {
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

  // 3. Ação do Host: Pular o timer de discussão e abrir a votação imediatamente para toda a sala
  const handleSkipDiscussion = async () => {
    setPhase("VOTING");
    setTimeLeft(votingTimeSeconds);

    const skipPayload = {
      triggeredBy: currentPlayerId,
      votingTimeSeconds,
      timestamp: Date.now(),
    };

    if (sendBroadcast) {
      await sendBroadcast("SKIP_DISCUSSION", skipPayload);
      await sendBroadcast("skip_discussion", skipPayload);
    }

    if (channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event: "SKIP_DISCUSSION",
        payload: skipPayload,
      });
    }
  };

  // 4. Cronômetro da Fase de Discussão & Deslocamento Presencial
  useEffect(() => {
    if (phase !== "DISCUSSION") return;

    if (discussionTimeLeft > 0) {
      const timer = setInterval(() => {
        setDiscussionTimeLeft((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    } else if (discussionTimeLeft === 0) {
      // Transiciona da Discussão para a Fase de Votação Ativa
      setPhase("VOTING");
      setTimeLeft(votingTimeSeconds);
    }
  }, [discussionTimeLeft, phase, votingTimeSeconds]);

  // 5. Função para computar e finalizar a contagem de votos (Regras Oficiais do Among Us)
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

    if (skipCount >= maxVotes && skipCount > 0) {
      isSkipped = true;
      outcomeText = "Ninguém foi ejetado.";
      subText = "A maioria dos tripulantes optou por pular a votação (Skip).";
    } else if (isTie || maxVotes === 0) {
      outcomeText = "Ninguém foi ejetado.";
      subText = maxVotes === 0
        ? "O tempo encerrou sem votos suficientes computados."
        : "Houve empate na contagem de votos.";
    } else if (topSuspectId) {
      ejectedPlayer = players.find((p) => p.id === topSuspectId) || null;
      if (ejectedPlayer) {
        outcomeText = `${ejectedPlayer.player_name} foi ejetado da nave.`;
        if (confirmEjects && ejectedPlayer.role) {
          subText = ejectedPlayer.role === "IMPOSTOR"
            ? `${ejectedPlayer.player_name} era um Impostor.`
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
      outcomeText,
      subText,
    };

    setVotingOutcome(outcome);
    setPhase("RESULTS");

    // Transmitir resultado para sincronizar todos os dispositivos
    if (sendBroadcast) {
      sendBroadcast("VOTING_FINISHED", { outcome }).catch(() => {});
      sendBroadcast("voting_finished", { outcome }).catch(() => {});
    }

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "VOTING_FINISHED",
        payload: { outcome },
      }).catch(() => {});
    }
  };

  // 6. Cronômetro da Fase de Votação
  useEffect(() => {
    if (phase !== "VOTING") return;

    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0) {
      // Tempo esgotado: computa automaticamente apenas os votos que foram dados até o momento
      computeAndFinalizeVotes(votesMap);
    }
  }, [timeLeft, phase, votesMap]);

  // 7. Verificar se todos os jogadores vivos já votaram para avançar sem esperar o timer
  useEffect(() => {
    if (phase !== "VOTING") return;

    const aliveCount = alivePlayers.length;
    const votedCount = Object.keys(votesMap).length;

    if (aliveCount > 0 && votedCount >= aliveCount) {
      computeAndFinalizeVotes(votesMap);
    }
  }, [votesMap, alivePlayers.length, phase]);

  // 8. Cronômetro da Fase de Resultados (Ejeção / Retorno à Nave)
  useEffect(() => {
    if (phase !== "RESULTS") return;

    if (resultTimeLeft > 0) {
      const timer = setInterval(() => {
        setResultTimeLeft((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    } else if (resultTimeLeft === 0) {
      if (onVotingEnded) {
        onVotingEnded({
          ejectedPlayerId: votingOutcome?.ejectedPlayer?.id || null,
          wasTieOrSkipped: !votingOutcome?.ejectedPlayer,
        });
      }
    }
  }, [resultTimeLeft, phase, votingOutcome, onVotingEnded]);

  // 9. Ação do Jogador: Confirmar Voto (em um jogador ou Skip)
  const handleConfirmVote = async (target: string | "SKIP") => {
    if (hasConfirmed || isEliminated || phase !== "VOTING") return;
    setIsSubmitting(true);

    try {
      setHasConfirmed(true);
      setSelectedTarget(target);

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
        await sendBroadcast("player_voted", votePayload);
      }

      // Enviar broadcast via Realtime
      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "PLAYER_VOTED",
          payload: votePayload,
        });
      }

      // Persistir no DB se for UUID válido
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);
      if (isValidUuid && currentPlayerId) {
        await supabase.from("game_events").insert([
          {
            room_id: roomId,
            event_type: "VOTE_CAST",
            player_id: currentPlayerId,
            target_id: target !== "SKIP" ? target : null,
            payload: { target, timestamp: Date.now() },
          },
        ]);
      }
    } catch (err) {
      console.error("[VotingSession] Erro ao registrar voto:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Contagem de votos para a tela de resultados
  const getVoteCountFor = (targetId: string | "SKIP") => {
    return Object.values(votesMap).filter((t) => t === targetId).length;
  };

  const skipVotesCount = getVoteCountFor("SKIP");

  // ==========================================
  // RENDERIZAÇÃO: FASE 1 - DISCUSSÃO & DESLOCAMENTO AO PONTO DE ENCONTRO
  // ==========================================
  if (phase === "DISCUSSION") {
    return (
      <div className="min-h-[85vh] bg-slate-950 text-white p-5 flex flex-col justify-between max-w-md mx-auto select-none font-sans border border-purple-800/60 shadow-2xl relative rounded-3xl overflow-hidden animate-fade-in">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <header className="text-center pt-2 pb-2 z-10 relative space-y-1.5">
          <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/60 text-red-400 font-black px-4 py-1.5 rounded-full text-xs uppercase tracking-widest animate-pulse shadow-lg">
            <Siren className="w-4 h-4 text-red-400 animate-bounce" />
            <span>Reunião de Emergência</span>
          </div>

          <p className="text-xs text-slate-300">
            Reportado por: <strong className="text-white font-black">{reporterName}</strong>
          </p>

          <div className="mt-2 text-xs font-mono py-2 px-4 rounded-2xl bg-purple-950/80 border border-purple-700/80 text-purple-300 inline-flex items-center gap-2 shadow-inner">
            <Clock className="w-4 h-4 text-purple-400 animate-spin" />
            <span className="font-bold text-sm">Tempo de Discussão: {discussionTimeLeft}s</span>
          </div>
        </header>

        {/* Card Central de Deslocamento e Instrução Presencial */}
        <main className="my-auto space-y-4 z-10 relative">
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl text-center space-y-3 shadow-2xl backdrop-blur-md">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 mx-auto flex items-center justify-center">
              <Users className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                Dirijam-se ao Ponto de Encontro!
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Todos os jogadores devem se reunir na <strong>mesa central / lobby presencial</strong> para debater álibis e suspeitas.
              </p>
            </div>

            <div className="bg-purple-950/40 border border-purple-800/40 rounded-2xl p-3 text-[11px] text-purple-200 flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-purple-400 shrink-0" />
              <span>A votação nos celulares será liberada assim que o tempo de discussão terminar.</span>
            </div>
          </div>

          {/* Lista de Participantes Conectados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Tripulantes na Mesa ({alivePlayers.length} Vivos):
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
              {players.map((p) => {
                const isSelf = p.id === currentPlayerId;
                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                      p.status === "ELIMINATED"
                        ? "bg-slate-900/30 border-slate-850/40 opacity-40 line-through text-slate-600"
                        : "bg-slate-900/80 border-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-black"
                        style={{ backgroundColor: p.color_hex }}
                      />
                      <span className="font-bold truncate">{p.player_name}</span>
                      {isSelf && <span className="text-[9px] text-cyan-400 font-bold">(Você)</span>}
                    </div>
                    {p.status === "ELIMINATED" && <Skull className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        <footer className="space-y-2 pt-2 z-10 relative">
          {/* Botão exclusivo do Host para pular a discussão e abrir a votação com o timer individual dela */}
          {isHost && (
            <button
              type="button"
              onClick={handleSkipDiscussion}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-purple-950/60 border border-purple-400/50 cursor-pointer active:scale-95 transition-all"
            >
              <FastForward className="w-4 h-4 text-purple-200" />
              <span>Pular Discussão e Iniciar Votação (Host)</span>
            </button>
          )}

          <div className="w-full py-3 bg-slate-900/90 border border-slate-800 text-slate-400 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-inner">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <span>Fase de Debate Presencial Ativa</span>
          </div>
        </footer>
      </div>
    );
  }

  // ==========================================
  // RENDERIZAÇÃO: FASE 3 - RESULTADOS (EJEÇÃO)
  // ==========================================
  if (phase === "RESULTS" && votingOutcome) {
    const isCurrentUserEjected = votingOutcome.ejectedPlayer?.id === currentPlayerId;

    return (
      <div className="min-h-[85vh] bg-slate-950 text-white p-5 flex flex-col justify-between max-w-md mx-auto select-none font-sans border border-slate-800 shadow-2xl relative rounded-3xl overflow-hidden animate-fade-in">
        {/* Glow Cosmos Backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950 pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <header className="text-center pt-2 pb-2 z-10 relative space-y-1">
          <div className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 text-cyan-400 font-extrabold px-3 py-1 rounded-full text-[11px] uppercase tracking-wider shadow-md">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Resultado da Reunião</span>
          </div>
          <h2 className="text-xl font-black text-slate-100 uppercase tracking-tight">
            Contagem de Votos
          </h2>
        </header>

        {/* Anúncio Central da Ejeção */}
        <main className="my-auto space-y-4 z-10 relative">
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl text-center space-y-3 shadow-2xl backdrop-blur-md">
            {votingOutcome.ejectedPlayer ? (
              <div className="space-y-3">
                <div
                  className="w-16 h-16 rounded-full mx-auto shadow-2xl border-2 border-white/30 flex items-center justify-center animate-pulse"
                  style={{ backgroundColor: votingOutcome.ejectedPlayer.color_hex || "#ef4444" }}
                >
                  <Ghost className="w-8 h-8 text-white/80" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase">
                    {votingOutcome.outcomeText}
                  </h3>
                  {votingOutcome.subText && (
                    <p className="text-xs font-semibold text-cyan-300 mt-1">
                      {votingOutcome.subText}
                    </p>
                  )}
                </div>
                {isCurrentUserEjected && (
                  <div className="bg-red-950/60 border border-red-500/40 text-red-300 text-xs py-2 px-3 rounded-xl font-bold">
                    💀 Você foi eliminado da partida e agora é um fantasma!
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 py-2">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
                  <Shield className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black text-slate-100 uppercase">
                  {votingOutcome.outcomeText}
                </h3>
                <p className="text-xs text-slate-400">
                  {votingOutcome.subText}
                </p>
              </div>
            )}
          </div>

          {/* Breakdown dos Votos Recebidos */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">
              Detalhamento dos Votos:
            </h4>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {players.map((p) => {
                const count = getVoteCountFor(p.id);
                return (
                  <div
                    key={p.id}
                    className="bg-slate-900/80 border border-slate-800 p-2 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-black"
                        style={{ backgroundColor: p.color_hex }}
                      />
                      <span className="font-bold text-slate-200 truncate">{p.player_name}</span>
                    </div>
                    <span
                      className={`font-mono text-[11px] font-extrabold px-1.5 py-0.5 rounded-md ${
                        count > 0
                          ? "bg-red-950 text-red-400 border border-red-800/60"
                          : "text-slate-500"
                      }`}
                    >
                      {count} {count === 1 ? "voto" : "votos"}
                    </span>
                  </div>
                );
              })}

              <div className="col-span-2 bg-slate-900/60 border border-slate-800 p-2 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300">Pular Voto (Skip):</span>
                <span className="font-mono text-[11px] font-extrabold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-800/60">
                  {skipVotesCount} {skipVotesCount === 1 ? "voto" : "votos"}
                </span>
              </div>
            </div>
          </div>
        </main>

        {/* Footer com Contagem Regressiva de Retorno */}
        <footer className="pt-2 z-10 relative">
          <div className="w-full py-3 bg-slate-900 border border-slate-800 text-slate-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg">
            <Clock className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>Retornando à nave em {resultTimeLeft}s...</span>
          </div>
        </footer>
      </div>
    );
  }

  // ==========================================
  // RENDERIZAÇÃO: FASE 2 - VOTAÇÃO ATIVA (LIBERADA)
  // ==========================================
  return (
    <div className="min-h-[85vh] bg-slate-950 text-white p-4 flex flex-col justify-between max-w-md mx-auto select-none font-sans border border-slate-800 shadow-2xl relative rounded-3xl overflow-hidden animate-fade-in">
      {/* Top Banner de Emergência */}
      <header className="text-center pt-2 pb-2 z-10 relative">
        <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/60 text-red-400 font-black px-4 py-1.5 rounded-full text-xs uppercase tracking-widest mb-1.5 animate-pulse shadow-lg">
          <Siren className="w-4 h-4 text-red-400" />
          <span>Votação da Reunião</span>
        </div>
        <p className="text-xs text-slate-300">
          Reportado por: <strong className="text-white font-black">{reporterName}</strong>
        </p>
        <div
          className={`mt-2 text-xs font-mono py-1.5 px-3 rounded-xl inline-flex items-center gap-1.5 shadow-inner transition-colors ${
            timeLeft <= 10
              ? "bg-red-950 border border-red-600 text-red-300 animate-pulse font-black"
              : "bg-slate-900 border border-slate-800 text-cyan-400"
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>Tempo para Votar: {timeLeft}s</span>
        </div>
      </header>

      {/* Grid de Votação (Lista Real de Jogadores Conectados) */}
      <main className="my-auto space-y-2.5 z-10 relative">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            {isEliminated ? "Você está morto (Sem direito a voto)" : "Selecione o suspeito:"}
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">
            Votos: {Object.keys(votesMap).length}/{alivePlayers.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
          {players.map((player) => {
            const isSelected = selectedTarget === player.id;
            const isSelf = player.id === currentPlayerId;
            const cantVote = player.status === "ELIMINATED" || isEliminated || hasConfirmed;
            const playerHasVoted = Boolean(votesMap[player.id] || player.has_voted);

            return (
              <button
                key={player.id}
                type="button"
                disabled={cantVote}
                onClick={() => setSelectedTarget(player.id)}
                className={`p-3 rounded-2xl border flex items-center justify-between text-left transition-all relative ${
                  player.status === "ELIMINATED"
                    ? "bg-slate-900/30 border-slate-850/40 opacity-40 line-through text-slate-600 cursor-not-allowed"
                    : isSelected
                    ? "bg-red-950/60 border-red-500 text-white ring-2 ring-red-500/50 shadow-lg scale-[1.02]"
                    : "bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700 active:scale-95"
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div
                    className="w-5 h-5 rounded-full shrink-0 border border-white/20 shadow-sm"
                    style={{ backgroundColor: player.color_hex || "#3b82f6" }}
                  />
                  <div className="truncate">
                    <span className="text-xs font-bold truncate block">
                      {player.player_name}
                    </span>
                    {isSelf && (
                      <span className="text-[9px] text-cyan-400 font-semibold block leading-tight">
                        (Você)
                      </span>
                    )}
                  </div>
                </div>

                {player.status === "ELIMINATED" ? (
                  <Skull className="w-4 h-4 text-slate-500 shrink-0" />
                ) : playerHasVoted ? (
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : null}
              </button>
            );
          })}
        </div>
      </main>

      {/* Botões de Ação na Zona dos Polegares */}
      <footer className="space-y-2.5 pt-3 border-t border-slate-900 z-10 relative">
        {!isEliminated && !hasConfirmed && (
          <>
            <button
              type="button"
              onClick={() => setSelectedTarget("SKIP")}
              className={`w-full py-3 rounded-2xl border text-xs font-bold uppercase tracking-wider transition ${
                selectedTarget === "SKIP"
                  ? "bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-500/40"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Pular Voto (Skip Vote)
            </button>

            {selectedTarget && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleConfirmVote(selectedTarget)}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl uppercase text-xs transition shadow-xl tracking-wider flex items-center justify-center gap-2 active:scale-95 border border-red-500/50 cursor-pointer"
              >
                <Vote className="w-4 h-4" />
                <span>Confirmar Voto</span>
              </button>
            )}
          </>
        )}

        {hasConfirmed && (
          <div className="bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs py-3.5 px-4 rounded-2xl text-center font-bold flex items-center justify-center gap-2 shadow-inner">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Voto computado com sucesso! Aguardando a mesa...</span>
          </div>
        )}

        {isEliminated && (
          <div className="bg-slate-900/60 border border-slate-800 text-slate-400 text-xs py-3 px-4 rounded-2xl text-center italic">
            👻 Espectador: Acompanhe a discussão presencial em silêncio.
          </div>
        )}
      </footer>
    </div>
  );
};
