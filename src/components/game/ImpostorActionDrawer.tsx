"use client";

import React, { useState, useEffect } from "react";
import { ChevronUp, ChevronDown, Zap, Flame, Wind, Radio, Atom, X, AlertTriangle, Clock } from "lucide-react";
import { ImpostorKillButton } from "@/components/game/ImpostorKillButton";
import { PlayerGameState } from "@/types/game";

export type SabotageType = "LIGHTS" | "REACTOR" | "O2" | "COMMS";

interface SabotageOption {
  id: SabotageType;
  title: string;
  room: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
  badgeClass: string;
  isCritical: boolean;
  penaltySeconds: number;
}

const SABOTAGE_OPTIONS: SabotageOption[] = [
  {
    id: "LIGHTS",
    title: "Apagar Luzes",
    room: "Elétrica / Gerador",
    description: "Corta a energia e reduz drasticamente a visão dos tripulantes.",
    icon: Zap,
    colorClass: "from-amber-600 to-yellow-600 border-amber-500/50 text-amber-300",
    badgeClass: "bg-amber-950/80 text-amber-400 border-amber-700/50",
    isCritical: false,
    penaltySeconds: 25,
  },
  {
    id: "COMMS",
    title: "Comunicações",
    room: "Comunicações",
    description: "Oculta o rádio de reportar corpos (obriga uso do Botão Central).",
    icon: Radio,
    colorClass: "from-purple-700 to-indigo-600 border-purple-500/50 text-purple-300",
    badgeClass: "bg-purple-950/80 text-purple-400 border-purple-700/50",
    isCritical: false,
    penaltySeconds: 25,
  },
  {
    id: "REACTOR",
    title: "Fusão do Reator",
    room: "Reator Nuclear",
    description: "Inicia contagem fatal de 45s no núcleo da nave (Sirene ativa).",
    icon: Atom,
    colorClass: "from-rose-700 to-red-600 border-rose-500/50 text-rose-300",
    badgeClass: "bg-rose-950/80 text-rose-400 border-rose-700/50",
    isCritical: true,
    penaltySeconds: 40,
  },
  {
    id: "O2",
    title: "Falha de Oxigênio",
    room: "Sala de O2",
    description: "Interrompe os filtros e esgota o oxigênio da tripulação em 45s.",
    icon: Wind,
    colorClass: "from-cyan-600 to-teal-600 border-cyan-500/50 text-cyan-300",
    badgeClass: "bg-cyan-950/80 text-cyan-400 border-cyan-700/50",
    isCritical: true,
    penaltySeconds: 40,
  },
];

export interface ImpostorActionDrawerProps {
  roomId: string;
  roomCode?: string;
  impostorId: string;
  players: PlayerGameState[];
  activeSabotages?: SabotageType[];
  cooldownSeconds?: number;
  reactorUses?: number;
  o2Uses?: number;
  accumulatedPenalty?: number;
  baseCooldown?: number;
  onTriggerSabotage: (type: SabotageType) => void;
  sendBroadcast?: (event: string, payload: any) => Promise<any>;
}

