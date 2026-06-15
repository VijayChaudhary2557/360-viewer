import type { Room } from "@/lib/tour/rooms";
import { toRelativePanorama, updateTour } from "./tours";

let timer: ReturnType<typeof setTimeout> | null = null;

export function scheduleTourSave(tourId: string, rooms: Room[]) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    updateTour(
      tourId,
      rooms.map((r) => ({
        sceneId: r.id,
        name: r.name,
        description: r.description,
        floor: r.floor,
        panorama: toRelativePanorama(r.panorama),
        hotspots: r.hotspots,
        initialLon: r.initialLon ?? 0,
        initialLat: r.initialLat ?? 0,
        map: r.map,
      })),
    ).catch(() => {});
  }, 800);
}
