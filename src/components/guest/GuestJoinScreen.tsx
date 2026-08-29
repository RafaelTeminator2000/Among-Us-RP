"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Users,
  Check,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import Link from "next/link";

export const AVATAR_COLORS = [
  { name: "Vermelho", hex: "#ef4444" },
  { name: "Azul", hex: "#3b82f6" },
  { name: "Verde", hex: "#10b981" },
  { name: "Rosa", hex: "#ec4899" },
  { name: "Laranja", hex: "#f97316" },
  { name: "Amarelo", hex: "#eab308" },
  { name: "Roxo", hex: "#a855f7" },
  { name: "Ciano", hex: "#06b6d4" },
  { name: "Lima", hex: "#84cc16" },
  { name: "Coral", hex: "#fb7185" },
  { name: "Grafite", hex: "#475569" },
  { name: "Branco", hex: "#f8fafc" },
];

interface GuestJoinProps {
  onSuccessfullyJoined: (roomId: string, playerId: string) => void;
  onCancel?: () => void;
}

export const GuestJoinScreen: React.FC<GuestJoinProps> = ({
  onSuccessfullyJoined,
  onCancel,
}) => {
  const supabase = createClient();

  const [roomCode, setRoomCode] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>(AVATAR_COLORS[0].hex);
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

        // Verificar capacidade máxima da sala (Limite de 30 jogadores)
        const { count, error: countError } = await supabase
          .from("room_players")
          .select("id", { count: "exact", head: true })
          .eq("room_id", room.id);

        if (!countError && count !== null && count >= 30) {
          throw new Error("A sala atingiu o limite máximo de 30 jogadores.");
        }

        // Limpar registros anteriores deste jogador em salas antigas antes de entrar na nova sala
        const previousPlayerId = typeof window !== "undefined" ? localStorage.getItem("current_player_id") : null;
        const isValidUuid = (str?: string) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        if (previousPlayerId && isValidUuid(previousPlayerId)) {
          await supabase.from("room_players").delete().eq("id", previousPlayerId);
        }
        if (cleanName) {
          await supabase.from("room_players").delete().eq("player_name", cleanName).neq("room_id", room.id);
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
          .maybeSingle();

        if (playerError || !player) {
          throw new Error(playerError?.message || "Erro ao entrar na sala. Tente outro nome.");
        }

        if (typeof window !== "undefined") {
          localStorage.setItem(`player_name_${room.id}`, cleanName);
          localStorage.setItem(`player_color_${room.id}`, selectedColor);
          localStorage.setItem(`room_player_${room.id}`, player.id);
          localStorage.setItem("current_player_name", cleanName);
          localStorage.setItem("current_player_color", selectedColor);
          localStorage.setItem("current_player_id", player.id);
        }

        onSuccessfullyJoined(room.id, player.id);
        return;
      }

      // Se a sala não for encontrada no banco remoto, mas o código for de teste (ex: A7X9 ou DEMO)
      if (cleanCode === "A7X9" || cleanCode === "DEMO") {
        const demoPlayerId = `demo-player-${Date.now()}`;
        if (typeof window !== "undefined") {
          localStorage.setItem("player_name_demo-room-id", cleanName);
          localStorage.setItem("player_color_demo-room-id", selectedColor);
          localStorage.setItem("room_player_demo-room-id", demoPlayerId);
          localStorage.setItem("current_player_name", cleanName);
          localStorage.setItem("current_player_color", selectedColor);
          localStorage.setItem("current_player_id", demoPlayerId);
        }

        setTimeout(() => {
          onSuccessfullyJoined("demo-room-id", demoPlayerId);
        }, 500);
        return;
      }

      throw new Error("Sala não encontrada. Verifique o código de 4 dígitos com o Host.");
    } catch (err: any) {
      setErrorMessage(err?.message || "Erro inesperado ao conectar à sala.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-sm mx-auto min-h-[90vh] bg-deep-space-stars text-white rounded-3xl overflow-hidden console-card flex flex-col justify-between p-5 select-none font-sans shadow-2xl">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header com Título e Botão Voltar */}
      <header className="z-10 flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1
              style={{ fontFamily: "var(--font-anton), Anton, sans-serif" }}
              className="text-lg uppercase tracking-wider text-white"
            >
              IDENTIFICAÇÃO DO TRIPULANTE
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Conecte seu dispositivo móvel</p>
          </div>
        </div>

        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <Link
            href="/"
            className="w-8 h-8 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Link>
        )}
      </header>

      {/* Main Form Container */}
      <main className="z-10 my-auto flex-1 flex flex-col justify-center py-3">
        {/* Mensagem de Erro */}
        {errorMessage && (
          <div className="mb-3 bg-red-950/80 border border-red-500/50 text-red-200 text-xs p-3 rounded-2xl flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleJoinRoom} className="space-y-4">
          {/* Código da Sala */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono font-bold uppercase text-slate-300 block">
              Código da Sala (4 Dígitos)
            </label>
            <input
              type="text"
              maxLength={6}
              placeholder="EX: A7X9"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              style={{ fontFamily: "var(--font-mono), Space Mono, monospace" }}
              className="w-full input-fenda rounded-2xl px-4 py-3 font-mono font-black text-center tracking-widest text-2xl text-cyan-400 placeholder-slate-700 uppercase"
            />
          </div>

          {/* Nome / Apelido */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono font-bold uppercase text-slate-300 block">
              Seu Nome / Apelido
            </label>
            <input
              type="text"
              maxLength={20}
              placeholder="Ex: RedSus"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full input-fenda rounded-2xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 font-semibold"
            />
          </div>

          {/* Paleta Seletora de Cores (Grid 4x2) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold uppercase text-slate-300 flex items-center justify-between">
              <span>Cor do Traje</span>
              <span className="text-cyan-400">
                {AVATAR_COLORS.find((c) => c.hex === selectedColor)?.name}
              </span>
            </label>

            <div className="grid grid-cols-4 gap-2.5 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
              {AVATAR_COLORS.map((color) => {
                const isSelected = selectedColor === color.hex;
                return (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setSelectedColor(color.hex)}
                    style={{ backgroundColor: color.hex }}
                    className={`h-10 rounded-xl transition-all relative flex items-center justify-center shadow-md cursor-pointer ${
                      isSelected
                        ? "ring-3 ring-white scale-105 border-2 border-slate-950"
                        : "opacity-75 hover:opacity-100 hover:scale-98"
                    }`}
                    title={color.name}
                  >
                    {isSelected && <Check className="w-5 h-5 text-slate-950 stroke-[3.5] drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botão Fixo Verde 3D */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !roomCode.trim() || !playerName.trim()}
              className="w-full h-[54px] rounded-2xl btn-3d-green flex items-center justify-center gap-2 text-base font-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                  <span>CONECTANDO...</span>
                </>
              ) : (
                <>
                  <span>🚀 ENTRAR NO LOBBY</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="z-10 text-center text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-900">
        <p>Among Us RP Presencial • PWA Client</p>
      </footer>
    </div>
  );
};
