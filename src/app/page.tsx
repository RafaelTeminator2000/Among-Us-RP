"use client";

import React, { useState } from "react";
import { TaskQrReader } from "@/components/minigames/TaskQrReader";
import { WireMinigame } from "@/components/minigames/WireMinigame";
import { EliminationScreen } from "@/components/minigames/EliminationScreen";
import { HostDashboard } from "@/components/HostDashboard";
import { GuestJoinScreen } from "@/components/GuestJoinScreen";
import { GameMapHUD } from "@/components/GameMapHUD";
import { QRScannerModal } from "@/components/tasks/QRScannerModal";
import { ReportBodyScanner } from "@/components/ReportBodyScanner";
import { ImpostorKillButton } from "@/components/game/ImpostorKillButton";
import { VotingSessionScreen } from "@/components/game/VotingSessionScreen";
import { DEFAULT_DEMO_MAP } from "@/types/grid-editor";
import { PlayerGameState, VotingResult } from "@/types/game";
import { QrCode, Zap, Vote, Skull, Radio, Play, Sparkles, ArrowLeft, CheckCircle, Crown, UserPlus, Map, Scan, Megaphone } from "lucide-react";

const MOCK_PLAYERS: PlayerGameState[] = [
  {
    id: "p1",
    nickname: "Vermelho",
    color: "#ef4444",
    role: "CREWMATE",
    is_alive: true,
    is_host: true,
    completed_tasks: 3,
    total_tasks: 4,
    has_voted: false,
    voted_for_id: null,
  },
  {
    id: "p2",
    nickname: "Azul",
    color: "#3b82f6",
    role: "IMPOSTOR",
    is_alive: true,
    is_host: false,
    completed_tasks: 2,
    total_tasks: 4,
    has_voted: true,
    voted_for_id: "p3",
  },
  {
    id: "p3",
    nickname: "Amarelo",
    color: "#eab308",
    role: "CREWMATE",
    is_alive: true,
    is_host: false,
    completed_tasks: 4,
    total_tasks: 4,
    has_voted: false,
    voted_for_id: null,
  },
  {
    id: "p4",
    nickname: "Verde",
    color: "#22c55e",
    role: "CREWMATE",
    is_alive: false, // Morto
    is_host: false,
    completed_tasks: 1, // Descartado no cálculo de vivos
    total_tasks: 4,
    has_voted: false,
    voted_for_id: null,
  },
  {
    id: "p5",
    nickname: "Rosa",
    color: "#ec4899",
    role: "CREWMATE",
    is_alive: true,
    is_host: false,
    completed_tasks: 1,
    total_tasks: 4,
    has_voted: true,
    voted_for_id: "skip",
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<"menu" | "qr" | "wires" | "elimination" | "host" | "join" | "map" | "scanner" | "report" | "kill" | "votingSession">("menu");
  const [lastNotification, setLastNotification] = useState<string | null>(null);
  const [isSabotaged, setIsSabotaged] = useState<boolean>(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>(["node-2"]); // Começa com fiação completa

  const notify = (msg: string) => {
    setLastNotification(msg);
    setTimeout(() => setLastNotification(null), 4000);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-3 sm:p-6 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-md text-center space-y-1.5 z-10 pt-2 pb-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/50 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
          <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
          <span>Agente 2 — Módulo Phygital & Minigames</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-red-500 via-slate-100 to-cyan-400 bg-clip-text text-transparent">
          AMONG US RP
        </h1>
      </header>

      {/* Toast Notification */}
      {lastNotification && (
        <div className="fixed top-4 z-50 bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-xs font-mono px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{lastNotification}</span>
        </div>
      )}

      {/* Main View Area */}
      <div className="w-full max-w-md my-auto z-10 py-2">
        {activeTab === "menu" && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-3xl text-center space-y-1">
              <h2 className="font-bold text-sm text-slate-200">Demonstração de Componentes</h2>
              <p className="text-xs text-slate-400">
                Selecione abaixo o componente do PWA Mobile para testar a interatividade:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Button 0.1: Guest Join Screen */}
              <button
                onClick={() => setActiveTab("join")}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-cyan-950/60 to-slate-900 border border-cyan-500/40 hover:border-cyan-400 flex items-center justify-between text-left transition-all active:scale-[0.98] group shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                    <UserPlus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-cyan-300">Entrada do Convidado (Guest Join)</h3>
                    <p className="text-xs text-slate-400">Código da Sala + Apelido + Cor do Traje</p>
                  </div>
                </div>
                <Play className="w-5 h-5 text-cyan-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Button 0.2: Host Dashboard */}
              <button
                onClick={() => setActiveTab("host")}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/40 hover:border-emerald-400 flex items-center justify-between text-left transition-all active:scale-[0.98] group shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                    <Crown className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-emerald-300">Painel do Host (Host Studio)</h3>
                    <p className="text-xs text-slate-400">Lobby em tempo real + Regras + Sorteio</p>
                  </div>
                </div>
                <Play className="w-5 h-5 text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Button 0.3: GameMapHUD */}
              <button
                onClick={() => setActiveTab("map")}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-500/40 hover:border-blue-400 flex items-center justify-between text-left transition-all active:scale-[0.98] group shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                    <Map className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-blue-300">Mapa Tático & Legenda</h3>
                    <p className="text-xs text-slate-400">Salas reais 2D + Nodes de tasks + Sabotagem</p>
                  </div>
                </div>
                <Play className="w-5 h-5 text-blue-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Button 0.4: QRScannerModal */}
              <button
                onClick={() => setActiveTab("scanner")}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-teal-950/60 to-slate-900 border border-teal-500/40 hover:border-teal-400 flex items-center justify-between text-left transition-all active:scale-[0.98] group shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
                    <Scan className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-teal-300">Leitor QR (Câmara PWA)</h3>
                    <p className="text-xs text-slate-400">Abrir câmera integrada via html5-qrcode</p>
                  </div>
                </div>
                <Play className="w-5 h-5 text-teal-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Button 1: QR Reader */}
              <button
                onClick={() => setActiveTab("qr")}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 flex items-center justify-between text-left transition-all active:scale-[0.98] group shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                    <QrCode className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-200">1. Leitor de QR Code (Antigo)</h3>
                    <p className="text-xs text-slate-400">Escaneamento phygital + Entrada manual</p>
                  </div>
                </div>
                <Play className="w-5 h-5 text-cyan-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Button 2: Wire Minigame */}
              <button
                onClick={() => setActiveTab("wires")}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-500/40 hover:border-amber-400 flex items-center justify-between text-left transition-all active:scale-[0.98] group shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                    <Zap className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-amber-300">2. Minigame Conectar Fios</h3>
                    <p className="text-xs text-slate-400">Conexão de fios elétricos (Touch & Mouse)</p>
                  </div>
                </div>
                <Play className="w-5 h-5 text-amber-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Button 3: Elimination Screen */}
              <button
                onClick={() => setActiveTab("elimination")}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 to-slate-900 border border-purple-500/40 hover:border-purple-400 flex items-center justify-between text-left transition-all active:scale-[0.98] group shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
                    <Skull className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-purple-300">3. Eliminação Instantânea</h3>
                    <p className="text-xs text-slate-400">Sem fantasmas + Progresso recalculado (Vivos)</p>
                  </div>
                </div>
                <Play className="w-5 h-5 text-purple-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Button 4: Report Body Scanner */}
              <button
                onClick={() => setActiveTab("report")}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-rose-950/60 to-slate-900 border border-rose-500/40 hover:border-rose-400 flex items-center justify-between text-left transition-all active:scale-[0.98] group shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                    <Megaphone className="w-6 h-6 group-hover:scale-110 transition-transform animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-rose-300">4. Reportar Corpo (QR Traseiro)</h3>
                    <p className="text-xs text-slate-400">Scan do crachá das costas + Broadcast Realtime</p>
                  </div>
                </div>
                <Play className="w-5 h-5 text-rose-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Button 5: Impostor Kill Button */}
              <button
                onClick={() => setActiveTab("kill")}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-red-950/80 to-slate-900 border border-red-500/50 hover:border-red-400 flex items-center justify-between text-left transition-all active:scale-[0.98] group shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-500/30 text-red-400 rounded-xl border border-red-500/40">
                    <Skull className="w-6 h-6 group-hover:scale-110 transition-transform animate-bounce" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-red-300">5. Abate do Impostor (Botão & Cooldown)</h3>
                    <p className="text-xs text-slate-400">Cooldown + Modal de alvos + Broadcast de vibração</p>
                  </div>
                </div>
                <Play className="w-5 h-5 text-red-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Button 6: Integrated Voting Session Screen */}
              <button
                onClick={() => setActiveTab("votingSession")}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-cyan-950/80 to-slate-900 border border-cyan-500/50 hover:border-cyan-400 flex items-center justify-between text-left transition-all active:scale-[0.98] group shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan-500/30 text-cyan-400 rounded-xl border border-cyan-500/40">
                    <Vote className="w-6 h-6 group-hover:scale-110 transition-transform animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-cyan-300">6. Reunião & Votação Integrada</h3>
                    <p className="text-xs text-slate-400">Tempo limite + Voto no Supabase + Sync Realtime</p>
                  </div>
                </div>
                <Play className="w-5 h-5 text-cyan-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>
        )}

        {/* Render Active Component */}
        {activeTab === "join" && (
          <GuestJoinScreen
            onSuccessfullyJoined={(roomId, playerId) => {
              notify(`Conectado à sala ${roomId} com ID ${playerId.slice(0, 8)}!`);
              setActiveTab("menu");
            }}
          />
        )}

        {activeTab === "scanner" && (
          <QRScannerModal
            onScanSuccess={(qrToken) => {
              notify(`QR Token Escaneado: ${qrToken}`);
              setActiveTab("menu");
            }}
            onClose={() => setActiveTab("menu")}
          />
        )}

        {activeTab === "map" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded-2xl">
              <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">
                Controles de Teste (Sabotagem)
              </span>
              <button
                onClick={() => setIsSabotaged(!isSabotaged)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                  isSabotaged
                    ? "bg-red-600 text-white animate-pulse"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {isSabotaged ? "Desativar Sabotagem ⚡" : "Simular Sabotagem (Luz) 🚨"}
              </button>
            </div>

            <GameMapHUD
              mapData={DEFAULT_DEMO_MAP}
              completedTasks={completedTasks}
              isSabotaged={isSabotaged}
              onSelectTaskNode={(node) => {
                notify(`Task selecionada: ${node.room_name} (${node.type})`);
                if (!completedTasks.includes(node.id)) {
                  setCompletedTasks((prev) => [...prev, node.id]);
                }
              }}
            />

            <div className="text-center">
              <button
                onClick={() => setCompletedTasks(["node-2"])}
                className="text-[10px] text-slate-500 hover:text-slate-400 underline font-mono"
              >
                Resetar progresso de tasks do mapa
              </button>
            </div>
          </div>
        )}

        {activeTab === "host" && (
          <HostDashboard
            roomId="demo-room-id"
            roomCode="A7X9"
            initialPlayers={MOCK_PLAYERS.map((p) => ({
              id: p.id,
              room_id: "demo-room-id",
              player_name: p.nickname,
              color_hex: p.color,
              status: p.is_alive ? "ALIVE" : "ELIMINATED",
              role: p.role,
            }))}
            onGameStarted={() => {
              notify("Partida Iniciada via Host Studio!");
              setActiveTab("menu");
            }}
          />
        )}

        {activeTab === "qr" && (
          <TaskQrReader
            expectedTaskTitle="REPARAR NAVEGADOR (PHYSICAL)"
            expectedTaskLocation="Navegação - Sala 02"
            onScanSuccess={(code) => {
              notify(`QR Code Lido com Sucesso: ${code}`);
              setActiveTab("menu");
            }}
            onCancel={() => setActiveTab("menu")}
          />
        )}

        {activeTab === "wires" && (
          <WireMinigame
            onComplete={() => {
              notify("Minigame de Fios concluído com Sucesso!");
              setActiveTab("menu");
            }}
            onCancel={() => setActiveTab("menu")}
          />
        )}

        {activeTab === "elimination" && (
          <EliminationScreen
            eliminatedPlayer={MOCK_PLAYERS[3]} // Verde (Morto)
            players={MOCK_PLAYERS}
            onReturnToLobby={() => setActiveTab("menu")}
          />
        )}

        {activeTab === "report" && (
          <ReportBodyScanner
            roomId="demo-room-id"
            reporterId="p1"
            onBodyReported={(deadPlayerName) => {
              notify(`🚨 ALARME: Corpo de ${deadPlayerName} reportado! Reunião convocada.`);
              setActiveTab("menu");
            }}
          />
        )}

        {activeTab === "kill" && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-center space-y-6 max-w-sm mx-auto shadow-2xl">
            <div>
              <h3 className="text-sm font-black text-red-500 uppercase tracking-widest">
                HUD do Impostor — Módulo de Abate
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Toque no ombro da vítima na vida real e acione o botão abaixo para eliminá-la no sistema.
              </p>
            </div>

            <ImpostorKillButton
              roomId="demo-room-id"
              impostorId="p2" // Impostor Azul na demonstração
              initialCooldownSeconds={5} // 5s para facilitar testes no demo
              onKillExecuted={(victimId, victimName) => {
                notify(`🔪 ABATE CONFIRMADO: ${victimName} foi eliminado(a)!`);
              }}
            />
          </div>
        )}

        {activeTab === "votingSession" && (
          <VotingSessionScreen
            roomId="demo-room-id"
            currentPlayerId="p1"
            reporterName="Vermelho"
            votingTimeSeconds={30}
            onVotingEnded={() => {
              notify("Sessão de Votação Encerrada!");
              setActiveTab("menu");
            }}
          />
        )}

        {/* Back to menu button if in component */}
        {activeTab !== "menu" && (
          <div className="mt-3 text-center">
            <button
              onClick={() => setActiveTab("menu")}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 bg-slate-900 rounded-xl border border-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Menu Demo</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="w-full max-w-md text-center text-xs text-slate-500 z-10 pb-2">
        <p>Among Us RP Presencial &copy; {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}
