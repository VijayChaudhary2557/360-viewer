import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Search, MapPin, Plus } from "lucide-react";
import type { Room } from "@/lib/tour/rooms";

type Props = {
  rooms: Room[];
  currentRoomId: string;
  visitedCount: number;
  onSelectRoom: (id: string) => void;
  title?: string;
  subtitle?: string;
  onOpenBuilder?: () => void;
};

export function Sidebar({
  rooms,
  currentRoomId,
  visitedCount,
  onSelectRoom,
  title = "Virtual Tour",
  subtitle = "Your scenes",
  onOpenBuilder,
}: Props) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");

  const filtered = rooms.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()));
  const progress = rooms.length === 0 ? 0 : (visitedCount / rooms.length) * 100;

  return (
    <motion.aside
      animate={{ width: open ? 320 : 64 }}
      transition={{ type: "spring", stiffness: 240, damping: 28 }}
      className="glass fixed left-4 top-4 bottom-4 z-30 flex flex-col overflow-hidden rounded-2xl"
    >
      <div className="flex items-center justify-between p-4">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex items-center gap-3"
            >
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-sm font-light tracking-[0.2em]">
                {title.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{title}</div>
                <div className="truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {subtitle}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setOpen(!open)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 transition hover:bg-white/10"
        >
          {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col overflow-hidden px-4 pb-4"
          >
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search scenes"
                className="w-full rounded-xl bg-white/5 py-2 pl-9 pr-3 text-sm outline-none ring-0 transition placeholder:text-muted-foreground/60 focus:bg-white/10"
              />
            </div>

            <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Scenes · {filtered.length}
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto pr-1">
              {filtered.map((r) => {
                const active = r.id === currentRoomId;
                return (
                  <button
                    key={r.id}
                    onClick={() => onSelectRoom(r.id)}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      active ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <MapPin
                      size={14}
                      className={active ? "text-white" : "text-muted-foreground group-hover:text-white"}
                    />
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-sm ${active ? "text-white" : "text-foreground/90"}`}>
                        {r.name}
                      </div>
                      <div className="truncate text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                        {r.hotspots.length} hotspot{r.hotspots.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 border-t border-white/5 pt-4">
              <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <span>Tour progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className="h-full bg-white"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
              {onOpenBuilder && (
                <button
                  onClick={onOpenBuilder}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.03] py-2.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition hover:bg-white/10 hover:text-white"
                >
                  <Plus size={12} /> Add your tour
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
