import { PlayerRole, TaskType, RoomStatus, PlayerStatus } from "./database.types";

export type { PlayerRole, TaskType, RoomStatus, PlayerStatus };

export type WireColor = "red" | "blue" | "yellow" | "pink";

export interface WireNode {
  id: string;
  color: WireColor;
}

export interface WireConnection {
  color: WireColor;
  connectedToColor: WireColor | null;
}

export interface Task {
  id: string;
  code: string;
  title: string;
  location: string;
  type: "qr" | "wires" | "download" | "swipe";
  is_completed: boolean;
}

export interface TaskNodeState {
  id: string;
  room_id: string;
  token_hash: string;
  task_type: TaskType;
  room_name: string;
}

export interface PlayerGameState {
  id: string;
  nickname: string;
  color: string; // Hex ou CSS class (ex: #ef4444, #3b82f6)
  role: PlayerRole | null;
  is_alive: boolean;
  is_host: boolean;
  completed_tasks: number;
  total_tasks: number;
  has_voted: boolean;
  voted_for_id: string | null; // player_id ou 'skip' ou null
}

export interface VoteSummary {
  voterId: string;
  targetId: string | "skip";
}

export interface VotingResult {
  ejectedPlayer: PlayerGameState | null;
  isTie: boolean;
  isSkip: boolean;
  tally: Record<string, number>;
}
