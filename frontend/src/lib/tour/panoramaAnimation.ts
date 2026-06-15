/** Easing and camera transition helpers for 360° panorama navigation.
 *  Tuned for Google Street View-style smooth walk-through feel.
 */

import * as THREE from "three";

export const DEFAULT_FOV = 75;
export const ZOOM_IN_FOV = 63;          // FOV narrows on click — noticeable forward zoom
export const ROTATION_MIN_MS = 600;     // faster minimum — snappy for nearby hotspots
export const ROTATION_MAX_MS = 1100;    // cap so long rotations don't drag
export const CROSSFADE_MS = 550;        // crisp crossfade, not sluggish
export const FADE_OVERLAP_AT = 0.55;    // fade starts while still rotating (overlap = fluidity)
export const DRAG_LERP = 0.12;
export const ROTATION_ANGLE_SCALE = 6; // lower = faster per degree (was 10)

const _vStart = new THREE.Vector3();
const _vEnd = new THREE.Vector3();
const _vOut = new THREE.Vector3();

// ─── Easing ──────────────────────────────────────────────────────────────────

/** Smooth cubic — feels natural for camera rotation (not too slow at ends). */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Ease out quart — for the FOV zoom recovery (snaps back crisply). */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** Ease in quad — for the initial FOV zoom-in (quick, subtle). */
export function easeInQuad(t: number): number {
  return t * t;
}

/** Smooth crossfade — ease in-out sine feels most natural for opacity. */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// Keep this export so any existing imports don't break
export const easeInOutQuint = easeInOutCubic;
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ─── Lon/lat helpers ─────────────────────────────────────────────────────────

export function lonDelta(from: number, to: number): number {
  let d = to - from;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

export function rotationDurationMs(
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number,
): number {
  const dLon = Math.abs(lonDelta(fromLon, toLon));
  const dLat = Math.abs(toLat - fromLat);
  const angle = Math.sqrt(dLon * dLon + dLat * dLat);
  return Math.round(
    Math.min(ROTATION_MAX_MS, Math.max(ROTATION_MIN_MS, angle * ROTATION_ANGLE_SCALE)),
  );
}

export function lonLatToDirection(lon: number, lat: number, out = _vStart): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon);
  return out.set(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  );
}

export function directionToLonLat(dir: THREE.Vector3): { lon: number; lat: number } {
  const n = dir.clone().normalize();
  return {
    lon: THREE.MathUtils.radToDeg(Math.atan2(n.z, n.x)),
    lat: Math.max(-85, Math.min(85, THREE.MathUtils.radToDeg(Math.asin(n.y)))),
  };
}

/** Geodesic slerp — smooth arc on the sphere, identical to Street View. */
export function slerpLonLat(
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number,
  t: number,
): { lon: number; lat: number } {
  lonLatToDirection(fromLon, fromLat, _vStart);
  lonLatToDirection(toLon, toLat, _vEnd);

  const dot = THREE.MathUtils.clamp(_vStart.dot(_vEnd), -1, 1);
  const omega = Math.acos(dot);

  if (omega < 0.0002) return { lon: toLon, lat: toLat };

  const sinOmega = Math.sin(omega);
  const w1 = Math.sin((1 - t) * omega) / sinOmega;
  const w2 = Math.sin(t * omega) / sinOmega;
  _vOut.copy(_vStart).multiplyScalar(w1).addScaledVector(_vEnd, w2);
  return directionToLonLat(_vOut);
}

// ─── FOV zoom animation ──────────────────────────────────────────────────────

/**
 * Returns the FOV to use at a given point in the transition.
 *
 * Street View zooms in slightly as you "walk" toward a hotspot, then zooms
 * back out as the new scene fades in.  The effect reads as forward momentum.
 *
 * Timeline (relative to rotateDuration):
 *   0 → 0.4  zoom in from DEFAULT_FOV → ZOOM_IN_FOV   (easeInQuad)
 *   0.4 → 1  zoom back to DEFAULT_FOV                  (easeOutQuart)
 */
export function fovForProgress(rotateT: number): number {
  // Only zoom in — hold at ZOOM_IN_FOV, never zoom back out during transition.
  // FOV returns to DEFAULT smoothly via the render-loop lerp after the scene swaps.
  const delta = DEFAULT_FOV - ZOOM_IN_FOV;
  return DEFAULT_FOV - delta * easeInQuad(Math.min(rotateT, 1));
}

// ─── Transition state ────────────────────────────────────────────────────────

