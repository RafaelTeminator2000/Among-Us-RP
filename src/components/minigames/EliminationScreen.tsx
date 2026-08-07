"use client";

import React from "react";
import { PlayerGameState } from "@/types/game";
import { Skull, ShieldCheck, Users, Eye, Info } from "lucide-react";

interface EliminationScreenProps {
  eliminatedPlayer: PlayerGameState;
  players: PlayerGameState[];
  onReturnToLobby?: () => void;
}

export const EliminationScreen: React.FC<EliminationScreenProps> = ({
  eliminatedPlayer,
  players,
  onReturnToLobby,
}) => {
  // Recalculate progress ONLY for living players
  const livingPlayers = players.filter((p) => p.is_alive);
  const deadPlayers = players.filter((p) => !p.is_alive);

  const livingCompletedTasks = livingPlayers.reduce((acc, p) => acc + p.completed_tasks, 0);
  const livingTotalTasks = livingPlayers.reduce((acc, p) => acc + p.total_tasks, 0);
  const progressPercentage =
    livingTotalTasks > 0 ? Math.round((livingCompletedTasks / livingTotalTasks) * 100) : 0;

  const livingCrewmates = livingPlayers.filter((p) => p.role !== "IMPOSTOR").length;
  const livingImpostors = livingPlayers.filter((p) => p.role === "IMPOSTOR").length;

  return (
    <div className="relative w-full max-w-md mx-auto h-[85vh] max-h-[720px] bg-slate-950 text-white rounded-3xl overflow-hidden border-2 border-red-900/60 shadow-2xl flex flex-col justify-between p-5 select-none">
      {/* Background Starfield Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#ef4444_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      {/* Top Banner */}
      <div className="z-10 bg-red-950/80 border border-red-800 px-4 py-3 rounded-2xl flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-red-600/30 text-red-400 border border-red-500/40">
            <Skull className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-red-400 uppercase tracking-wider">
              VOCÊ FOI ELIMINADO
            </h2>
            <p className="text-xs text-slate-300">Aguarde o término da partida</p>
          </div>
        </div>

        <span className="text-[10px] font-mono bg-red-900/60 text-red-300 px-2 py-1 rounded border border-red-700">
          SEM FANTASMA
        </span>
      </div>

      {/* Main Content Area */}
      <div className="z-10 my-4 flex-1 flex flex-col justify-between">
        {/* Hero Character Badge */}
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900/90 border border-slate-800 rounded-3xl text-center shadow-xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />

          {/* Character Color Circle */}
          <div
            className="relative w-20 h-20 rounded-3xl flex items-center justify-center border-4 border-slate-950 shadow-2xl mb-3"
            style={{ backgroundColor: eliminatedPlayer.color || "#ef4444" }}
          >
            <Skull className="w-10 h-10 text-slate-950" />
            <div className="absolute -bottom-2 bg-slate-950 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-800">
              MORTO
            </div>
          </div>

          <h3 className="text-lg font-black text-slate-100 uppercase tracking-widest">
            {eliminatedPlayer.nickname}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Você foi ejetado ou morto durante a partida.
          </p>

          {/* Rules Banner (Sem Fantasmas) */}
          <div className="mt-4 w-full bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3 text-left flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              <strong className="text-amber-400 uppercase">Regra RP Presencial:</strong> Jogadores
              eliminados permanecem em silêncio e não realizam tarefas como fantasmas. Suas tarefas foram
              recalculadas.
            </p>
          </div>
        </div>

        {/* Global Progress (Recalculated ONLY with Living Players) */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                Progresso Global (Sobreviventes)
              </span>
            </div>
            <span className="text-sm font-mono font-bold text-emerald-400">
              {progressPercentage}%
            </span>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 relative">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500 shadow-[0_0_12px_#34d399]"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Breakdown Stats */}
          <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/80">
              <span className="block text-[10px] text-slate-400 uppercase">Tarefas Vivas</span>
              <span className="font-mono font-bold text-slate-200">
                {livingCompletedTasks} / {livingTotalTasks}
              </span>
            </div>

            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/80">
              <span className="block text-[10px] text-slate-400 uppercase">Sobreviventes</span>
              <span className="font-mono font-bold text-cyan-400">
                {livingPlayers.length} / {players.length}
              </span>
            </div>
          </div>

          {/* Additional Status Counter */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Tripulantes Vivos: <strong className="text-slate-200">{livingCrewmates}</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <span>Mortos Descartados: <strong className="text-red-400">{deadPlayers.length}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Return / Spectate Option */}
      <div className="z-10 pt-2 border-t border-slate-800">
        <button
          onClick={onReturnToLobby}
          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all active:scale-[0.98]"
        >
          <Eye className="w-4 h-4 text-cyan-400" />
          <span>Voltar à Tela Principal</span>
        </button>
      </div>
    </div>
  );
};
