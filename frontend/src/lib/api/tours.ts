import type { Room } from "@/lib/tour/rooms";

// Force recompile to pick up .env changes
const API = import.meta.env.VITE_API_URL ?? "http://localhost:5007/api";

export type SavedTour = {
  _id: string;
  title: string;
  scenes: Array<{
    sceneId: string;
    name: string;
    description: string;
    floor: number;
    panorama: string;
    hotspots: Room["hotspots"];
    initialLon?: number;
    initialLat?: number;
    map: Room["map"];
  }>;
  createdAt: string;
  updatedAt: string;
};

export function tourToRooms(tour: SavedTour, baseUrl = API.replace(/\/api$/, "")): Room[] {
  return tour.scenes.map((s) => ({
    id: s.sceneId,
    name: s.name,
    description: s.description,
    floor: s.floor,
    panorama: s.panorama.startsWith("http") ? s.panorama : `${baseUrl}${s.panorama}`,
    hotspots: s.hotspots,
    initialLon: s.initialLon ?? 0,
    initialLat: s.initialLat ?? 0,
    map: s.map,
  }));
}

export async function createTour(
  title: string,
  rooms: Array<Room & { file?: File }>,
): Promise<SavedTour> {
  const form = new FormData();
  form.append("title", title);
  form.append(
    "scenes",
    JSON.stringify(
      rooms.map((r) => ({
        sceneId: r.id,
        name: r.name,
        description: r.description,
        floor: r.floor,
        hotspots: r.hotspots,
        initialLon: r.initialLon ?? 0,
        initialLat: r.initialLat ?? 0,
        map: r.map,
      })),
    ),
  );
  for (const room of rooms) {
    if (!room.file) throw new Error(`Missing file for scene "${room.name}"`);
    form.append("panoramas", room.file);
  }

  const res = await fetch(`${API}/tours`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to save tour");
  }
  return res.json();
}

export async function getTour(id: string): Promise<SavedTour> {
  const res = await fetch(`${API}/tours/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Tour not found");
  }
  return res.json();
}

export async function updateTour(id: string, scenes: SavedTour["scenes"]): Promise<SavedTour> {
  const res = await fetch(`${API}/tours/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to update tour");
  }
  return res.json();
}

export function toRelativePanorama(url: string): string {
  if (url.startsWith("/api/")) return url;
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export async function uploadPanorama(file: File): Promise<string> {
  const form = new FormData();
  form.append("panorama", file);
  const res = await fetch(`${API}/tours/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Upload failed");
  }
  const data = await res.json();
  const base = API.replace(/\/api$/, "");
  return data.url.startsWith("http") ? data.url : `${base}${data.url}`;
}
