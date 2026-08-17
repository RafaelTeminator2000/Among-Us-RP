export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RoomStatus = "LOBBY" | "PLAYING" | "EMERGENCY_MEETING" | "ENDED";
export type PlayerRole = "CREWMATE" | "IMPOSTOR";
export type PlayerStatus = "ALIVE" | "ELIMINATED";
export type TaskType =
  | "WIRE"
  | "TASK_WIRE"
  | "KEYPAD"
  | "CARD_SWIPE"
  | "MANIFOLDS"
  | "DISTRIBUTOR"
  | "EMERGENCY_BUTTON";

export interface RoomRules {
  kill_cooldown: number;
  discussion_time: number;
  voting_time: number;
  confirm_ejects: boolean;
  task_count: number;
  [key: string]: Json | undefined;
}

export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          code: string;
          host_id: string;
          status: RoomStatus;
          map_data: Json;
          rules: RoomRules;
          is_lights_sabotaged: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          host_id: string;
          status?: RoomStatus;
          map_data?: Json;
          rules?: RoomRules;
          is_lights_sabotaged?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          host_id?: string;
          status?: RoomStatus;
          map_data?: Json;
          rules?: RoomRules;
          is_lights_sabotaged?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      room_players: {
        Row: {
          id: string;
          room_id: string;
          user_id: string | null;
          player_name: string;
          color_hex: string;
          role: PlayerRole | null;
          status: PlayerStatus;
          completed_tasks: Json;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id?: string | null;
          player_name: string;
          color_hex?: string;
          role?: PlayerRole | null;
          status?: PlayerStatus;
          completed_tasks?: Json;
          joined_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string | null;
          player_name?: string;
          color_hex?: string;
          role?: PlayerRole | null;
          status?: PlayerStatus;
          completed_tasks?: Json;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_players_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          }
        ];
      };
      game_events: {
        Row: {
          id: string;
          room_id: string;
          event_type: string;
          player_id: string | null;
          target_id: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          event_type: string;
          player_id?: string | null;
          target_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          event_type?: string;
          player_id?: string | null;
          target_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_events_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          }
        ];
      };
      task_nodes: {
        Row: {
          id: string;
          room_id: string;
          token_hash: string;
          task_type: TaskType;
          room_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          token_hash: string;
          task_type: TaskType;
          room_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          token_hash?: string;
          task_type?: TaskType;
          room_name?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_nodes_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [key: string]: never;
    };
    Functions: {
      get_my_player_role: {
        Args: { p_room_id: string; p_player_id: string };
        Returns: PlayerRole | null;
      };
    };
    Enums: {
      room_status_enum: RoomStatus;
      player_role_enum: PlayerRole;
      player_status_enum: PlayerStatus;
      task_type_enum: TaskType;
    };
  };
}
