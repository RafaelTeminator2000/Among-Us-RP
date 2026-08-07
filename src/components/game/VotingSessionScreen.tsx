"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Siren, Vote, CheckCircle, Skull, Clock, UserCheck, AlertTriangle } from "lucide-react";

interface PlayerVoteState {
  id: string;
  player_name: string;
  color_hex: string;
  status: "ALIVE" | "ELIMINATED";
  has_voted?: boolean;
}

interface VotingSessionProps {
  roomId: string;
  currentPlayerId: string;
  reporterName: string;
  votingTimeSeconds?: number;
  onVotingEnded?: () => void;
}

// Fallback demo players para ambiente local/desenvolvimento
const DEMO_VOTING_PLAYERS: PlayerVoteState[] = [
  { id: "p1", player_name: "Vermelho", color_hex: "#ef4444", status: "ALIVE", has_voted: false },
  { id: "p2", player_name: "Azul", color_hex: "#3b82f6", status: "ALIVE", has_voted: true },
  { id: "p3", player_name: "Amarelo", color_hex: "#eab308", status: "ALIVE", has_voted: false },
  { id: "p4", player_name: "Verde", color_hex: "#22c55e", status: "ELIMINATED", has_voted: false },
  { id: "p5", player_name: "Rosa", color_hex: "#ec4899", status: "ALIVE", has_voted: true },
];

