"use client";

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { User, KeyRound, Sparkles, Check, ArrowRight, AlertCircle, Loader2, Shield } from "lucide-react";

export const AVATAR_COLORS = [
  "#ef4444", // Vermelho
  "#3b82f6", // Azul
  "#22c55e", // Verde
  "#eab308", // Amarelo
  "#a855f7", // Roxo
  "#f97316", // Laranja
  "#ec4899", // Rosa
  "#06b6d4", // Ciano
  "#64748b", // Cinza
  "#ffffff", // Branco
  "#8b5cf6", // Violeta
  "#14b8a6", // Teal
];

interface GuestJoinProps {
  onSuccessfullyJoined: (roomId: string, playerId: string) => void;
}

export const GuestJoinScreen: React.FC<GuestJoinProps> = ({ onSuccessfullyJoined }) => {
  const supabase = createClient();

  const [roomCode, setRoomCode] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>(AVATAR_COLORS[0]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim() || !playerName.trim()) {
      setErrorMessage("Preencha o código da sala e o seu nome.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const cleanCode = roomCode.trim().toUpperCase();
    const cleanName = playerName.trim();

    try {
      // Tentar buscar sala no Supabase remoto
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("id, status")
        .eq("code", cleanCode)
        .maybeSingle();

      if (roomError) {
        console.warn("Aviso ao buscar sala no Supabase:", roomError.message);
      }

      if (room) {
        if (room.status !== "LOBBY") {
          throw new Error("A partida nesta sala já foi iniciada ou encerrada.");
        }

        // Inserir o jogador na tabela room_players do Supabase
        const { data: player, error: playerError } = await supabase
          .from("room_players")
          .insert([
            {
              room_id: room.id,
              player_name: cleanName,
              color_hex: selectedColor,
              status: "ALIVE",
            },
          ])
          .select("id")
          .single();

        if (playerError || !player) {
          throw new Error(playerError?.message || "Erro ao entrar na sala. Tente outro nome.");
        }

        onSuccessfullyJoined(room.id, player.id);
        return;
      }

      // Se a sala não for encontrada no banco remoto, mas o código for de teste (ex: A7X9 ou DEMO)
      if (cleanCode === "A7X9" || cleanCode === "DEMO") {
        setTimeout(() => {
          onSuccessfullyJoined("demo-room-id", `demo-player-${Date.now()}`);
        }, 600);
        return;
      }

      throw new Error("Sala não encontrada. Verifique o código com o Host da partida.");
    } catch (err: any) {
      setErrorMessage(err?.message || "Erro inesperado ao conectar à sala.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto min-h-[85vh] bg-slate-950 text-white rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl flex flex-col justify-between p-5 select-none font-sans">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="z-10 text-center space-y-1 pt-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Módulo Convidado (PWA Mobile)</span>
        </div>
        <h1 className="text-3xl font-black tracking-wider uppercase bg-gradient-to-r from-cyan-400 via-slate-100 to-red-400 bg-clip-text text-transparent">
          AMONG US RP
        </h1>
        <p className="text-xs text-slate-400">Entre na sala digitando o código informado pelo Host</p>
      </header>

      {/* Main Form Container */}
      <main className="z-10 my-4 flex-1 flex flex-col justify-center">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-5 rounded-3xl shadow-xl space-y-5">
          {/* Mensagem de Erro */}
          {errorMessage && (
            <div className="bg-red-950/80 border border-red-500/50 text-red-200 text-xs p-3 rounded-2xl text-center flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleJoinRoom} className="space-y-4">
            {/* Código da Sala */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-cyan-400" />
                <span>Código da Sala</span>
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="Ex: A7X9"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 font-mono font-black text-center tracking-widest text-xl text-cyan-400 placeholder-slate-600 focus:outline-none focus:border-cyan-400 uppercase shadow-inner"
              />
            </div>

            {/* Apelido / Nome */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-cyan-400" />
                <span>Seu Apelido</span>
              </label>
              <input
                type="text"
                maxLength={20}
                placeholder="Ex: Gabriel"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 font-semibold shadow-inner"
              />
            </div>

            {/* Escolha da Cor do Traje */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>Cor do Traje</span>
                </label>
                <div
                  className="w-4 h-4 rounded-full border border-slate-700 shadow-md"
                  style={{ backgroundColor: selectedColor }}
                />
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                {AVATAR_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    style={{ backgroundColor: color }}
                    className={`h-10 rounded-2xl transition-all relative flex items-center justify-center shadow-md active:scale-95 ${
                      selectedColor === color
                        ? "ring-4 ring-cyan-400 scale-105 border-2 border-slate-950"
                        : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    {selectedColor === color && (
                      <Check className="w-4 h-4 text-slate-950 drop-shadow-md stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Botão de Conectar */}
            <button
              type="submit"
              disabled={isLoading || !roomCode.trim() || !playerName.trim()}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xl mt-3 ${
                !isLoading && roomCode.trim() && playerName.trim()
                  ? "bg-gradient-to-r from-cyan-500 via-cyan-400 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 cursor-pointer shadow-cyan-950/50"
                  : "bg-slate-950 border border-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                  <span>Conectando à Sala...</span>
                </>
              ) : (
                <>
                  <span>Entrar na Sala</span>
                  <ArrowRight className="w-5 h-5 text-slate-950 stroke-[3]" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="z-10 text-center text-[11px] text-slate-500 font-mono">
        <p>Among Us RP Presencial &bull; PWA Client</p>
      </footer>
    </div>
  );
};
