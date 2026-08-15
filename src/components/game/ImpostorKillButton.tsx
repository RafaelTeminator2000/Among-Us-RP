"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Skull, AlertCircle, RefreshCw, X, ShieldAlert, Zap } from "lucide-react";
import { PlayerGameState } from "@/types/game";

interface PlayerTarget {
  id: string;
  player_name: string;
  color_hex: string;
  status: string;
}

interface ImpostorKillProps {
  roomId: string;
  roomCode?: string;
  impostorId: string;
  players?: PlayerGameState[];
  initialCooldownSeconds?: number;
  sendBroadcast?: (event: string, payload: any) => Promise<any>;
  onKillExecuted?: (victimId: string, victimName: string) => void;
}

// Fallback responsivo para partidas demo ou presenciais sem persistência em banco
const DEMO_TARGETS: PlayerTarget[] = [
  { id: "p1", player_name: "P1", color_hex: "#a855f7", status: "ALIVE" },
  { id: "p2", player_name: "P2", color_hex: "#22c55e", status: "ALIVE" },
  { id: "p3", player_name: "P3", color_hex: "#f97316", status: "ALIVE" },
];

export const ImpostorKillButton: React.FC<ImpostorKillProps> = ({
  roomId,
  roomCode,
  impostorId,
  players,
  initialCooldownSeconds = 30,
  sendBroadcast,
  onKillExecuted,
}) => {
  const [cooldown, setCooldown] = useState<number>(initialCooldownSeconds);
  const [targets, setTargets] = useState<PlayerTarget[]>([]);
  const [showTargetModal, setShowTargetModal] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabase = createClient();

  // Efeito do Cronômetro de Cooldown de Abate
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  // Buscar alvos vivos na sala
  const handleOpenKillMenu = async () => {
    if (cooldown > 0) return;
    setErrorMsg(null);

    // 1. Se a lista de jogadores `players` for fornecida via props, filtrar tripulantes vivos
    if (players && players.length > 0) {
      const aliveTargets = players
        .filter((p) => {
          const isMe = p.id === impostorId || p.nickname === impostorId;
          const isImpostor = p.role === "IMPOSTOR";
          const isDead = !p.is_alive || (p as any).status === "ELIMINATED";
          return !isMe && !isImpostor && !isDead;
        })
        .map((p) => ({
          id: p.id,
          player_name: p.nickname,
          color_hex: p.color || "#3b82f6",
          status: "ALIVE",
        }));

      setTargets(aliveTargets);
      if (aliveTargets.length === 0) {
        setErrorMsg("Nenhum tripulante vivo disponível para abater.");
      }
      setShowTargetModal(true);
      return;
    }

    // 2. Tentar buscar no Supabase
    try {
      const isValidUuid = (str?: string) =>
        typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      let targetRoomUuid = roomId;

      // Se roomId for um código (ex: "A7X9"), buscar o UUID da sala no Supabase
      if (!isValidUuid(roomId)) {
        const { data: roomData } = await supabase
          .from("rooms")
          .select("id")
          .eq("code", (roomCode || roomId).toUpperCase())
          .maybeSingle();

        if (roomData?.id) {
          targetRoomUuid = roomData.id;
        }
      }

      if (isValidUuid(targetRoomUuid)) {
        const { data, error } = await supabase
          .from("room_players")
          .select("id, player_name, color_hex, status, role")
          .eq("room_id", targetRoomUuid)
          .eq("status", "ALIVE")
          .neq("id", impostorId);

        if (!error && data) {
          const aliveCrewmates = data.filter(
            (p) => p.status === "ALIVE" && p.role !== "IMPOSTOR" && p.id !== impostorId
          );
          setTargets(aliveCrewmates);
          if (aliveCrewmates.length === 0) {
            setErrorMsg("Nenhum tripulante vivo disponível no banco.");
          }
          setShowTargetModal(true);
          return;
        }
      }

      // 3. Fallback dinâmico para demonstração
      const demoAlive = DEMO_TARGETS.filter((t) => t.id !== impostorId && t.status === "ALIVE");
      setTargets(demoAlive);
      if (demoAlive.length === 0) {
        setErrorMsg("Nenhum tripulante vivo para abater.");
      }
      setShowTargetModal(true);
    } catch (err) {
      console.warn("Usando alvos de demonstração devido ao erro:", err);
      const demoAlive = DEMO_TARGETS.filter((t) => t.id !== impostorId && t.status === "ALIVE");
      setTargets(demoAlive);
      setShowTargetModal(true);
    }
  };

  // Executar o Abate no Servidor e via WebSockets
  const handleExecuteKill = async (targetId: string) => {
    setIsExecuting(true);
    setErrorMsg(null);

    const victim = targets.find((t) => t.id === targetId);
    const victimName = victim?.player_name || targetId;

    // Remover a vítima da lista local de alvos imediatamente
    setTargets((prev) => prev.filter((t) => t.id !== targetId));

    try {
      const isValidUuid = (str?: string) =>
        typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      // 1. Atualizar status da vítima para ELIMINATED no Supabase DB
      if (isValidUuid(targetId)) {
        await supabase
          .from("room_players")
          .update({ status: "ELIMINATED" })
          .eq("id", targetId);
      }

      // 2. Registrar evento na tabela game_events para o Event-Sourcing Lite
      if (isValidUuid(roomId)) {
        await supabase.from("game_events").insert({
          room_id: roomId,
          event_type: "PLAYER_KILLED",
          player_id: isValidUuid(impostorId) ? impostorId : null,
          target_id: isValidUuid(targetId) ? targetId : null,
          payload: { victimName, victimId: targetId },
        });
      }

      // 3. Transmitir abate em tempo real pelo canal unificado de WebSockets (< 50ms)
      const killPayload = { victimId: targetId, victimName, targetId, attackerId: impostorId };

      if (sendBroadcast) {
        await sendBroadcast("player_killed", killPayload);
        await sendBroadcast("PLAYER_KILLED", killPayload);
      } else {
        const topicKey = (roomCode || roomId).trim().toLowerCase();
        const channelTopic = `room:${topicKey}:game_flow`;
        const channel = supabase.channel(channelTopic);
        await channel.subscribe();
        await channel.send({
          type: "broadcast",
          event: "player_killed",
          payload: killPayload,
        });
        await channel.send({
          type: "broadcast",
          event: "PLAYER_KILLED",
          payload: killPayload,
        });
      }

      // Feedback tátil no celular do impostor (se suportado)
      if (typeof window !== "undefined" && navigator.vibrate) {
        navigator.vibrate([150, 50, 150]);
      }

      // Notificar callback se fornecido
      if (onKillExecuted) {
        onKillExecuted(targetId, victimName);
      }

      // Fechar modal, resetar cooldown de abate e limpar estado
      setShowTargetModal(false);
      setCooldown(initialCooldownSeconds);
    } catch (err: any) {
      console.error("Erro ao executar abate:", err);
      setErrorMsg(err.message || "Erro ao processar abate.");
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Botão Flutuante de Abate (HUD do Impostor - Zona do Polegar) */}
      <button
        disabled={cooldown > 0}
        onClick={handleOpenKillMenu}
        className={`w-28 h-28 rounded-full font-black uppercase text-xs tracking-wider shadow-2xl flex flex-col items-center justify-center transition-all select-none border-4 active:scale-95 ${
          cooldown > 0
            ? "bg-slate-900/90 text-slate-500 border-slate-800 cursor-not-allowed shadow-none opacity-80"
            : "bg-gradient-to-b from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white border-red-400 animate-pulse cursor-pointer shadow-red-950/60 shadow-2xl"
        }`}
      >
        <Skull className={`w-8 h-8 ${cooldown > 0 ? "text-slate-600" : "text-white"}`} />
        <span className="mt-1 font-extrabold tracking-widest text-[11px]">ABATER</span>
        {cooldown > 0 && (
          <span className="text-xs font-mono font-bold mt-0.5 text-red-400/90">
            {cooldown}s
          </span>
        )}
      </button>

      {/* Indicador de Cooldown / Pronto */}
      <div className="mt-2">
        {cooldown > 0 ? (
          <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            Aguardando Recarga...
          </span>
        ) : (
          <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider bg-red-950/60 px-3 py-1 rounded-full border border-red-600/40 animate-pulse">
            Pronto para Abate 🔪
          </span>
        )}
      </div>

      {/* Modal de Seleção de Alvo */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 p-6 flex flex-col justify-center max-w-md mx-auto select-none font-sans border-x border-slate-800 shadow-2xl">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl space-y-4">
            <header className="text-center border-b border-slate-800 pb-3 relative">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-500 mb-2">
                <Skull className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-lg font-black text-red-500 uppercase tracking-widest">
                Escolha o Alvo
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Toque no tripulante que você abateu na vida real (toque no ombro)
              </p>
            </header>

            {errorMsg && (
              <div className="bg-red-950/80 border border-red-600/60 text-red-200 text-xs p-2.5 rounded-xl flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {targets.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs italic">
                  Nenhum tripulante vivo encontrado nesta sala.
                </div>
              ) : (
                targets.map((target) => (
                  <button
                    key={target.id}
                    disabled={isExecuting}
                    onClick={() => handleExecuteKill(target.id)}
                    className="w-full bg-slate-950 hover:bg-red-950/50 border border-slate-800 hover:border-red-500/50 p-3 rounded-2xl flex items-center justify-between transition-all group active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-full shrink-0 border border-white/20 shadow-sm"
                        style={{ backgroundColor: target.color_hex || "#3b82f6" }}
                      />
                      <span className="text-sm font-bold text-white group-hover:text-red-200 transition-colors">
                        {target.player_name}
                      </span>
                    </div>
                    <span className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl font-extrabold uppercase tracking-wider border border-red-400/50 shadow flex items-center gap-1">
                      {isExecuting ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Zap className="w-3 h-3 fill-current" />
                          <span>Eliminar</span>
                        </>
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => setShowTargetModal(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition mt-2 border border-slate-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
