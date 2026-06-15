import { useEffect, useLayoutEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import type { Room, Hotspot } from "@/lib/tour/rooms";
import {
  DEFAULT_FOV,
  CROSSFADE_MS,
  DRAG_LERP,
  beginPanoramaTransition,
  cancelPanoramaTransition,
  createPanoramaTransition,
  markFadeStarted,
  stepPanoramaTransition,
} from "@/lib/tour/panoramaAnimation";

type Props = {
  room: Room;
  onHotspot: (h: Hotspot) => void;
  onReady: () => void;
  resetKey: number;
  placementMode?: boolean;
  removeMode?: boolean;
  editMode?: boolean;
  repositionMode?: boolean;
  selectedHotspotIndex?: number | null;
  pendingPlacement?: { lon: number; lat: number } | null;
  onPlace?: (lon: number, lat: number) => void;
  onReposition?: (lon: number, lat: number) => void;
  onEditHotspot?: (index: number) => void;
  onRemoveHotspot?: (index: number) => void;
  onHotspotDrag?: (index: number, lon: number, lat: number) => void;
  preloadUrls?: string[];
  resolvePanorama?: (roomId: string) => string | undefined;
  hotspotSyncKey?: number;
};

export type PanoramaViewerHandle = {
  syncHotspotsNow: (hotspots: Hotspot[]) => void;
  getView: () => { lon: number; lat: number };
  navigateDirection: (
    direction: "forward" | "backward" | "left" | "right",
    url: string | undefined,
    onDone: () => void,
  ) => void;
  rotateCameraBy: (degrees: number) => void;
};

function hotspotsKey(hotspots: Hotspot[]) {
  return hotspots.map((h) => `${h.lon}:${h.lat}:${h.toRoomId}:${h.label}`).join("|");
}

const waitForTexture = (texture: THREE.Texture) =>
  new Promise<void>((resolve, reject) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    const img = texture.image as HTMLImageElement | undefined;
    if (!img || img.complete) {
      resolve();
      return;
    }
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("texture load failed"));
  });

function clampHotspotLat(lat: number) {
  return Math.max(-80, Math.min(80, lat));
}

function spherePointToHotspot(p: THREE.Vector3) {
  return {
    lon: THREE.MathUtils.radToDeg(Math.atan2(p.z, p.x)),
    lat: clampHotspotLat(THREE.MathUtils.radToDeg(Math.asin(p.y))),
  };
}

const ARROW_SVG =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M7 1L13 12H1L7 1Z" fill="white"/>' +
  "</svg>";

function buildHotspotEl(hs: Hotspot, selected = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `hotspot hotspot-floor hotspot-offscreen pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 group${selected ? " hotspot-selected" : ""}`;
  btn.innerHTML =
    `<span class="hotspot-ring"></span><span class="hotspot-icon" aria-hidden="true">${ARROW_SVG}</span><span class="hotspot-label"></span>`;
  btn.querySelector(".hotspot-label")!.textContent = hs.label;
  return btn;
}

function buildPreviewEl() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    "hotspot hotspot-floor hotspot-preview hotspot-offscreen pointer-events-none absolute -translate-x-1/2 -translate-y-1/2";
  btn.innerHTML =
    '<span class="hotspot-ring"></span><span class="hotspot-icon" aria-hidden="true"></span>';
  return btn;
}

function setHotspotVisible(el: HTMLButtonElement, visible: boolean) {
  if (visible) {
    el.classList.remove("hotspot-offscreen");
    if (!el.classList.contains("hotspot-enter")) {
      el.classList.add("hotspot-enter");
    }
  } else {
    el.classList.remove("hotspot-enter");
    el.classList.add("hotspot-offscreen");
  }
}

