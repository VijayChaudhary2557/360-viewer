import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, Compass, Pencil, Plus, Trash2 } from "lucide-react";
import { HotspotPicker } from "./HotspotPicker";
import { HotspotEditor } from "./HotspotEditor";
import type { Hotspot } from "@/lib/tour/rooms";
import { PanoramaViewer, type PanoramaViewerHandle } from "./PanoramaViewer";
import { LoadingScreen } from "./LoadingScreen";
import { Sidebar } from "./Sidebar";
import { BottomDock } from "./BottomDock";
import { TopRightControls } from "./TopRightControls";
import { InfoModal } from "./InfoModal";
import { TourBuilder } from "./TourBuilder";
import { PublishModal } from "./PublishModal";
import { type Room } from "@/lib/tour/rooms";
import { getTour, tourToRooms, updateTour, toRelativePanorama } from "@/lib/api/tours";
import { scheduleTourSave } from "@/lib/api/debounceSave";

export function VirtualTour() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tourId, setTourId] = useState<string | null>(null);
  const [tourTitle, setTourTitle] = useState<string | null>(null);
  const [loadingTour, setLoadingTour] = useState(false);
  const [panoramaReady, setPanoramaReady] = useState(false);
  const pendingPanoramaRef = useRef<string | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const hasTour = rooms.length > 0;

  const [currentId, setCurrentId] = useState("");
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [autoWalk, setAutoWalk] = useState(false);
  const [infoFor, setInfoFor] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Edit mode is only active when the user just created/uploaded a tour in this session.
  // Loading via ?tour=<id> URL is always view-only (preview).
  const [isEditMode, setIsEditMode] = useState(false);
  const [placeMode, setPlaceMode] = useState(false);
  const [removeMode, setRemoveMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [repositioning, setRepositioning] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState<{ lon: number; lat: number } | null>(null);
  const [hotspotSyncKey, setHotspotSyncKey] = useState(0);
  const viewerRef = useRef<PanoramaViewerHandle>(null);

  const room = useMemo(
    () => rooms.find((r) => r.id === currentId) ?? rooms[0] ?? null,
    [rooms, currentId],
  );

  const goTo = useCallback((id: string) => {
    setCurrentId(id);
    setVisited((v) => new Set(v).add(id));
  }, []);

  const onReady = useCallback(() => {
    setPanoramaReady(true);
    hasLoadedOnceRef.current = true;
    pendingPanoramaRef.current = null;
  }, []);

  const persistRooms = useCallback(
    (updated: Room[]) => {
      if (tourId) scheduleTourSave(tourId, updated);
      return updated;
    },
    [tourId],
  );

  const resolvePanorama = useCallback(
    (id: string) => rooms.find((r) => r.id === id)?.panorama,
    [rooms],
  );

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("tour")) {
      setBuilderOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!autoWalk) return;
    const interval = setInterval(() => {
      const idx = rooms.findIndex((r) => r.id === currentId);
      const next = rooms[(idx + 1) % rooms.length];
      goTo(next.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoWalk, currentId, goTo, rooms]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  const prev = () => {
    const idx = rooms.findIndex((r) => r.id === currentId);
    const prevRoom = rooms[(idx - 1 + rooms.length) % rooms.length];
    viewerRef.current?.navigateDirection("backward", prevRoom.panorama, () => goTo(prevRoom.id));
  };
  const next = () => {
    const idx = rooms.findIndex((r) => r.id === currentId);
    const nextRoom = rooms[(idx + 1) % rooms.length];
    viewerRef.current?.navigateDirection("forward", nextRoom.panorama, () => goTo(nextRoom.id));
  };
  const rotateLeft = () => viewerRef.current?.rotateCameraBy(-90);
  const rotateRight = () => viewerRef.current?.rotateCameraBy(90);
  const onFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
  const onShare = async () => {
    try {
      const url = tourId
        ? `${window.location.origin}${window.location.pathname}?tour=${tourId}`
        : window.location.href;
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard");
    } catch {
      showToast("Share unavailable");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("tour");
    if (!id) return;
    setLoadingTour(true);
    setPanoramaReady(false);
    getTour(id)
      .then((tour) => {
        const loaded = tourToRooms(tour);
        setRooms(loaded);
        setTourId(tour._id);
        setTourTitle(tour.title);
        setCurrentId(loaded[0]?.id ?? "");
        setVisited(new Set(loaded[0] ? [loaded[0].id] : []));
        pendingPanoramaRef.current = loaded[0]?.panorama ?? null;
      })
      .catch(() => showToast("Could not load tour"))
      .finally(() => setLoadingTour(false));
  }, []);

  const handleSaveTour = (next: Room[], id: string) => {
    setRooms(next);
    setTourId(id);
    setCurrentId(next[0]?.id ?? "");
    setVisited(new Set(next[0] ? [next[0].id] : []));
    pendingPanoramaRef.current = next[0]?.panorama ?? null;
    setPanoramaReady(false);
    setPlaceMode(true);
    setRemoveMode(false);
    setEditMode(false);
    setEditingIndex(null);
    setRepositioning(false);
    setIsEditMode(true); // editing is allowed only in the session where tour was created
    const url = new URL(window.location.href);
    url.searchParams.set("tour", id);
    window.history.replaceState({}, "", url.toString());
    showToast("Tour saved — click the scene to place hotspots");
  };

  const handlePlace = (lon: number, lat: number) => {
    setPendingPlacement({ lon, lat });
  };

  const assignPlacement = (toRoomId: string, label: string) => {
    if (!pendingPlacement || !room) return;
    const { lon, lat } = pendingPlacement;
    const nextHotspots = [...room.hotspots, { toRoomId, label, lon, lat }];
    setPendingPlacement(null);
    applyHotspots(nextHotspots);
  };

  const applyHotspots = (nextHotspots: Hotspot[]) => {
    flushSync(() => {
      setRooms((prev) =>
        persistRooms(
          prev.map((r) => (r.id === currentId ? { ...r, hotspots: nextHotspots } : r)),
        ),
      );
      setHotspotSyncKey((k) => k + 1);
    });
    viewerRef.current?.syncHotspotsNow(nextHotspots);
  };

  const updateHotspot = (index: number, patch: Partial<Hotspot>) => {
    if (!room) return;
    const nextHotspots = room.hotspots.map((h, i) => (i === index ? { ...h, ...patch } : h));
    applyHotspots(nextHotspots);
  };

  const removeHotspot = (index: number) => {
    if (!room) return;
    const nextHotspots = room.hotspots.filter((_, i) => i !== index);
    applyHotspots(nextHotspots);
    if (editingIndex === index) {
      setEditingIndex(null);
      setRepositioning(false);
    }
    showToast("Hotspot removed");
  };

  const handleEditHotspot = (index: number) => {
    setEditingIndex(index);
    setRepositioning(false);
  };

  const handleHotspotDrag = (index: number, lon: number, lat: number) => {
    updateHotspot(index, { lon, lat });
    setEditingIndex(index);
    showToast("Hotspot moved");
  };

  const saveInitialView = () => {
    if (!room) return;
    const view = viewerRef.current?.getView();
    if (!view) return;
    setRooms((prev) =>
      persistRooms(
        prev.map((r) =>
          r.id === currentId
            ? { ...r, initialLon: view.lon, initialLat: view.lat }
            : r,
        ),
      ),
    );
    showToast("Start view saved for this scene");
  };

  const publishTour = async () => {
    if (!tourId || publishing) return;
    setPublishing(true);
    try {
      await updateTour(
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
      );
      setPublishOpen(true);
    } catch {
      showToast("Save failed — check your connection");
    } finally {
      setPublishing(false);
    }
  };

  const editingHotspot = editingIndex !== null ? room?.hotspots[editingIndex] : null;

  const allPanoramas = useMemo(
    () => [...new Set(rooms.map((r) => r.panorama).filter(Boolean))],
    [rooms],
  );

  const infoRoom = infoFor ? (rooms.find((r) => r.id === infoFor) ?? null) : null;

  const showLoader = loadingTour || (!panoramaReady && hasTour && !hasLoadedOnceRef.current);

  if (!hasTour && !loadingTour) {
    return (
      <div className="relative flex h-screen w-screen flex-col items-center justify-center gap-6 bg-background text-foreground">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Virtual Tour</div>
          <h1 className="mt-2 text-3xl font-light tracking-tight">Create your 360° walkthrough</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Upload your panoramas, then click in the scene to place your own hotspots.
          </p>
        </div>
        <button
          onClick={() => setBuilderOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-xs uppercase tracking-[0.2em] text-black transition hover:bg-white/90"
        >
          <Plus size={14} /> Upload 360° images
        </button>
        <TourBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} onSave={handleSaveTour} />
      </div>
    );
  }

  if (!room) return null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      <PanoramaViewer
        ref={viewerRef}
        room={room}
        onHotspot={(h) => goTo(h.toRoomId)}
        onReady={onReady}
        resolvePanorama={resolvePanorama}
        resetKey={0}
        placementMode={placeMode}
        removeMode={removeMode}
        editMode={editMode}
        selectedHotspotIndex={editingIndex}
        pendingPlacement={pendingPlacement}
        onPlace={handlePlace}
        onEditHotspot={handleEditHotspot}
        onRemoveHotspot={removeHotspot}
        onHotspotDrag={handleHotspotDrag}
        preloadUrls={allPanoramas}
        hotspotSyncKey={hotspotSyncKey}
      />

      <motion.div
        key={room.id}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="pointer-events-none fixed left-1/2 top-6 z-20 -translate-x-1/2 text-center"
      >
        <div className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Now viewing</div>
        <div className="mt-1 text-xl font-light tracking-tight md:text-2xl">{room.name}</div>
      </motion.div>

      <Sidebar
        rooms={rooms}
        currentRoomId={currentId}
        visitedCount={visited.size}
        onSelectRoom={goTo}
        title={tourTitle ?? "My Tour"}
        subtitle={`${rooms.length} scenes`}
        onOpenBuilder={() => setBuilderOpen(true)}
      />
      <TopRightControls onShare={onShare} onInfo={() => setInfoFor(currentId)} />
      <BottomDock
        onPrev={prev}
        onNext={next}
        onRotateLeft={rotateLeft}
        onRotateRight={rotateRight}
        autoWalk={autoWalk}
        onToggleAutoWalk={() => setAutoWalk(!autoWalk)}
        onFullscreen={onFullscreen}
        onVR={() => showToast("VR mode coming soon")}
        onSettings={() => showToast("Settings coming soon")}
      />
      <InfoModal room={infoRoom} onClose={() => setInfoFor(null)} />

      {/* Edit-mode controls — hidden in preview/shared-link mode */}
      {isEditMode && (
        <>
          <div className="fixed bottom-28 right-4 z-30 flex flex-col gap-2">
            {tourId && (
              <button
                onClick={publishTour}
                disabled={publishing}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.2em] transition bg-white text-black hover:bg-white/90 disabled:opacity-60"
              >
                {publishing ? "Saving…" : "Save & Get Link"}
              </button>
            )}
            <button
              onClick={saveInitialView}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.2em] transition glass text-muted-foreground hover:text-white"
            >
              <Compass size={13} /> Set start view
            </button>
            <button
              onClick={() => {
                const next = !placeMode;
                if (next) {
                  setRemoveMode(false);
                  setEditMode(false);
                  setEditingIndex(null);
                  setRepositioning(false);
                }
                setPlaceMode(next);
              }}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.2em] transition ${
                placeMode ? "bg-white text-black" : "glass text-muted-foreground hover:text-white"
              }`}
            >
              <Crosshair size={13} />{" "}
              {pendingPlacement ? "Pick scene…" : placeMode ? "Click to place" : "Add hotspot"}
            </button>
            <button
              onClick={() => {
                const next = !editMode;
                if (next) {
                  setPlaceMode(false);
                  setRemoveMode(false);
                  setPendingPlacement(null);
                  setRepositioning(false);
                } else {
                  setEditingIndex(null);
                  setRepositioning(false);
                }
                setEditMode(next);
              }}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.2em] transition ${
                editMode ? "bg-amber-400 text-black" : "glass text-muted-foreground hover:text-white"
              }`}
            >
              <Pencil size={13} /> {editMode ? "Drag hotspot" : "Edit hotspot"}
            </button>
            <button
              onClick={() => {
                const next = !removeMode;
                if (next) {
                  setPlaceMode(false);
                  setEditMode(false);
                  setEditingIndex(null);
                  setRepositioning(false);
                }
                setRemoveMode(next);
              }}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.2em] transition ${
                removeMode ? "bg-red-500 text-white" : "glass text-muted-foreground hover:text-white"
              }`}
            >
              <Trash2 size={13} /> {removeMode ? "Click to remove" : "Remove hotspot"}
            </button>
          </div>

          {pendingPlacement && (
            <HotspotPicker
              rooms={rooms}
              currentRoomId={currentId}
              onSelect={assignPlacement}
              onCancel={() => setPendingPlacement(null)}
            />
          )}

          {editMode && editingHotspot && editingIndex !== null && (
            <HotspotEditor
              hotspot={editingHotspot}
              rooms={rooms}
              currentRoomId={currentId}
              onChangeDestination={(toRoomId, label) => updateHotspot(editingIndex, { toRoomId, label })}
              onClose={() => {
                setEditingIndex(null);
                setRepositioning(false);
              }}
            />
          )}

          <TourBuilder
            open={builderOpen}
            onClose={() => setBuilderOpen(false)}
            onSave={handleSaveTour}
            initial={rooms.length > 0 ? rooms : undefined}
          />
        </>
      )}

      <AnimatePresence>
        {publishOpen && tourId && (
          <PublishModal tourId={tourId} onClose={() => setPublishOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass fixed bottom-40 left-1/2 z-40 -translate-x-1/2 rounded-full px-4 py-2 text-xs"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(ellipse_at_center,transparent_75%,rgba(0,0,0,0.15)_100%)]" />

      <LoadingScreen visible={showLoader} />
    </div>
  );
}
