"use client";

import React, { useState, useEffect } from "react";
import { PlayerGameState, VotingResult } from "@/types/game";
import { Timer, AlertTriangle, Check, Skull, Ban, ArrowRight, UserX } from "lucide-react";

interface VotingScreenProps {
  players: PlayerGameState[];
  currentUserId: string;
  votingTimeSeconds?: number;
  onVoteCast: (targetId: string | "skip") => void;
  onVotingComplete: (result: VotingResult) => void;
  meetingCause?: "emergency" | "body";
}

export const VotingScreen: React.FC<VotingScreenProps> = ({
  players,
  currentUserId,
  votingTimeSeconds = 60,
  onVoteCast,
  onVotingComplete,
  meetingCause = "emergency",
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(votingTimeSeconds);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerGameState | "skip" | null>(null);
  const [userVote, setUserVote] = useState<string | "skip" | null>(null);
  const [isRevealPhase, setIsRevealPhase] = useState<boolean>(false);
  const [votingResult, setVotingResult] = useState<VotingResult | null>(null);

  const currentUser = players.find((p) => p.id === currentUserId);
  const alivePlayers = players.filter((p) => p.is_alive);

  // Audio tone helper
  const playAlertTone = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Audio fallback
    }
  };

  // Timer countdown loop
  useEffect(() => {
    if (isRevealPhase) return;

    if (timeLeft <= 0) {
      handleCalculateResults();
      return;
    }

    if (timeLeft <= 10) {
      playAlertTone();
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isRevealPhase]);

  // Check if all alive players have voted
  useEffect(() => {
    if (isRevealPhase) return;
    const allAliveVoted = alivePlayers.every((p) => p.has_voted || p.id === currentUserId && userVote !== null);
    if (allAliveVoted && alivePlayers.length > 0) {
      handleCalculateResults();
    }
  }, [players, userVote, isRevealPhase]);

  // Calculate election / voting results
  const handleCalculateResults = () => {
    if (isRevealPhase) return;

    const tally: Record<string, number> = {};
    players.forEach((p) => {
      if (p.voted_for_id) {
        tally[p.voted_for_id] = (tally[p.voted_for_id] || 0) + 1;
      }
    });

    // If current user voted locally
    if (userVote) {
      tally[userVote] = (tally[userVote] || 0) + 1;
    }

    let maxVotes = 0;
    let topTarget: string | null = null;
    let isTie = false;

    Object.entries(tally).forEach(([targetId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        topTarget = targetId;
        isTie = false;
      } else if (count === maxVotes && count > 0) {
        isTie = true;
      }
    });

    const isSkip = topTarget === "skip" || isTie || !topTarget;
    const ejectedPlayer = isSkip ? null : players.find((p) => p.id === topTarget) || null;

    const result: VotingResult = {
      ejectedPlayer,
      isTie,
      isSkip,
      tally,
    };

    setVotingResult(result);
    setIsRevealPhase(true);
  };

  const confirmVote = () => {
    if (!selectedPlayer) return;
    const targetId = selectedPlayer === "skip" ? "skip" : selectedPlayer.id;
    setUserVote(targetId);
    onVoteCast(targetId);
    setSelectedPlayer(null);
  };

  return (
    <div className="relative w-full max-w-md mx-auto h-[85vh] max-h-[720px] bg-slate-950 text-white rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl flex flex-col justify-between p-4 select-none">
      {/* Header Banner */}
      <div className="z-20 bg-gradient-to-r from-red-950 via-slate-900 to-red-950 px-4 py-3 rounded-2xl border border-red-800/60 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-red-600/30 text-red-400 border border-red-500/40 animate-pulse">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-red-400 uppercase tracking-widest">
              {meetingCause === "body" ? "CORPO REPORTADO!" : "REUNIÃO DE EMERGÊNCIA"}
            </h2>
            <p className="text-xs text-slate-300">Quem é o Impostor?</p>
          </div>
        </div>

        {/* Timer Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
            timeLeft <= 10
              ? "bg-red-600/30 border-red-500 text-red-400 animate-bounce"
              : "bg-slate-800 border-slate-700 text-cyan-400"
          }`}
        >
          <Timer className="w-4 h-4" />
          <span>{isRevealPhase ? "REVELANDO" : `${timeLeft}s`}</span>
        </div>
      </div>

      {/* Main Content Area */}
      {!isRevealPhase ? (
        <div className="flex-1 my-3 overflow-y-auto pr-1 space-y-2.5">
          {/* Player Cards List */}
          {players.map((player) => {
            const isMe = player.id === currentUserId;
            const hasVotedState = player.has_voted || (isMe && userVote !== null);
            const canVoteOnThisPlayer =
              currentUser?.is_alive && player.is_alive && !userVote && !isMe;

            return (
              <div
                key={player.id}
                onClick={() => canVoteOnThisPlayer && setSelectedPlayer(player)}
                className={`relative flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  !player.is_alive
                    ? "bg-slate-900/40 border-slate-800 opacity-50"
                    : isMe
                    ? "bg-cyan-950/40 border-cyan-500/50 shadow-md"
                    : canVoteOnThisPlayer
                    ? "bg-slate-900 hover:bg-slate-800 border-slate-700 cursor-pointer active:scale-[0.98]"
                    : "bg-slate-900 border-slate-800"
                }`}
              >
                {/* Player Avatar & Info */}
                <div className="flex items-center gap-3">
                  {/* Avatar Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border-2 border-slate-950 shadow"
                    style={{ backgroundColor: player.color || "#64748b" }}
                  >
                    {!player.is_alive ? (
                      <Skull className="w-5 h-5 text-slate-950" />
                    ) : (
                      <span className="font-bold text-slate-950 text-sm">
                        {player.nickname.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-200">
                        {player.nickname}
                      </span>
                      {isMe && (
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 px-1.5 py-0.5 rounded font-mono">
                          VOCÊ
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {player.is_alive ? "Vivo" : "Eliminado"}
                    </span>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2">
                  {!player.is_alive && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-950/60 border border-red-800 px-2 py-1 rounded-lg">
                      <UserX className="w-3 h-3" /> MORTO
                    </span>
                  )}

                  {player.is_alive && hasVotedState && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-1 rounded-lg animate-in fade-in">
                      <Check className="w-3 h-3" /> VOTOU
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Reveal Results Phase */
        <div className="flex-1 my-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
          {votingResult?.ejectedPlayer ? (
            <>
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center border-4 border-slate-950 shadow-2xl mb-4 animate-bounce"
                style={{ backgroundColor: votingResult.ejectedPlayer.color || "#ef4444" }}
              >
                <UserX className="w-10 h-10 text-slate-950" />
              </div>
              <h3 className="text-xl font-extrabold text-red-400 uppercase tracking-widest">
                {votingResult.ejectedPlayer.nickname} foi Ejetado(a).
              </h3>
              <p className="text-xs text-slate-400 mt-2">
                Recebeu a maioria dos votos da tripulação.
              </p>
            </>
          ) : (
            <>
              <div className="p-4 rounded-full bg-slate-800 text-slate-300 mb-4 border border-slate-700">
                <Ban className="w-12 h-12 text-amber-400" />
              </div>
              <h3 className="text-lg font-extrabold text-amber-400 uppercase tracking-wider">
                Ninguém foi Ejetado.
              </h3>
              <p className="text-xs text-slate-400 mt-2">
                {votingResult?.isTie ? "(Ocorreu um Empate nos Votos)" : "(A maioria pulou a votação)"}
              </p>
            </>
          )}

          {/* Action Button after reveal */}
          <button
            onClick={() => votingResult && onVotingComplete(votingResult)}
            className="mt-6 w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
          >
            <span>Continuar Partida</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Vote Confirmation Modal */}
      {selectedPlayer && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center animate-in zoom-in duration-150">
          <h3 className="text-lg font-extrabold text-slate-100 uppercase tracking-wider mb-2">
            Confirmar Voto?
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            {selectedPlayer === "skip"
              ? "Você deseja PULAR o seu voto nesta rodada?"
              : `Você deseja votar para ejetar ${selectedPlayer.nickname}?`}
          </p>

          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={() => setSelectedPlayer(null)}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs uppercase"
            >
              Cancelar
            </button>
            <button
              onClick={confirmVote}
              className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs uppercase shadow-lg shadow-red-600/30"
            >
              Confirmar Voto
            </button>
          </div>
        </div>
      )}

      {/* Footer Skip Vote Button */}
      {!isRevealPhase && (
        <div className="z-20 pt-2 border-t border-slate-800">
          {userVote ? (
            <div className="w-full py-3 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs text-cyan-400 font-mono">
              VOTO REGISTRADO COM SUCESSO!
            </div>
          ) : currentUser?.is_alive ? (
            <button
              onClick={() => setSelectedPlayer("skip")}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-2xl text-xs uppercase transition-all active:scale-[0.98]"
            >
              <Ban className="w-4 h-4 text-amber-400" />
              <span>PULAR VOTO (SKIP VOTE)</span>
            </button>
          ) : (
            <div className="w-full py-3 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs text-slate-500 font-mono">
              JOGADORES ELIMINADOS NÃO VOTAM
            </div>
          )}
        </div>
      )}
    </div>
  );
};
