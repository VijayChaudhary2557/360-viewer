import type { Room } from "@/lib/tour/rooms";

type Props = {
  rooms: Room[];
  currentRoomId: string;
  onSelect: (toRoomId: string, label: string) => void;
  onCancel: () => void;
};

export function HotspotPicker({ rooms, currentRoomId, onSelect, onCancel }: Props) {
  const others = rooms.filter((r) => r.id !== currentRoomId);

  return (
    <div className="glass fixed bottom-24 left-1/2 z-40 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Link hotspot to scene
        </div>
        <button
          onClick={onCancel}
          className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground transition hover:text-white"
        >
          Cancel
        </button>
      </div>
      {others.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">Upload more scenes to link hotspots.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {others.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r.id, r.name)}
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm transition hover:scale-[1.02] hover:bg-white active:scale-[0.98]"
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
