"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
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
  Printer
} from "lucide-react";


interface Player {
  id: string;
  room_id: string;
  player_name: string;
  color_hex: string;
  status: string;
  role?: string | null;
}

interface HostDashboardProps {
  roomId: string;
  roomCode: string;
  initialPlayers?: Player[];
  onGameStarted?: () => void;
}

export const HostDashboard: React.FC<HostDashboardProps> = ({
  roomId,
  roomCode,
  initialPlayers,
  onGameStarted,
}) => {
  const supabase = createClient();

  const [players, setPlayers] = useState<Player[]>(initialPlayers || []);
  const [impostorCount, setImpostorCount] = useState<number>(1);
  const [killCooldown, setKillCooldown] = useState<number>(30);
  const [taskCount, setTaskCount] = useState<number>(3);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const channelRef = useRef<any>(null);

  // Carregar jogadores e escutar novas entradas, alterações e saídas em tempo real (DB + WebSockets Presence)
  useEffect(() => {
    if (!roomId) return;

    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);

    // 1. Carregar do banco Postgres se for UUID válido
    const fetchPlayers = async () => {
      if (!isValidUuid) {
        if (initialPlayers && initialPlayers.length > 0) {
          setPlayers(initialPlayers);
        }
        return;
      }

      const { data, error } = await supabase
        .from("room_players")
        .select("*")
        .eq("room_id", roomId);

      if (error) {
        console.error("Erro ao buscar jogadores do Supabase:", error.message || error);
      } else if (data) {
        setPlayers(data as Player[]);
      }
    };

    fetchPlayers();

    // 2. Canal Realtime unificado (Presença de WebSockets em tempo real < 50ms)
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

    // Escutar Presence sync para detectar jogadores que entram pelo celular em tempo real
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activePresencePlayers: Player[] = [];

        Object.values(state).forEach((presences) => {
          presences.forEach((p: any) => {
            if (p && (p.id || p.playerId) && (p.name || p.player_name || p.playerName)) {
              activePresencePlayers.push({
                id: p.id || p.playerId,
                room_id: roomId,
                player_name: p.name || p.player_name || p.playerName || 'Tripulante',
                color_hex: p.color_hex || p.colorHex || '#3b82f6',
                status: p.is_alive !== false ? 'ALIVE' : 'ELIMINATED',
                role: p.role || null,
              });
            }
          });
        });

        if (activePresencePlayers.length > 0) {
          setPlayers((prev) => {
            const mergedMap = new Map<string, Player>();
            prev.forEach((player) => mergedMap.set(player.id, player));
            activePresencePlayers.forEach((player) => mergedMap.set(player.id, player));
            return Array.from(mergedMap.values());
          });
        }
      })
      .on('broadcast', { event: 'PLAYER_JOINED' }, ({ payload }) => {
        if (payload && (payload.id || payload.playerId)) {
          const newPlayer: Player = {
            id: payload.id || payload.playerId,
            room_id: roomId,
            player_name: payload.player_name || payload.name || payload.playerName || 'Tripulante',
            color_hex: payload.color_hex || payload.colorHex || '#3b82f6',
            status: 'ALIVE',
            role: payload.role || null,
          };
          setPlayers((prev) => {
            if (prev.some((p) => p.id === newPlayer.id)) return prev;
            return [...prev, newPlayer];
          });
        }
      });

    // Se for UUID válido, escutar também postgres_changes na tabela room_players
    if (isValidUuid) {
      channel.on(
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
            setPlayers((prev) => prev.filter((p) => p.id === payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            setPlayers((prev) =>
              prev.map((p) => (p.id === (payload.new as Player).id ? (payload.new as Player) : p))
            );
          }
        }
      );
    }

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

  // Função do Host para Sortear Papéis e Iniciar a Partida
  const handleStartGame = async () => {
    if (players.length < 3) {
      setStatusMessage("Mínimo de 3 jogadores necessários para iniciar a partida.");
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }

    setIsStarting(true);
    setStatusMessage("Sorteando papéis secretos e preparando o mapa...");

    try {
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);

      // 1. Sortear Impostores e Tripulantes aleatoriamente
      const shuffled = [...players].sort(() => 0.5 - Math.random());
      const impostorIds = new Set(shuffled.slice(0, Math.max(1, impostorCount)).map((p) => p.id));

      const rolesMap: Record<string, 'CREWMATE' | 'IMPOSTOR'> = {};
      players.forEach((p) => {
        rolesMap[p.id] = impostorIds.has(p.id) ? 'IMPOSTOR' : 'CREWMATE';
      });

      if (isValidUuid) {
        // 2. Atualizar o papel (role) de cada jogador no Supabase DB
        for (const player of players) {
          const role = rolesMap[player.id];
          await supabase
            .from("room_players")
            .update({ role })
            .eq("id", player.id);
        }

        // 3. Atualizar o status da sala para 'PLAYING' no DB
        await supabase
          .from("rooms")
          .update({
            status: "PLAYING",
            game_state: "PLAYING",
            rules: { kill_cooldown: killCooldown, impostor_count: impostorCount, task_count: taskCount },
          })
          .eq("id", roomId);
      }

      // 4. Transmitir sinal via WebSocket no canal padronizado já conectado
      const payload = {
        status: "PLAYING",
        roles: rolesMap,
        rules: { killCooldown, impostorCount, taskCount },
        timestamp: Date.now(),
      };

      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "GAME_STARTED",
          payload,
        });
      } else {
        const channelTopic = `room:${roomId}:game_flow`;
        const tempChannel = supabase.channel(channelTopic);
        await tempChannel.subscribe();
        await tempChannel.send({
          type: "broadcast",
          event: "GAME_STARTED",
          payload,
        });
      }

      setStatusMessage("Partida iniciada! Transmitindo sinal aos convidados...");
      setTimeout(() => {
        if (onGameStarted) {
          onGameStarted();
        }
      }, 1000);


    } catch (error: any) {
      console.error("Erro ao iniciar partida:", error?.message || error);
      setStatusMessage("Erro ao iniciar partida. Tente novamente.");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto min-h-[85vh] bg-slate-950 text-white rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl flex flex-col justify-between p-4 sm:p-5 select-none font-sans">
      {/* Glow Background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header com o Código da Sala */}
      <header className="z-10 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-lg">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] font-bold uppercase tracking-wider">
            <Crown className="w-3 h-3 text-cyan-400" />
            <span>HOST STUDIO</span>
          </div>
          <h1 className="text-base font-extrabold text-slate-100 tracking-tight">
            Lobby Presencial
          </h1>
        </div>

        {/* Big Room Code Badge */}
        <div className="flex items-center gap-2">
          <Link
            href="/admin/print"
            className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-cyan-400 rounded-xl transition-all flex items-center justify-center shadow-md active:scale-95"
            title="Imprimir Kit de QR Codes Permanentes"
          >
            <Printer className="w-5 h-5" />
          </Link>

          <button
            onClick={handleCopyCode}
            className="group relative bg-slate-950 border border-cyan-500/50 hover:border-cyan-400 px-4 py-2 rounded-xl text-center transition-all active:scale-95 shadow-md flex flex-col items-center cursor-pointer"
            title="Clique para copiar o código"
          >
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest flex items-center gap-1">
              CÓDIGO {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
            </span>
            <span className="text-2xl font-black font-mono tracking-widest text-cyan-400 group-hover:text-cyan-300">
              {roomCode}
            </span>
          </button>
        </div>
      </header>


      {/* Status Message / Notification */}
      {statusMessage && (
        <div className="z-10 mt-3 p-3 rounded-2xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-200 text-xs font-mono flex items-center gap-2 animate-in fade-in slide-in-from-top-2 shadow-lg">
          <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="z-10 my-4 space-y-4 flex-1 flex flex-col justify-between">
        {/* Lista de Jogadores Conectados */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Jogadores Conectados</span>
            </h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-cyan-400">
              {players.length} participante{players.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {players.map((player) => (
              <div
                key={player.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 p-2.5 rounded-2xl flex items-center gap-2.5 shadow-sm transition-all"
              >
                <div
                  className="w-4 h-4 rounded-full shrink-0 shadow-md border border-slate-950"
                  style={{ backgroundColor: player.color_hex || "#ef4444" }}
                />
                <span className="text-xs font-bold text-slate-200 truncate">
                  {player.player_name}
                </span>
              </div>
            ))}

            {players.length === 0 && (
              <div className="col-span-2 text-center text-xs text-slate-500 py-8 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 space-y-2">
                <Radio className="w-6 h-6 text-slate-600 mx-auto animate-pulse" />
                <p>Aguardando os convidados entrarem pelo celular...</p>
                <p className="text-[10px] font-mono text-cyan-400/80">Código da Sala: {roomCode}</p>
              </div>
            )}
          </div>
        </div>

        {/* Painel de Regras da Partida */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-300 uppercase tracking-wider border-b border-slate-800/80 pb-2">
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <span>Regras da Partida</span>
          </div>

          {/* Quantidade de Impostores */}
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-red-400" />
              Impostores
            </span>
            <div className="flex gap-1.5">
              {[1, 2].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setImpostorCount(num)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                    impostorCount === num
                      ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-600/30 scale-105"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {num} Impostor{num > 1 ? "es" : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Cooldown de Abate */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                Cooldown de Abate
              </span>
              <span className="text-amber-400 font-mono font-extrabold bg-amber-950/60 border border-amber-800/60 px-2.5 py-0.5 rounded-lg text-xs">
                {killCooldown}s
              </span>
            </div>
            <input
              type="range"
              min="15"
              max="60"
              step="5"
              value={killCooldown}
              onChange={(e) => setKillCooldown(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-950 rounded-lg"
            />
          </div>

          {/* Quantidade de Tarefas */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" />
                Tarefas por Tripulante
              </span>
              <span className="text-emerald-400 font-mono font-extrabold bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-lg text-xs">
                {taskCount} Tarefas
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={taskCount}
              onChange={(e) => setTaskCount(Number(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer h-2 bg-slate-950 rounded-lg"
            />
          </div>
        </div>
      </main>

      {/* Botão de Iniciar Partida */}
      <footer className="z-10 pt-1">
        <button
          disabled={isStarting || players.length < 3}
          onClick={handleStartGame}
          className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xl ${
            players.length >= 3
              ? "bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white cursor-pointer shadow-emerald-950/50"
              : "bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed"
          }`}
        >
          {isStarting ? (
            <>
              <CheckCircle2 className="w-5 h-5 animate-spin text-emerald-300" />
              <span>Sorteando Papéis...</span>
            </>
          ) : players.length < 3 ? (
            <>
              <Users className="w-5 h-5 opacity-50" />
              <span>Aguardando Mínimo de 3 Jogadores ({players.length}/3)</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 text-emerald-200 fill-emerald-200" />
              <span>Iniciar Partida</span>
            </>
          )}
        </button>
      </footer>
    </div>
  );
};
