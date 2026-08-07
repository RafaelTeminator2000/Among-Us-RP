"use client";

import React from "react";
import { ScratchMapPlan, RoomZone, TaskNode } from "@/types/grid-editor";
import { Map, MapPin, Radio, ShieldAlert } from "lucide-react";

interface GameMapHUDProps {
  mapData: ScratchMapPlan;
  completedTasks: string[]; // IDs das tasks já concluídas pelo jogador
  onSelectTaskNode: (node: TaskNode) => void;
  isSabotaged: boolean;
}

export const GameMapHUD: React.FC<GameMapHUDProps> = ({
  mapData,
  completedTasks,
  onSelectTaskNode,
  isSabotaged,
}) => {
  return (
    <div className="relative w-full max-w-md mx-auto bg-slate-950 p-4 sm:p-5 rounded-3xl border border-slate-800 shadow-2xl font-sans select-none overflow-hidden">
      {/* Glow Background Elements */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Alerta de Sabotagem ativa (Ex: Luzes apagadas) */}
      {isSabotaged && (
        <div className="absolute top-3 inset-x-3 bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white text-xs font-black text-center py-2.5 rounded-xl animate-pulse z-20 uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 border border-red-500">
          <ShieldAlert className="w-4 h-4 animate-bounce" />
          <span>⚡ SABOTAGEM DE LUZ ATIVA!</span>
        </div>
      )}

      {/* Header do Mapa */}
      <header className="flex justify-between items-center mb-4 z-10 relative">
        <div className="space-y-0.5">
          <h2 className="text-sm font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <Map className="w-4 h-4 text-cyan-400" />
            <span>Mapa Tático RP</span>
          </h2>
          <p className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">
            {mapData.venueName || "Local da Partida"}
          </p>
        </div>
        <div className="text-[10px] bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-300 font-mono flex items-center gap-1">
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>Toque no ponto para ir à task</span>
        </div>
      </header>

      {/* Canvas SVG do Mapa Criado pelo Host */}
      <div className={`relative w-full aspect-video bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-inner transition-all duration-300 ${
        isSabotaged ? "brightness-[0.35] filter saturate-[0.8]" : ""
      }`}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Grade de Fundo */}
          <defs>
            <pattern id="game-grid-pattern" width="10%" height="10%" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#334155" strokeWidth="0.15" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#game-grid-pattern)" />

          {/* Renderização das Salas desenhadas pelo Host */}
          {mapData.rooms.map((room: RoomZone) => (
            <g key={room.id}>
              <rect
                x={`${room.x}%`}
                y={`${room.y}%`}
                width={`${room.width}%`}
                height={`${room.height}%`}
                fill={room.color || "#475569"}
                rx="6"
                stroke="#64748b"
                strokeWidth="0.8"
                fillOpacity="0.4"
                className="transition-all hover:fill-opacity-50"
              />
              <text
                x={`${room.x + room.width / 2}%`}
                y={`${room.y + room.height / 2}%`}
                fill="#cbd5e1"
                fontSize="3.5"
                fontWeight="900"
                textAnchor="middle"
                dominantBaseline="middle"
                className="select-none pointer-events-none uppercase tracking-wider font-sans opacity-70"
              >
                {room.name}
              </text>
            </g>
          ))}

          {/* Renderização dos Nós de Tarefas e Botão de Emergência */}
          {mapData.nodes.map((node: TaskNode) => {
            const isCompleted = completedTasks.includes(node.id);
            const isEmergency = node.type === "EMERGENCY_BUTTON";
            
            let color = "#eab308"; // Amarelo (Task Pendente)
            let shadowColor = "rgba(234, 179, 8, 0.5)";
            if (isCompleted) {
              color = "#10b981"; // Verde (Task Concluída)
              shadowColor = "rgba(16, 185, 129, 0.5)";
            }
            if (isEmergency) {
              color = "#ef4444"; // Vermelho (Emergência)
              shadowColor = "rgba(239, 68, 68, 0.5)";
            }

            return (
              <g
                key={node.id}
                onClick={() => !isCompleted && onSelectTaskNode(node)}
                className="cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-95 group"
              >
                {/* Glow/Pulso animado para tarefas pendentes */}
                {!isCompleted && (
                  <circle
                    cx={`${node.x}%`}
                    cy={`${node.y}%`}
                    r={isEmergency ? "6.5" : "5"}
                    fill={color}
                    opacity="0.3"
                    className="animate-ping"
                    style={{ transformOrigin: `${node.x}% ${node.y}%` }}
                  />
                )}

                <circle
                  cx={`${node.x}%`}
                  cy={`${node.y}%`}
                  r={isEmergency ? "5" : "3.5"}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="0.8"
                  style={{ filter: `drop-shadow(0px 0px 4px ${shadowColor})` }}
                  className="transition-colors duration-200"
                />
                
                {/* Ícones internos da Task */}
                <text
                  x={`${node.x}%`}
                  y={`${node.y + (isEmergency ? 1 : 0.8)}%`}
                  fill="#ffffff"
                  fontSize="2.8"
                  fontWeight="950"
                  textAnchor="middle"
                  className="font-bold select-none pointer-events-none"
                >
                  {isEmergency ? "🚨" : isCompleted ? "✓" : "⚡"}
                </text>

                {/* Tooltip do nome da sala flutuante ao pairar */}
                <title>{`${node.room_name} - ${node.type}`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legenda do Mapa */}
      <footer className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-900 text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center">
        <span className="flex items-center justify-center gap-1.5 py-1 bg-slate-900 rounded-xl border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-[0_0_8px_#f59e0b]" /> 
          <span>Pendente</span>
        </span>
        <span className="flex items-center justify-center gap-1.5 py-1 bg-slate-900 rounded-xl border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow-[0_0_8px_#10b981]" /> 
          <span>Concluída</span>
        </span>
        <span className="flex items-center justify-center gap-1.5 py-1 bg-slate-900 rounded-xl border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block shadow-[0_0_8px_#ef4444]" /> 
          <span>Botão</span>
        </span>
      </footer>
    </div>
  );
};