export type PanoramaTransition = {
  active: boolean;
  gen: number;
  startTime: number;
  rotateDuration: number;
  fadeDuration: number;
  fadeOverlapAt: number;
  fromLon: number;
  fromLat: number;
  toLon: number;
  toLat: number;
  fadeStarted: boolean;
  fadeStartTime: number;
  withFade: boolean;
  withFovZoom: boolean;
  resolve: (() => void) | null;
};

export function createPanoramaTransition(): PanoramaTransition {
  return {
    active: false,
    gen: 0,
    startTime: 0,
    rotateDuration: ROTATION_MIN_MS,
    fadeDuration: CROSSFADE_MS,
    fadeOverlapAt: FADE_OVERLAP_AT,
    fromLon: 0,
    fromLat: 0,
    toLon: 0,
    toLat: 0,
    fadeStarted: false,
    fadeStartTime: 0,
    withFade: true,
    withFovZoom: false,
    resolve: null,
  };
}

export function cancelPanoramaTransition(t: PanoramaTransition) {
  if (t.resolve) {
    t.resolve();
    t.resolve = null;
  }
  t.active = false;
  t.fadeStarted = false;
}

export type BeginTransitionOpts = {
  gen: number;
  fromLon: number;
  fromLat: number;
  toLon?: number;
  toLat?: number;
  rotateDuration?: number;
  fadeDuration?: number;
  fadeOverlapAt?: number;
  withFade?: boolean;
  withFovZoom?: boolean;
};

export function beginPanoramaTransition(
  t: PanoramaTransition,
  opts: BeginTransitionOpts,
): Promise<void> {
  cancelPanoramaTransition(t);

  const toLon = opts.toLon ?? opts.fromLon;
  const toLat = opts.toLat ?? opts.fromLat;
  const rotateDuration =
    opts.rotateDuration ??
    (opts.toLon !== undefined
      ? rotationDurationMs(opts.fromLon, opts.fromLat, toLon, toLat)
      : 0);

  t.active = true;
  t.gen = opts.gen;
  t.startTime = performance.now();
  t.rotateDuration = rotateDuration;
  t.fadeDuration = opts.fadeDuration ?? CROSSFADE_MS;
  t.fadeOverlapAt = opts.fadeOverlapAt ?? FADE_OVERLAP_AT;
  t.fromLon = opts.fromLon;
  t.fromLat = opts.fromLat;
  t.toLon = toLon;
  t.toLat = toLat;
  t.fadeStarted = false;
  t.fadeStartTime = 0;
  t.withFade = opts.withFade ?? true;
  t.withFovZoom = opts.withFovZoom ?? false;

  return new Promise((resolve) => {
    t.resolve = resolve;
  });
}

export function markFadeStarted(t: PanoramaTransition, now: number) {
  if (t.fadeStarted) return;
  t.fadeStarted = true;
  t.fadeStartTime = now;
}

export function stepPanoramaTransition(
  t: PanoramaTransition,
  now: number,
): {
  lon: number;
  lat: number;
  fov: number;
  fadeOpacity: number;
  shouldStartFade: boolean;
  done: boolean;
} {
  const elapsed = now - t.startTime;
  const rotateT = t.rotateDuration > 0 ? Math.min(1, elapsed / t.rotateDuration) : 1;

  // Cubic easing — smoother feel than quint
  const rotateEased = easeInOutCubic(rotateT);
  const { lon, lat } = slerpLonLat(t.fromLon, t.fromLat, t.toLon, t.toLat, rotateEased);

  // FOV zoom effect — independent of crossfade, controlled by withFovZoom
  const fov = t.withFovZoom ? fovForProgress(rotateT) : DEFAULT_FOV;

  // Trigger fade while still rotating (creates overlap = fluidity)
  const fadeTriggerElapsed = t.rotateDuration * t.fadeOverlapAt;
  const shouldStartFade = t.withFade && !t.fadeStarted && elapsed >= fadeTriggerElapsed;

  // Sine easing for crossfade opacity — most natural-looking
  let fadeOpacity = 0;
  if (t.fadeStarted) {
    const fadeStart = t.fadeStartTime || now;
    const fadeT = Math.min(1, (now - fadeStart) / t.fadeDuration);
    fadeOpacity = easeInOutSine(fadeT);
  }

  const rotateDone = rotateT >= 1;
  const fadeDone = t.withFade ? t.fadeStarted && fadeOpacity >= 1 : true;
  const done = rotateDone && fadeDone;

  if (done) {
    t.active = false;
    t.fadeStarted = false;
    t.resolve?.();
    t.resolve = null;
  }

  return { lon, lat, fov, fadeOpacity, shouldStartFade, done };
}