export const VotingSessionScreen: React.FC<VotingSessionProps> = ({
  roomId,
  currentPlayerId,
  reporterName,
  votingTimeSeconds = 45,
  onVotingEnded,
}) => {
  const [players, setPlayers] = useState<PlayerVoteState[]>(DEMO_VOTING_PLAYERS);
  const [selectedTarget, setSelectedTarget] = useState<string | "SKIP" | null>(null);
  const [hasConfirmed, setHasConfirmed] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(votingTimeSeconds);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const supabase = createClient();

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isEliminated = currentPlayer?.status === "ELIMINATED";

  // 1. Carregar jogadores da sala e escutar votos em tempo real
  useEffect(() => {
    const fetchRoomPlayers = async () => {
      try {
        const { data, error } = await supabase
          .from("room_players")
          .select("id, player_name, color_hex, status, has_voted")
          .eq("room_id", roomId);

        if (data && data.length > 0) {
          setPlayers(data as PlayerVoteState[]);
        }
      } catch (err) {
        console.warn("Usando jogadores de demonstração no ambiente local:", err);
      }
    };

    fetchRoomPlayers();

    // Canal Realtime para sincronizar quando alguém vota
    const channel = supabase.channel(`room-voting:${roomId}`);
    channel
      .on("broadcast", { event: "PLAYER_VOTED" }, (payload) => {
        const votedPlayerId = payload.payload?.playerId;
        if (votedPlayerId) {
          setPlayers((prev) =>
            prev.map((p) => (p.id === votedPlayerId ? { ...p, has_voted: true } : p))
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // 2. Cronômetro regressivo da votação
  useEffect(() => {
    if (timeLeft > 0 && !hasConfirmed) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && !hasConfirmed) {
      // Auto-skip se o tempo esgotar sem voto
      handleConfirmVote("SKIP");
    }
  }, [timeLeft, hasConfirmed]);

  // 3. Enviar o voto para o Supabase
  const handleConfirmVote = async (targetId: string | "SKIP") => {
    if (hasConfirmed || isEliminated) return;
    setIsSubmitting(true);

    try {
      // Atualiza o estado visual localmente
      setHasConfirmed(true);
      setSelectedTarget(targetId);
      setPlayers((prev) =>
        prev.map((p) => (p.id === currentPlayerId ? { ...p, has_voted: true } : p))
      );

      // Grava o voto no Supabase (atualiza flag no room_players ou envia broadcast)
      const { error } = await supabase
        .from("room_players")
        .update({ has_voted: true })
        .eq("id", currentPlayerId);

      if (error) {
        console.warn("Aviso na gravação do voto no Supabase (modo demo):", error);
      }

      // Notifica os outros jogadores via WebSocket Realtime
      const channel = supabase.channel(`room:${roomId}`);
      await channel.send({
        type: "broadcast",
        event: "PLAYER_VOTED",
        payload: { playerId: currentPlayerId, targetId },
      });

      if (onVotingEnded && timeLeft <= 0) {
        onVotingEnded();
      }
    } catch (err) {
      console.error("Erro ao registrar voto:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] bg-slate-950 text-white p-4 flex flex-col justify-between max-w-md mx-auto select-none font-sans border-x border-slate-800 shadow-2xl relative rounded-3xl overflow-hidden">
      {/* Top Banner de Emergência */}
      <header className="text-center pt-2 pb-3 z-10 relative">
        <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/60 text-red-400 font-black px-4 py-1.5 rounded-full text-xs uppercase tracking-widest mb-2 animate-pulse shadow-lg">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span>🚨 Reunião de Emergência</span>
        </div>
        <p className="text-xs text-slate-400">
          Reportado por: <span className="font-bold text-white">{reporterName}</span>
        </p>
        <div className="mt-2 text-xs font-mono text-cyan-400 bg-slate-900 border border-slate-800 py-1.5 px-3 rounded-xl inline-flex items-center gap-1.5 shadow-inner">
          <Clock className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          <span>Tempo para Votar: {timeLeft}s</span>
        </div>
      </header>

      {/* Grid de Votação (Lista de Jogadores) */}
      <main className="my-auto space-y-2.5 z-10 relative">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            {isEliminated ? "Você está morto (Sem direito a voto)" : "Selecione o suspeito:"}
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">
            Votos: {players.filter((p) => p.has_voted).length}/{players.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
          {players.map((player) => {
            const isSelected = selectedTarget === player.id;
            const cantVote = player.status === "ELIMINATED" || isEliminated || hasConfirmed;

            return (
              <button
                key={player.id}
                disabled={cantVote}
                onClick={() => setSelectedTarget(player.id)}
                className={`p-3 rounded-2xl border flex items-center justify-between text-left transition-all ${
                  player.status === "ELIMINATED"
                    ? "bg-slate-900/30 border-slate-850/40 opacity-40 line-through text-slate-600 cursor-not-allowed"
                    : isSelected
                    ? "bg-red-950/40 border-red-500 text-white ring-2 ring-red-500/40 shadow-lg scale-[1.02]"
                    : "bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700 active:scale-95"
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div
                    className="w-5 h-5 rounded-full shrink-0 border border-white/20 shadow-sm"
                    style={{ backgroundColor: player.color_hex || "#3b82f6" }}
                  />
                  <span className="text-xs font-bold truncate">{player.player_name}</span>
                </div>
                {player.status === "ELIMINATED" ? (
                  <Skull className="w-4 h-4 text-slate-500 shrink-0" />
                ) : player.has_voted ? (
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : null}
              </button>
            );
          })}
        </div>
      </main>

      {/* Botões de Ação na Zona de Alcance dos Polegares */}
      <footer className="space-y-2.5 pt-3 border-t border-slate-900 z-10 relative">
        {!isEliminated && !hasConfirmed && (
          <>
            <button
              onClick={() => setSelectedTarget("SKIP")}
              className={`w-full py-3 rounded-2xl border text-xs font-bold uppercase tracking-wider transition ${
                selectedTarget === "SKIP"
                  ? "bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-500/30"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Pular Voto (Skip Vote)
            </button>

            {selectedTarget && (
              <button
                disabled={isSubmitting}
                onClick={() => handleConfirmVote(selectedTarget)}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl uppercase text-xs transition shadow-xl tracking-wider flex items-center justify-center gap-2 active:scale-95 border border-red-500/50"
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
