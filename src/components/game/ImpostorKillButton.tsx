"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Skull, AlertCircle, RefreshCw, X, Zap } from "lucide-react";
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

const DEMO_TARGETS: PlayerTarget[] = [
  { id: "p1", player_name: "Azul", color_hex: "#3b82f6", status: "ALIVE" },
  { id: "p2", player_name: "Verde", color_hex: "#10b981", status: "ALIVE" },
  { id: "p3", player_name: "Amarelo", color_hex: "#eab308", status: "ALIVE" },
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

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  const handleOpenKillMenu = async () => {
    if (cooldown > 0) return;
    setErrorMsg(null);

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

    try {
      const isValidUuid = (str?: string) =>
        typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      let targetRoomUuid = roomId;
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
          setShowTargetModal(true);
          return;
        }
      }

      const demoAlive = DEMO_TARGETS.filter((t) => t.id !== impostorId && t.status === "ALIVE");
      setTargets(demoAlive);
      setShowTargetModal(true);
    } catch (err) {
      console.warn("Usando alvos de demonstração:", err);
      const demoAlive = DEMO_TARGETS.filter((t) => t.id !== impostorId && t.status === "ALIVE");
      setTargets(demoAlive);
      setShowTargetModal(true);
    }
  };

  const handleExecuteKill = async (targetId: string) => {
    setIsExecuting(true);
    setErrorMsg(null);

    const victim = targets.find((t) => t.id === targetId);
    const victimName = victim?.player_name || targetId;

    setTargets((prev) => prev.filter((t) => t.id !== targetId));

    try {
      const isValidUuid = (str?: string) =>
        typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      if (isValidUuid(targetId)) {
        await supabase
          .from("room_players")
          .update({ status: "ELIMINATED" })
          .eq("id", targetId);
      }

      if (isValidUuid(roomId)) {
        await supabase.from("game_events").insert({
          room_id: roomId,
          event_type: "PLAYER_KILLED",
          player_id: isValidUuid(impostorId) ? impostorId : null,
          target_id: isValidUuid(targetId) ? targetId : null,
          payload: { victimName, victimId: targetId },
        });
      }

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
      }

      if (typeof window !== "undefined" && navigator.vibrate) {
        navigator.vibrate([150, 50, 150]);
      }

      if (onKillExecuted) {
        onKillExecuted(targetId, victimName);
      }

      setShowTargetModal(false);
      setCooldown(initialCooldownSeconds);
    } catch (err: any) {
      console.error("Erro ao processar abate:", err);
      setErrorMsg(err.message || "Erro ao processar abate.");
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Botão Circular Vermelho de Abate (Thumb Zone) */}
      <button
        type="button"
        disabled={cooldown > 0}
        onClick={handleOpenKillMenu}
        className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center transition-all cursor-pointer shadow-2xl active:scale-95 ${
          cooldown > 0
            ? "bg-slate-900 text-slate-500 border-slate-700 opacity-80 cursor-not-allowed"
            : "btn-3d-red border-red-300 shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse"
        }`}
      >
        <Skull className={`w-8 h-8 ${cooldown > 0 ? "text-slate-600" : "text-white"}`} />
        <span
          style={{ fontFamily: "var(--font-anton), Anton, sans-serif" }}
          className="text-xs uppercase tracking-widest mt-0.5"
        >
          ABATER
        </span>
        {cooldown > 0 && (
          <span
            style={{ fontFamily: "var(--font-barlow), Barlow, sans-serif" }}
            className="text-sm font-bold text-red-400"
          >
            {cooldown}s
          </span>
        )}
      </button>

      {/* Modal de Seleção do Alvo */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-4 flex items-center justify-center max-w-sm mx-auto animate-in fade-in">
          <div className="w-full console-card p-5 space-y-4">
            <header className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-red-400">
                <Skull className="w-5 h-5" />
                <h3
                  style={{ fontFamily: "var(--font-anton), Anton, sans-serif" }}
                  className="text-lg uppercase tracking-wider text-white"
                >
                  SELECIONE O ALVO
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTargetModal(false)}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {errorMsg && (
              <div className="bg-red-950/80 border border-red-500/50 text-red-200 text-xs p-2.5 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {targets.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs font-mono">
                  Nenhum tripulante vivo disponível.
                </div>
              ) : (
                targets.map((target) => (
                  <button
                    key={target.id}
                    disabled={isExecuting}
                    onClick={() => handleExecuteKill(target.id)}
                    className="w-full bg-[#020617] hover:bg-red-950/40 border border-slate-800 hover:border-red-500/60 p-3 rounded-2xl flex items-center justify-between transition-all active:scale-98 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-5 h-5 rounded-full border border-slate-700 shadow-sm"
                        style={{ backgroundColor: target.color_hex || "#3b82f6" }}
                      />
                      <span className="text-sm font-bold text-slate-100">
                        {target.player_name}
                      </span>
                    </div>

                    <span className="px-3 py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-black uppercase flex items-center gap-1">
                      {isExecuting ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Zap className="w-3 h-3 fill-current" />
                          <span>ELIMINAR</span>
                        </>
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowTargetModal(false)}
              className="w-full h-[46px] rounded-xl btn-3d-slate text-xs font-black uppercase cursor-pointer"
            >
              CANCELAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
