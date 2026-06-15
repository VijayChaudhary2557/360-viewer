export type Hotspot = {
  toRoomId: string;
  label: string;
  lon: number;
  lat: number;
};

export type Room = {
  id: string;
  name: string;
  description: string;
  floor: number;
  panorama: string;
  hotspots: Hotspot[];
  initialLon?: number;
  initialLat?: number;
  map: { x: number; y: number; w: number; h: number };
};
