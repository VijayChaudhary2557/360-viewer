import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { Room } from "@/lib/tour/rooms";

type Props = {
  room: Room | null;
  onClose: () => void;
};

export function InfoModal({ room, onClose }: Props) {
  return (
    <AnimatePresence>
      {room && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="glass relative w-full max-w-md overflow-hidden rounded-2xl"
          >
            <button
              onClick={onClose}
              className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg bg-white/10 transition hover:bg-white/20"
            >
              <X size={14} />
            </button>
            <img src={room.panorama} alt={room.name} className="h-48 w-full object-cover" />
            <div className="p-6">
              <h2 className="text-2xl font-light tracking-tight">{room.name}</h2>
              {room.description ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{room.description}</p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No description for this scene yet.</p>
              )}
              <div className="mt-6 rounded-xl bg-white/5 p-4 text-center">
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Hotspots</div>
                <div className="mt-1 text-lg font-light">{room.hotspots.length}</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
