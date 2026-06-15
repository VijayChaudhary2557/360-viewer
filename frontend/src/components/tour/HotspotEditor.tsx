import { MapPin } from "lucide-react";
import type { Hotspot, Room } from "@/lib/tour/rooms";

type Props = {
  hotspot: Hotspot;
  rooms: Room[];
  currentRoomId: string;
  onChangeDestination: (toRoomId: string, label: string) => void;
  onClose: () => void;
};

export function HotspotEditor({
  hotspot,
  rooms,
  currentRoomId,
  onChangeDestination,
  onClose,
}: Props) {
  const others = rooms.filter((r) => r.id !== currentRoomId);

  return (
    <div className="glass fixed bottom-24 left-1/2 z-40 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Edit hotspot
        </div>
        <button
          onClick={onClose}
          className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground transition hover:text-white"
        >
          Done
        </button>
      </div>

      <p className="mb-4 rounded-xl bg-white/5 px-3 py-2.5 text-xs text-muted-foreground">
        Drag the marker anywhere in the scene to reposition it. Click without dragging to change the
        linked scene below.
      </p>

      <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Link to scene
      </div>
      {others.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">No other scenes available.</p>
      ) : (
        <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {others.map((r) => {
            const active = r.id === hotspot.toRoomId;
            return (
              <button
                key={r.id}
                onClick={() => onChangeDestination(r.id, r.name)}
                className={`overflow-hidden rounded-xl border text-left transition ${
                  active
                    ? "border-white bg-white/15 ring-1 ring-white"
                    : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
                }`}
              >
                <div className="aspect-video w-full overflow-hidden bg-black/30">
                  <img src={r.panorama} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <MapPin size={11} className="shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs">{r.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
