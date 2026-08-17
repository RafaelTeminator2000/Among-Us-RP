import { TaskType } from "./database.types";

export interface RoomZone {
  id: string;
  name: string;
  x: number; // Porcentagem (0-100)
  y: number; // Porcentagem (0-100)
  width: number; // Porcentagem (0-100)
  height: number; // Porcentagem (0-100)
  color: string;
}

export interface TaskNode {
  id: string;
  type: TaskType | "EMERGENCY_BUTTON";
  x: number; // Porcentagem (0-100)
  y: number; // Porcentagem (0-100)
  room_name: string;
  token_hash?: string;
}

export interface ScratchMapPlan {
  id: string;
  venueName: string;
  rooms: RoomZone[];
  nodes: TaskNode[];
}

export const DEFAULT_DEMO_MAP: ScratchMapPlan = {
  id: "skeld-phygital-01",
  venueName: "Nave / Templo Central",
  rooms: [
    { id: "r1", name: "Recepção / Entrada", x: 10, y: 10, width: 35, height: 35, color: "#1e293b" },
    { id: "r2", name: "Elétrica & Fiação", x: 55, y: 10, width: 35, height: 35, color: "#334155" },
    { id: "r3", name: "Reator / Coletores", x: 10, y: 55, width: 35, height: 35, color: "#0f172a" },
    { id: "r4", name: "Gerador / Distribuidor", x: 55, y: 55, width: 35, height: 35, color: "#1e1b4b" },
  ],
  nodes: [
    { id: "node-1", type: "EMERGENCY_BUTTON", x: 27.5, y: 27.5, room_name: "Recepção / Entrada" },
    { id: "node-2", type: "WIRE", x: 72.5, y: 27.5, room_name: "Elétrica & Fiação" },
    { id: "node-3", type: "MANIFOLDS", x: 27.5, y: 72.5, room_name: "Reator / Coletores" },
    { id: "node-4", type: "CARD_SWIPE", x: 20, y: 20, room_name: "Recepção / Entrada" },
    { id: "node-5", type: "DISTRIBUTOR", x: 72.5, y: 72.5, room_name: "Gerador / Distribuidor" },
    { id: "node-6", type: "KEYPAD", x: 20, y: 72.5, room_name: "Oxigênio / O2" },
    { id: "node-7", type: "REACTOR", x: 15, y: 80, room_name: "Reator / Iniciar Reator" },
    { id: "node-8", type: "ASTEROIDS", x: 80, y: 20, room_name: "Armas / Asteroides" },
    { id: "node-9", type: "GARBAGE", x: 75, y: 80, room_name: "Armazenamento / Esvaziar Lixo" },
    { id: "node-10", type: "CLEAN_O2", x: 30, y: 65, room_name: "Oxigênio / Limpar Filtro" },
    { id: "node-11", type: "ALIGN_ENGINE", x: 65, y: 15, room_name: "Motores / Alinhamento" },
    { id: "node-12", type: "REFUEL", x: 85, y: 65, room_name: "Motores / Abastecimento" },
  ],
};
