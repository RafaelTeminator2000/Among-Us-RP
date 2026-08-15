export interface MapRoom {
  id: string;
  name: string;
  x: number; // Percentual 0-100
  y: number; // Percentual 0-100
  width: number; // Percentual 0-100
  height: number; // Percentual 0-100
  color: string;
}

export interface MapTask {
  id: string;
  roomId: string;
  pointToken: string; // Ex: POINT_01, POINT_02, etc.
  x: number; // Percentual 0-100
  y: number; // Percentual 0-100
}

export interface MapData {
  rooms: MapRoom[];
  tasks: MapTask[];
}