export const PanoramaViewer = forwardRef<PanoramaViewerHandle, Props>(function PanoramaViewer(
  {
    room,
    onHotspot,
    onReady,
    resetKey,
    placementMode = false,
    removeMode = false,
    editMode = false,
    repositionMode = false,
    selectedHotspotIndex = null,
    pendingPlacement = null,
    onPlace,
    onReposition,
    onEditHotspot,
    onRemoveHotspot,
    onHotspotDrag,
    preloadUrls = [],
    resolvePanorama,
    hotspotSyncKey = 0,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const darkOverlayRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef(room);
  const onHotspotRef = useRef(onHotspot);
  const onReadyRef = useRef(onReady);
  const onRemoveRef = useRef(onRemoveHotspot);
  const onEditRef = useRef(onEditHotspot);
  const onHotspotDragRef = useRef(onHotspotDrag);
  const resolvePanoramaRef = useRef(resolvePanorama);
  const selectedIndexRef = useRef(selectedHotspotIndex);
  const placementRef = useRef({
    placementMode,
    removeMode,
    editMode,
    repositionMode,
    onPlace,
    onReposition,
    pendingPlacement,
  });
  const switchingRef = useRef(false);
  const hotspotsKeyRef = useRef("");
  const straightWalkRef = useRef(false);
  const hasInitialTextureRef = useRef(false);
  const transitionGenRef = useRef(0);
  const preloadUrlsRef = useRef(preloadUrls);
  const pendingHotspotNavRef = useRef<Hotspot | null>(null);
  preloadUrlsRef.current = preloadUrls;

  roomRef.current = room;
  onHotspotRef.current = onHotspot;
  onReadyRef.current = onReady;
  onRemoveRef.current = onRemoveHotspot;
  onEditRef.current = onEditHotspot;
  onHotspotDragRef.current = onHotspotDrag;
  resolvePanoramaRef.current = resolvePanorama;
  selectedIndexRef.current = selectedHotspotIndex;
  placementRef.current = {
    placementMode,
    removeMode,
    editMode,
    repositionMode,
    onPlace,
    onReposition,
    pendingPlacement,
  };

  const stateRef = useRef({
    renderer: null as THREE.WebGLRenderer | null,
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    sphereA: null as THREE.Mesh | null,
    sphereB: null as THREE.Mesh | null,
    loader: null as THREE.TextureLoader | null,
    textureCache: new Map<string, THREE.Texture>(),
    lon: 0,
    lat: 0,
    targetLon: 0,
    targetLat: 0,
    fov: DEFAULT_FOV,
    animating: false,
    dragging: false,
    moved: false,
    downX: 0,
    downY: 0,
    lastX: 0,
    lastY: 0,
    raf: 0,
    hotspotEls: [] as HTMLButtonElement[],
    previewEl: null as HTMLButtonElement | null,
    vec: new THREE.Vector3(),
    hvec: new THREE.Vector3(),
    proj: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    roomId: "",
    screenToHotspot: null as ((clientX: number, clientY: number) => { lon: number; lat: number } | null) | null,
    dragOverrides: new Map<number, { lon: number; lat: number }>(),
    hotspotPointer: null as { index: number; downX: number; downY: number; moved: boolean } | null,
    transition: createPanoramaTransition(),
    pendingFadeTexture: null as THREE.Texture | null,
  });

  const setTransitioning = (active: boolean) => {
    containerRef.current?.classList.toggle("panorama-transitioning", active);
  };

  const applyRoomInitialView = (r: Room) => {
    const s = stateRef.current;
    const lon = r.initialLon ?? 0;
    const lat = r.initialLat ?? 0;
    s.targetLon = lon;
    s.lon = lon;
    s.targetLat = lat;
    s.lat = lat;
  };

  const setCameraView = (lon: number, lat: number) => {
    const s = stateRef.current;
    s.lon = lon;
    s.lat = lat;
    s.targetLon = lon;
    s.targetLat = lat;
  };

  const projectHotspot = (
    hs: { lon: number; lat: number },
    camera: THREE.PerspectiveCamera,
    w: number,
    h: number,
    s: typeof stateRef.current,
  ) => {
    const hphi = THREE.MathUtils.degToRad(90 - hs.lat);
    const htheta = THREE.MathUtils.degToRad(hs.lon);
    s.hvec.set(
      500 * Math.sin(hphi) * Math.cos(htheta),
      500 * Math.cos(hphi),
      500 * Math.sin(hphi) * Math.sin(htheta),
    );
    s.forward.copy(s.hvec).sub(camera.position);
    const distSq = s.forward.lengthSq();
    if (distSq < 1) return null;
    s.forward.multiplyScalar(1 / Math.sqrt(distSq));
    camera.getWorldDirection(s.proj);
    if (s.proj.dot(s.forward) < 0.12) return null;
    s.proj.copy(s.hvec).project(camera);
    if (s.proj.z > 1) return null;
    const x = (s.proj.x * 0.5 + 0.5) * w;
    const y = (-s.proj.y * 0.5 + 0.5) * h;
    if (x < -60 || x > w + 60 || y < -60 || y > h + 60) return null;
    return { x, y };
  };

  const ensureTexture = (url: string) => {
    const s = stateRef.current;
    const cached = s.textureCache.get(url);
    if (cached) return Promise.resolve(cached);
    if (!s.loader) return Promise.reject(new Error("loader not ready"));

    return new Promise<THREE.Texture>((resolve, reject) => {
      s.loader!.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          s.textureCache.set(url, tex);
          if (s.renderer) {
            try {
              s.renderer.initTexture(tex);
            } catch (e) {
              // ignore
            }
          }
          resolve(tex);
        },
        undefined,
        reject,
      );
    });
  };

  const resetCrossfadeLayer = () => {
    const s = stateRef.current;
    const matB = s.sphereB!.material as THREE.MeshBasicMaterial;
    matB.opacity = 0;
    s.sphereB!.visible = false;
    s.pendingFadeTexture = null;
  };

  const prepareCrossfadeLayer = (texture: THREE.Texture) => {
    const s = stateRef.current;
    const matA = s.sphereA!.material as THREE.MeshBasicMaterial;
    if (matA.map === texture) return;

    const matB = s.sphereB!.material as THREE.MeshBasicMaterial;
    matA.depthWrite = false;
    matB.depthWrite = false;
    matB.map = texture;
    matB.opacity = 0;
    matB.needsUpdate = true;
    s.sphereB!.visible = true;
    s.pendingFadeTexture = texture;

    if (s.renderer && s.scene && s.camera) {
      s.renderer.render(s.scene, s.camera);
    }
  };

  const finishCrossfade = (texture: THREE.Texture) => {
    const s = stateRef.current;
    const matA = s.sphereA!.material as THREE.MeshBasicMaterial;
    const matB = s.sphereB!.material as THREE.MeshBasicMaterial;
    matA.map = texture;
    matA.needsUpdate = true;
    matB.opacity = 0;
    s.sphereB!.visible = false;
    matA.depthWrite = true;
    matB.depthWrite = true;
    s.pendingFadeTexture = null;
  };

  const cancelActiveTransition = () => {
    const s = stateRef.current;
    transitionGenRef.current += 1;
    cancelPanoramaTransition(s.transition);
    // Force-hide dark overlay immediately
    if (darkOverlayRef.current) {
      darkOverlayRef.current.style.transition = "none";
      darkOverlayRef.current.style.opacity = "0";
    }
    // Reset zoom transform
    if (containerRef.current) {
      containerRef.current.classList.remove("panorama-walk-zoom");
      containerRef.current.style.transition = "none";
      containerRef.current.style.transform = "";
    }

    if (s.pendingFadeTexture && s.sphereB?.visible) {
      finishCrossfade(s.pendingFadeTexture);
    } else {
      resetCrossfadeLayer();
    }

    pendingHotspotNavRef.current = null;
    s.animating = false;
    switchingRef.current = false;
    setTransitioning(false);
  };

  const runSceneTransition = async (url: string, isCancelled: () => boolean) => {
    const s = stateRef.current;
    switchingRef.current = true;
    s.animating = true;
    setTransitioning(true);

    try {
      const texture = await ensureTexture(url);
      if (isCancelled()) return;
      await waitForTexture(texture);
      if (isCancelled()) return;
      if (s.renderer && texture) {
        try { s.renderer.initTexture(texture); } catch (e) {}
      }

      s.pendingFadeTexture = texture;
      await beginPanoramaTransition(s.transition, {
        gen: transitionGenRef.current,
        fromLon: s.lon,
        fromLat: s.lat,
        rotateDuration: 0,
        fadeDuration: CROSSFADE_MS,
        fadeOverlapAt: 0,
      });

      if (isCancelled()) return;
      if (s.pendingFadeTexture) finishCrossfade(s.pendingFadeTexture);
    } finally {
      setTransitioning(false);
      if (!isCancelled()) {
        s.animating = false;
        switchingRef.current = false;
        onReadyRef.current();
      }
    }
  };

  const navigateViaHotspot = async (hs: Hotspot, gen: number) => {
    const s = stateRef.current;
    const isCancelled = () => transitionGenRef.current !== gen;
    const overlay = darkOverlayRef.current;
    const shell = containerRef.current;

    switchingRef.current = true;
    s.animating = true;
    setTransitioning(true);

    const destUrl = resolvePanoramaRef.current?.(hs.toRoomId);

    // Timing constants
    const ZOOM_MS = 520;        // CSS scale zoom duration
    const DARK_START = 370;     // dark overlay starts at 370ms (71% into zoom)
    const DARK_IN_MS = 160;     // fade-to-dark duration
    const DARK_OUT_MS = 180;    // fade-from-dark duration

    try {
      // ── Preload next scene texture (concurrent with zoom) ──────────────────
      let texture: THREE.Texture | null = null;
      if (destUrl) {
        texture = await ensureTexture(destUrl);
        if (isCancelled()) return;
        await waitForTexture(texture);
        if (isCancelled()) return;
        if (s.renderer && texture) {
          try { s.renderer.initTexture(texture); } catch (e) {}
        }
      }

      // ── Phase 1: CSS scale zoom-in (no FOV change) ────────────────────────
      if (shell) shell.classList.add("panorama-walk-zoom");

      // Wait until dark-start point, then begin dark overlay
      await new Promise<void>((r) => setTimeout(r, DARK_START));
      if (isCancelled()) return;

      // ── Phase 2: fade to dark while zoom is still running ─────────────────
      if (overlay) {
        overlay.style.transition = `opacity ${DARK_IN_MS}ms ease-in`;
        overlay.style.opacity = "1";
      }
      // Wait for full darkness (remaining zoom + dark-in settle)
      const waitForDark = Math.max(DARK_IN_MS, ZOOM_MS - DARK_START) + 20;
      await new Promise<void>((r) => setTimeout(r, waitForDark));
      if (isCancelled()) return;

      // ── Phase 3: swap scene while screen is fully dark ────────────────────
      // Reset zoom instantly (hidden by dark overlay)
      if (shell) {
        shell.classList.remove("panorama-walk-zoom");
        shell.style.transition = "none";
        shell.style.transform = "scale(1)";
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        shell.offsetHeight; // force reflow so transition "none" takes effect
        shell.style.transition = "";
        shell.style.transform = "";
      }

      // Swap texture
      if (texture) {
        const matA = s.sphereA!.material as THREE.MeshBasicMaterial;
        matA.map = texture;
        matA.needsUpdate = true;
      }

      // Notify parent — triggers room state update
      straightWalkRef.current = true;
      pendingHotspotNavRef.current = null;
      onHotspotRef.current(hs);

      // ── Phase 4: fade from dark — new scene reveals ───────────────────────
      if (overlay) {
        overlay.style.transition = `opacity ${DARK_OUT_MS}ms ease-out`;
        overlay.style.opacity = "0";
      }
    } finally {
      setTransitioning(false);
      if (!isCancelled()) {
        s.animating = false;
        switchingRef.current = false;
      }
      // Always clean up zoom transform on cancel/error
      if (shell) {
        shell.classList.remove("panorama-walk-zoom");
        shell.style.transition = "none";
        shell.style.transform = "";
      }
    }
  };

  const startHotspotNavigation = (hs: Hotspot) => {
    if (switchingRef.current || stateRef.current.animating) {
      cancelActiveTransition();
    }

    const gen = ++transitionGenRef.current;
    pendingHotspotNavRef.current = hs;
    navigateViaHotspot(hs, gen).catch(() => {
      if (transitionGenRef.current === gen) {
        stateRef.current.animating = false;
        switchingRef.current = false;
        pendingHotspotNavRef.current = null;
      }
    });
  };

  const handleHotspotActivate = (hs: Hotspot, index: number) => {
    if (placementRef.current.placementMode) return;
    if (placementRef.current.editMode) {
      onEditRef.current?.(index);
      return;
    }
    if (placementRef.current.removeMode) {
      onRemoveRef.current?.(index);
      return;
    }
    startHotspotNavigation(hs);
  };

  const attachHotspotPointer = (el: HTMLButtonElement, index: number) => {
    const onDown = (e: PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const s = stateRef.current;
      if (placementRef.current.editMode) {
        s.hotspotPointer = { index, downX: e.clientX, downY: e.clientY, moved: false };
        el.setPointerCapture(e.pointerId);
        return;
      }
      s.hotspotPointer = { index, downX: e.clientX, downY: e.clientY, moved: false };
      el.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      const s = stateRef.current;
      const hp = s.hotspotPointer;
      if (!hp || hp.index !== index) return;
      if (Math.abs(e.clientX - hp.downX) + Math.abs(e.clientY - hp.downY) <= 6) return;

      if (placementRef.current.editMode) {
        hp.moved = true;
        el.classList.add("hotspot-dragging");
        const pos = s.screenToHotspot?.(e.clientX, e.clientY);
        if (pos) s.dragOverrides.set(index, pos);
      } else {
        hp.moved = true;
      }
    };

    const onUp = (e: PointerEvent) => {
      const s = stateRef.current;
      const hp = s.hotspotPointer;
      if (!hp || hp.index !== index) return;
      el.classList.remove("hotspot-dragging");
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);

      const dist = Math.abs(e.clientX - hp.downX) + Math.abs(e.clientY - hp.downY);
      const isEditDrag = placementRef.current.editMode && hp.moved && dist > 6;

      if (isEditDrag) {
        const pos = s.dragOverrides.get(index);
        if (pos) onHotspotDragRef.current?.(index, pos.lon, pos.lat);
        s.dragOverrides.delete(index);
      } else if (dist <= 10) {
        handleHotspotActivate(roomRef.current.hotspots[index], index);
      }

      s.hotspotPointer = null;
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  };

  const syncHotspots = (roomId: string, hotspots: Hotspot[]) => {
    const overlay = overlayRef.current;
    const s = stateRef.current;
    if (!overlay) return;

    const key = hotspotsKey(hotspots);
    const domStale = s.hotspotEls.some((el) => !el.isConnected);
    const mustRebuild =
      s.roomId !== roomId ||
      key !== hotspotsKeyRef.current ||
      s.hotspotEls.length !== hotspots.length ||
      domStale;

    if (s.roomId !== roomId || domStale) {
      s.hotspotEls.forEach((el) => el.remove());
      s.hotspotEls = [];
      if (s.previewEl) s.previewEl.remove();
      s.previewEl = null;
      s.roomId = roomId;
    }

    if (!s.previewEl) {
      s.previewEl = buildPreviewEl();
      overlay.appendChild(s.previewEl);
    }

    if (mustRebuild) {
      s.hotspotEls.forEach((el) => el.remove());
      s.hotspotEls = hotspots.map((hs, i) => {
        const el = buildHotspotEl(hs, i === selectedIndexRef.current);
        attachHotspotPointer(el, i);
        overlay.insertBefore(el, s.previewEl!);
        return el;
      });
      hotspotsKeyRef.current = key;
    }
  };

  useImperativeHandle(ref, () => ({
    syncHotspotsNow: (hotspots) => syncHotspots(roomRef.current.id, hotspots),
    getView: () => {
      const s = stateRef.current;
      return { lon: s.targetLon, lat: s.targetLat };
    },
    rotateCameraBy: (degrees: number) => {
      const s = stateRef.current;
      if (!s.animating && !switchingRef.current) {
        s.targetLon += degrees;
      }
    },
    navigateDirection: (direction, url, onDone) => {
      const s = stateRef.current;
      if (switchingRef.current || s.animating) cancelActiveTransition();

      const gen = ++transitionGenRef.current;
      const isCancelled = () => transitionGenRef.current !== gen;

      let toLon = s.lon;
      switch (direction) {
        case "forward":  toLon = s.lon;       break;
        case "backward": toLon = s.lon + 180; break;
        case "left":     toLon = s.lon - 90;  break;
        case "right":    toLon = s.lon + 90;  break;
      }

      const run = async () => {
        switchingRef.current = true;
        s.animating = true;
        setTransitioning(true);
        try {
          let texture: THREE.Texture | null = null;
          if (url) {
            texture = await ensureTexture(url);
            if (isCancelled()) return;
            await waitForTexture(texture);
            if (isCancelled()) return;
            if (s.renderer && texture) {
              try { s.renderer.initTexture(texture); } catch (e) {}
            }
          }
          if (texture) s.pendingFadeTexture = texture;

          await beginPanoramaTransition(s.transition, {
            gen,
            fromLon: s.lon,
            fromLat: s.lat,
            toLon,
            toLat: 0,
            withFade: !!texture,
          });

          if (isCancelled()) return;
          if (texture && s.pendingFadeTexture) finishCrossfade(texture);

          straightWalkRef.current = true;
          pendingHotspotNavRef.current = null;
          onDone();
        } catch {
          /* ignore */
        } finally {
          setTransitioning(false);
          if (!isCancelled()) {
            s.animating = false;
            switchingRef.current = false;
          }
        }
      };

      run().catch(() => {});
    },
  }));

  useLayoutEffect(() => {
    syncHotspots(room.id, room.hotspots);
    stateRef.current.hotspotEls.forEach((el, i) => {
      el.classList.toggle("hotspot-selected", i === selectedHotspotIndex);
    });
  }, [room.id, room.hotspots, hotspotSyncKey, selectedHotspotIndex]);

  useEffect(() => {
    const container = containerRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.zIndex = "1";
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      DEFAULT_FOV,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 0, 0.01);

    const makeSphere = (radius: number) => {
      const g = new THREE.SphereGeometry(radius, 48, 32);
      g.scale(-1, 1, 1);
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      return new THREE.Mesh(g, m);
    };

    const sphereA = makeSphere(500);
    const sphereB = makeSphere(500);
    sphereB.renderOrder = 1;
    (sphereB.material as THREE.MeshBasicMaterial).opacity = 0;
    (sphereB.material as THREE.MeshBasicMaterial).depthWrite = false;
    sphereB.visible = false;
    scene.add(sphereA);
    scene.add(sphereB);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    const s = stateRef.current;
    s.renderer = renderer;
    s.scene = scene;
    s.camera = camera;
    s.sphereA = sphereA;
    s.sphereB = sphereB;
    s.loader = loader;

    s.screenToHotspot = (clientX, clientY) => {
      const rect = container.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const hits = raycaster.intersectObject(sphereA);
      if (hits.length === 0) return null;
      return spherePointToHotspot(hits[0].point.clone().normalize());
    };

    for (const url of preloadUrlsRef.current) {
      if (!url || s.textureCache.has(url)) continue;
      ensureTexture(url).catch(() => {});
    }
    syncHotspots(room.id, room.hotspots);

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    const onDown = (e: PointerEvent) => {
      if (s.animating || switchingRef.current) return;
      s.dragging = true;
      s.moved = false;
      s.downX = s.lastX = e.clientX;
      s.downY = s.lastY = e.clientY;
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!s.dragging) return;
      const dx = e.clientX - s.lastX;
      const dy = e.clientY - s.lastY;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      if (Math.abs(e.clientX - s.downX) + Math.abs(e.clientY - s.downY) > 6) s.moved = true;
      s.targetLon -= dx * 0.15;
      s.targetLat = Math.max(-85, Math.min(85, s.targetLat + dy * 0.15));
    };
    const onUp = (e: PointerEvent) => {
      const wasDragging = s.dragging;
      s.dragging = false;
      const { placementMode: pm, onPlace: op } = placementRef.current;
      if (wasDragging && !s.moved && !switchingRef.current) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
        const hits = raycaster.intersectObject(sphereA);
        if (hits.length > 0) {
          const spot = spherePointToHotspot(hits[0].point.clone().normalize());
          if (pm && op) op(spot.lon, spot.lat);
        }
      }
    };
    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointercancel", onUp);
    dom.addEventListener("pointerleave", onUp);

    // ─── Main render loop ──────────────────────────────────────────────────
    const tick = (now: number) => {
      const transitioning = s.transition.active || s.animating;

      if (s.transition.active) {
        const step = stepPanoramaTransition(s.transition, now);
        setCameraView(step.lon, step.lat);

        // FOV zoom — narrows while walking forward, widens as new scene fades in
        if (camera.fov !== step.fov) {
          camera.fov = step.fov;
          camera.updateProjectionMatrix();
        }

        if (step.shouldStartFade && s.pendingFadeTexture) {
          prepareCrossfadeLayer(s.pendingFadeTexture);
          markFadeStarted(s.transition, now);
        }

        if (s.transition.fadeStarted && s.sphereB?.visible) {
          (s.sphereB.material as THREE.MeshBasicMaterial).opacity = step.fadeOpacity;
        }
      } else {
        // Only lerp FOV back when not mid-animation (prevents zoom-out showing during dark overlay)
        if (!s.animating && Math.abs(camera.fov - DEFAULT_FOV) > 0.05) {
          camera.fov += (DEFAULT_FOV - camera.fov) * 0.22;
          camera.updateProjectionMatrix();
        } else if (!s.animating && camera.fov !== DEFAULT_FOV) {
          camera.fov = DEFAULT_FOV;
          camera.updateProjectionMatrix();
        }

        if (!s.dragging) {
          s.lon += (s.targetLon - s.lon) * DRAG_LERP;
          s.lat += (s.targetLat - s.lat) * DRAG_LERP;
        }
      }

      const phi = THREE.MathUtils.degToRad(90 - s.lat);
      const theta = THREE.MathUtils.degToRad(s.lon);
      s.vec.set(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta),
      );
      camera.lookAt(s.vec);
      renderer.render(scene, camera);

      if (!transitioning) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const hotspots = roomRef.current.hotspots;

        for (let i = 0; i < s.hotspotEls.length; i++) {
          const el = s.hotspotEls[i];
          const base = hotspots[i];
          if (!el || !base) continue;
          const hs = s.dragOverrides.get(i) ?? base;
          const pos = projectHotspot(hs, camera, w, h, s);
          if (!pos) {
            setHotspotVisible(el, false);
          } else {
            setHotspotVisible(el, true);
            el.style.left = `${pos.x}px`;
            el.style.top = `${pos.y}px`;
            const depth = Math.max(0.55, Math.min(1, 1.1 - pos.y / h));
            el.style.transform = `translate(-50%, -50%) scale(${depth})`;
            // Rotate arrow icon to point FROM screen center TOWARD hotspot
            const iconEl = el.querySelector(".hotspot-icon") as HTMLElement | null;
            if (iconEl) {
              const angle = Math.atan2(pos.y - h / 2, pos.x - w / 2) * (180 / Math.PI);
              iconEl.style.transform = `rotate(${angle + 90}deg)`;
            }
          }
        }

        const pending = placementRef.current.pendingPlacement;
        if (s.previewEl && pending) {
          const pos = projectHotspot(pending, camera, w, h, s);
          if (pos) {
            setHotspotVisible(s.previewEl, true);
            s.previewEl.style.left = `${pos.x}px`;
            s.previewEl.style.top = `${pos.y}px`;
          } else {
            setHotspotVisible(s.previewEl, false);
          }
        } else if (s.previewEl) {
          setHotspotVisible(s.previewEl, false);
        }
      } else {
        for (const el of s.hotspotEls) setHotspotVisible(el, false);
        if (s.previewEl) setHotspotVisible(s.previewEl, false);
      }

      s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(s.raf);
      window.removeEventListener("resize", onResize);
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointercancel", onUp);
      dom.removeEventListener("pointerleave", onUp);
      s.textureCache.forEach((t) => t.dispose());
      s.textureCache.clear();
      s.hotspotEls.forEach((el) => el.remove());
      if (s.previewEl) s.previewEl.remove();
      s.hotspotEls = [];
      s.previewEl = null;
      s.roomId = "";
      hotspotsKeyRef.current = "";
      renderer.dispose();
      container.removeChild(dom);
    };
  }, []);

  useEffect(() => {
    const s = stateRef.current;
    if (!s.loader) return;
    for (const url of preloadUrls) {
      if (!url || s.textureCache.has(url)) continue;
      ensureTexture(url).catch(() => {});
    }
  }, [preloadUrls]);

  useEffect(() => {
    const s = stateRef.current;
    if (!s.loader || !s.sphereA || !s.sphereB) return;

    const gen = ++transitionGenRef.current;
    let cancelled = false;
    const isCancelled = () => cancelled || transitionGenRef.current !== gen;
    const fromHotspot = straightWalkRef.current;

    const apply = async () => {
      try {
        const matA = s.sphereA!.material as THREE.MeshBasicMaterial;
        if (!hasInitialTextureRef.current || !matA.map) {
          const texture = await ensureTexture(room.panorama);
          if (isCancelled()) return;
          texture.colorSpace = THREE.SRGBColorSpace;
          matA.map = texture;
          matA.needsUpdate = true;
          hasInitialTextureRef.current = true;
          applyRoomInitialView(room);
          onReadyRef.current();
          return;
        }

        const cached = s.textureCache.get(room.panorama);
        if (matA.map === cached) {
          if (!fromHotspot) applyRoomInitialView(room);
          straightWalkRef.current = false;
          s.animating = false;
          switchingRef.current = false;
          setTransitioning(false);
          onReadyRef.current();
          return;
        }

        await runSceneTransition(room.panorama, isCancelled);
        if (!isCancelled() && !fromHotspot) {
          applyRoomInitialView(roomRef.current);
        }
        straightWalkRef.current = false;
      } catch {
        if (!isCancelled()) {
          s.animating = false;
          switchingRef.current = false;
          onReadyRef.current();
        }
      }
    };

    apply();
    return () => {
      cancelled = true;
    };
  }, [room.id, room.panorama]);

  useEffect(() => {
    if (resetKey === 0) return;
    const s = stateRef.current;
    s.targetLon = 0;
    s.targetLat = 0;
  }, [resetKey]);

  return (
    <div
      ref={containerRef}
      className="panorama-viewer-shell absolute inset-0 select-none touch-none"
      style={{
        cursor: placementMode
          ? "crosshair"
          : removeMode
            ? "not-allowed"
            : editMode
              ? "grab"
              : undefined,
      }}
    >
      {/* Dark blink overlay — hides scene swap during navigation */}
      <div
        ref={darkOverlayRef}
        style={{ opacity: 0, zIndex: 12, background: "#000", position: "absolute", inset: 0, pointerEvents: "none" }}
      />
      <div
        ref={overlayRef}
        className={`pointer-events-none absolute inset-0 z-[15]${removeMode ? " hotspot-remove-mode" : ""}${editMode ? " hotspot-edit-mode hotspot-floor-edit" : ""}`}
      />
    </div>
  );
});