export const ImpostorActionDrawer: React.FC<ImpostorActionDrawerProps> = ({
  roomId,
  roomCode,
  impostorId,
  players,
  activeSabotages = [],
  cooldownSeconds,
  reactorUses = 0,
  o2Uses = 0,
  accumulatedPenalty = 0,
  baseCooldown = 60,
  onTriggerSabotage,
  sendBroadcast,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [showSabotageModal, setShowSabotageModal] = useState<boolean>(false);
  const [internalCooldown, setInternalCooldown] = useState<number>(() => {
    if (typeof cooldownSeconds === "number" && cooldownSeconds > 0) return cooldownSeconds;
    return baseCooldown || 60;
  });

  // Sincronizar sempre que a prop externa cooldownSeconds for alterada
  useEffect(() => {
    if (typeof cooldownSeconds === "number") {
      setInternalCooldown(cooldownSeconds);
    }
  }, [cooldownSeconds]);

  // Contagem regressiva autônoma contínua do cooldown de sabotagem (não trava quando há sabotagem ativa)
  useEffect(() => {
    if (internalCooldown <= 0) return;

    const timer = setInterval(() => {
      setInternalCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [internalCooldown]);

  const currentCooldown = internalCooldown;
  const isOnCooldown = currentCooldown > 0;

  const handleSelectSabotage = (type: SabotageType) => {
    if (activeSabotages.includes(type)) return;
    if (type === "REACTOR" && reactorUses >= 2) return;
    if (type === "O2" && o2Uses >= 2) return;
    if (currentCooldown > 0) return;

    onTriggerSabotage(type);
    setShowSabotageModal(false);
    setIsOpen(false);
  };

  return (
    <>
      {/* Alça/Aba sutil e discreta para abrir a gaveta (Visível apenas para o Impostor) */}
      {!isOpen && (
        <div className="w-full flex justify-center pb-1">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            title="Ações Secretas"
            aria-label="Abrir Ações"
            className="group flex flex-col items-center justify-center pt-1.5 pb-1 px-8 rounded-t-2xl bg-slate-900/90 hover:bg-slate-800 border-t border-x border-slate-700/80 shadow-md backdrop-blur-md transition-all active:scale-95 cursor-pointer"
          >
            <div className="w-8 h-1 rounded-full bg-slate-600 group-hover:bg-slate-400 transition-colors" />
            <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-colors -mt-0.5" />
          </button>
        </div>
      )}

      {/* Gaveta Deslizante Aberta */}
      {isOpen && (
        <>
          {/* Backdrop para fechar ao clicar fora */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => {
              setIsOpen(false);
              setShowSabotageModal(false);
            }}
          />

          {/* Conteúdo da Gaveta */}
          <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto z-40 bg-[#090d16] border-t-2 border-x border-slate-800 rounded-t-3xl p-5 pb-8 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200 select-none">
            {/* Cabeçalho da Gaveta */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span
                  style={{ fontFamily: "var(--font-anton), Anton, sans-serif" }}
                  className="text-sm uppercase tracking-wider text-slate-200"
                >
                  Ações de Impostor
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowSabotageModal(false);
                }}
                className="p-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Ações: Sabotagem e Abate */}
            <div className="flex flex-col items-center gap-4 pt-1">
              {/* Botão Principal de Sabotar com Feedback de Cooldown */}
              {isOnCooldown ? (
                <div className="w-full h-12 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center px-4 shadow-md relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-amber-500/15 transition-all duration-1000"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, 100 - (currentCooldown / Math.max(1, baseCooldown + accumulatedPenalty)) * 100)
                      )}%`,
                    }}
                  />
                  <div className="flex items-center gap-2 z-10 text-slate-300 text-xs font-mono font-bold">
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    <span>RECARGA DE SABOTAGEM:</span>
                    <span className="text-amber-300 text-sm font-black">{currentCooldown}s</span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSabotageModal(true)}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:via-orange-500 hover:to-amber-600 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 border border-amber-400/30 transition active:scale-98 cursor-pointer"
                >
                  <Flame className="w-4 h-4 fill-white" />
                  <span>
                    SABOTAR {activeSabotages.length > 0 ? `(${activeSabotages.length} ATIVA${activeSabotages.length > 1 ? "S" : ""})` : ""}
                  </span>
                </button>
              )}

              {/* Botão de Abate */}
              <div className="pt-2">
                <ImpostorKillButton
                  roomId={roomId}
                  roomCode={roomCode}
                  impostorId={impostorId}
                  players={players}
                  sendBroadcast={sendBroadcast}
                  onKillExecuted={() => setIsOpen(false)}
                />
              </div>
            </div>

            {/* Botão de Recolher */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setShowSabotageModal(false);
              }}
              className="w-full py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono font-bold uppercase transition active:scale-98 cursor-pointer text-center"
            >
              Fechar Painel
            </button>
          </div>
        </>
      )}

      {/* Modal de Seleção do Tipo de Sabotagem com Suporte a Sobreposição */}
      {showSabotageModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 p-4 flex items-center justify-center max-w-sm mx-auto animate-in fade-in select-none">
          <div className="w-full bg-[#0b1120] border-2 border-amber-600/70 rounded-3xl p-5 space-y-4 shadow-[0_0_40px_rgba(245,158,11,0.3)]">
            <header className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Flame className="w-5 h-5 fill-amber-400" />
                <div>
                  <h3
                    style={{ fontFamily: "var(--font-anton), Anton, sans-serif" }}
                    className="text-lg uppercase tracking-wider text-white"
                  >
                    ESCOLHA A SABOTAGEM
                  </h3>
                  <span className="text-[9px] font-mono text-slate-400 block -mt-1">
                    Recarga progressiva (+40s críticas / +25s mecânicas)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSabotageModal(false)}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Lista de Sabotagens */}
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {SABOTAGE_OPTIONS.map((sabotage) => {
                const Icon = sabotage.icon;
                const isAlreadyActive = activeSabotages.includes(sabotage.id);
                const uses = sabotage.id === "REACTOR" ? reactorUses : sabotage.id === "O2" ? o2Uses : 0;
                const isExhausted = sabotage.isCritical && uses >= 2;
                const isDisabled = isAlreadyActive || isExhausted || isOnCooldown;

                return (
                  <button
                    key={sabotage.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleSelectSabotage(sabotage.id)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all active:scale-98 flex items-center justify-between gap-3 ${
                      isDisabled
                        ? "bg-slate-950/60 border-slate-800 opacity-60 cursor-not-allowed"
                        : "bg-slate-900/90 hover:bg-slate-850 border-slate-800 hover:border-amber-500/60 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl bg-gradient-to-br border shadow-sm shrink-0 mt-0.5 ${sabotage.colorClass}`}
                      >
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-slate-100 truncate">
                            {sabotage.title}
                          </span>
                          {sabotage.isCritical ? (
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${
                                isExhausted
                                  ? "bg-red-950 text-red-400 border-red-800"
                                  : "bg-rose-950/80 text-rose-300 border-rose-800/60"
                              }`}
                            >
                              {isExhausted ? "Esgotado (2/2)" : `Uso: ${uses}/2`}
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border bg-slate-950 text-slate-400 border-slate-800">
                              Ilimitado
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">
                          {sabotage.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-mono text-slate-500">
                            📍 {sabotage.room}
                          </span>
                          <span
                            className={`text-[9px] font-mono font-bold ${
                              sabotage.isCritical ? "text-rose-400" : "text-amber-400"
                            }`}
                          >
                            +{sabotage.penaltySeconds}s recarga
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-1 rounded-lg border uppercase shrink-0 ${
                        isExhausted
                          ? "bg-red-950 text-red-500 border-red-900"
                          : isAlreadyActive
                          ? "bg-amber-950/80 text-amber-400 border-amber-700/60"
                          : sabotage.badgeClass
                      }`}
                    >
                      {isExhausted ? "Esgotado" : isAlreadyActive ? "Em Andamento" : "Acionar"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Resumo da Progressão */}
            <div className="p-2.5 bg-slate-950/90 rounded-2xl border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-between">
              <span>Próxima Recarga:</span>
              <span className="text-amber-300 font-bold">
                {baseCooldown + accumulatedPenalty}s (Base {baseCooldown}s + {accumulatedPenalty}s)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowSabotageModal(false)}
              className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono font-bold uppercase transition cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
};


