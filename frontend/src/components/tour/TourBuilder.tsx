import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, Trash2, Check, Image as ImageIcon, Loader2 } from "lucide-react";
import type { Room, Hotspot } from "@/lib/tour/rooms";
import { createTour } from "@/lib/api/tours";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (rooms: Room[], tourId: string) => void;
  initial?: Room[];
};

type DraftRoom = {
  id: string;
  name: string;
  description: string;
  floor: number;
  panorama: string;
  hotspots: Hotspot[];
  file?: File;
};

const uid = () => Math.random().toString(36).slice(2, 9);
const MAX_SCENES = 100;

export function TourBuilder({ open, onClose, onSave, initial }: Props) {
  const [rooms, setRooms] = useState<DraftRoom[]>(initial?.map((r) => ({ ...r })) ?? []);
  const [activeId, setActiveId] = useState<string | null>(initial?.[0]?.id ?? null);
  const [title, setTitle] = useState("My Virtual Tour");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = rooms.find((r) => r.id === activeId) ?? null;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_SCENES - rooms.length;
    if (remaining <= 0) {
      setError(`Maximum ${MAX_SCENES} panoramas per tour.`);
      return;
    }
    const picked = Array.from(files).slice(0, remaining);
    if (picked.length < files.length) {
      setError(`Only ${remaining} more image${remaining === 1 ? "" : "s"} can be added (max ${MAX_SCENES}).`);
    } else {
      setError(null);
    }
    const next: DraftRoom[] = [];
    picked.forEach((f, i) => {
      const url = URL.createObjectURL(f);
      next.push({
        id: uid(),
        name: f.name.replace(/\.[^.]+$/, "") || `Scene ${rooms.length + i + 1}`,
        description: "",
        floor: 1,
        panorama: url,
        hotspots: [],
        initialLon: 0,
        initialLat: 0,
        file: f,
      });
    });
    const merged = [...rooms, ...next];
    setRooms(merged);
    if (!activeId && next[0]) setActiveId(next[0].id);
  };

  const updateActive = (patch: Partial<DraftRoom>) => {
    if (!active) return;
    setRooms((rs) => rs.map((r) => (r.id === active.id ? { ...r, ...patch } : r)));
  };

  const removeRoom = (id: string) => {
    setRooms((rs) => {
      const next = rs.filter((r) => r.id !== id).map((r) => ({
        ...r,
        hotspots: r.hotspots.filter((h) => h.toRoomId !== id),
      }));
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  const handleSave = async () => {
    if (rooms.length === 0) {
      alert("Upload at least one 360° image.");
      return;
    }
    const missing = rooms.filter((r) => !r.file);
    if (missing.length > 0) {
      alert("Re-upload panoramas for scenes that were loaded from a saved tour.");
      return;
    }

    const finalRooms = rooms.map((r, i) => ({
      ...r,
      map: { x: (i % 3) * 33 + 2, y: Math.floor(i / 3) * 32 + 4, w: 28, h: 26 },
    }));

    setSaving(true);
    setError(null);
    try {
      const tour = await createTour(title.trim() || "My Virtual Tour", finalRooms);
      const savedRooms: Room[] = tour.scenes.map((s) => ({
        id: s.sceneId,
        name: s.name,
        description: s.description,
        floor: s.floor,
        panorama: s.panorama.startsWith("http")
          ? s.panorama
          : `${import.meta.env.VITE_API_URL?.replace(/\/api$/, "") ?? "http://localhost:5007"}${s.panorama}`,
        hotspots: s.hotspots,
        initialLon: s.initialLon ?? 0,
        initialLat: s.initialLat ?? 0,
        map: s.map,
      }));
      onSave(savedRooms, tour._id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save tour");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-xl p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            className="glass relative flex h-[min(720px,90vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div className="min-w-0 flex-1 pr-4">
                <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Custom Tour
                </div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Tour title"
                  className="mt-0.5 w-full bg-transparent text-lg font-light tracking-tight outline-none placeholder:text-muted-foreground/50"
                />
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/5 transition hover:bg-white/10"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Scenes list */}
              <div className="w-64 shrink-0 border-r border-white/5 p-4">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/5 py-3 text-xs uppercase tracking-[0.2em] text-muted-foreground transition hover:bg-white/10 hover:text-white"
                >
                  <Upload size={14} />
                  Upload 360° image
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <div className="mt-4 mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Scenes · {rooms.length}/{MAX_SCENES}
                </div>
                <div className="space-y-1 overflow-y-auto pr-1" style={{ maxHeight: "calc(100% - 110px)" }}>
                  {rooms.length === 0 && (
                    <div className="rounded-xl bg-white/[0.03] p-4 text-center text-[11px] text-muted-foreground">
                      No scenes yet. Upload equirectangular 360° JPGs to start.
                    </div>
                  )}
                  {rooms.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setActiveId(r.id)}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        r.id === activeId ? "bg-white/10" : "hover:bg-white/5"
                      }`}
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/5">
                        <img src={r.panorama} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{r.name}</div>
                        <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                          {r.hotspots.length} hotspots
                        </div>
                      </div>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRoom(r.id);
                        }}
                        className="opacity-0 transition group-hover:opacity-100"
                        role="button"
                      >
                        <Trash2 size={13} className="text-muted-foreground hover:text-white" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Active scene editor */}
              <div className="flex-1 overflow-y-auto p-6">
                {!active ? (
                  <div className="grid h-full place-items-center text-center">
                    <div>
                      <ImageIcon size={36} className="mx-auto text-muted-foreground/40" />
                      <div className="mt-3 text-sm text-muted-foreground">
                        Upload a 360° panorama to get started.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="md:col-span-1">
                        <div className="aspect-video overflow-hidden rounded-xl bg-white/5">
                          <img src={active.panorama} alt="" className="h-full w-full object-cover" />
                        </div>
                      </div>
                      <div className="space-y-3 md:col-span-2">
                        <div>
                          <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            Scene name
                          </label>
                          <input
                            value={active.name}
                            onChange={(e) => updateActive({ name: e.target.value })}
                            className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none transition focus:bg-white/10"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            Description
                          </label>
                          <textarea
                            value={active.description}
                            onChange={(e) => updateActive({ description: e.target.value })}
                            rows={2}
                            className="mt-1 w-full resize-none rounded-xl bg-white/5 px-3 py-2 text-sm outline-none transition focus:bg-white/10"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Hotspots
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        After saving, use <strong className="text-white/80">Add hotspot</strong> in the viewer — click anywhere in the scene to place your own markers.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/5 px-6 py-4">
              <div className="text-[11px] text-muted-foreground">
                {error ? (
                  <span className="text-red-400">{error}</span>
                ) : (
                  `Up to ${MAX_SCENES} panoramas per tour. Use equirectangular (2:1) JPG/PNG.`
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-xl px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground transition hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-white px-5 py-2 text-xs uppercase tracking-[0.2em] text-black transition hover:bg-white/90 disabled:opacity-70"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {saving ? "Uploading…" : "Save tour"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
