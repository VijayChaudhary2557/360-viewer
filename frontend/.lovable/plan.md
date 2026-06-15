
## Goal

Build a cinematic, dark-themed 3D virtual tour single-page app. One demo property with ~5 rooms, real 360° panorama navigation with a "walk-into-the-room" camera dolly between scenes, and a complete glassmorphism control layer (sidebar, dock, top controls, minimap, info modals, loading screen).

## Tech choices (decided)

- **Three.js** equirectangular sphere viewer (full control over camera dolly/walk animation — matches the spec).
- **AI-generated stylized 360° panoramas** for 5 rooms (Living Room, Kitchen, Bedroom, Bathroom, Hallway) stored in `src/assets/panoramas/`. Generated at 1920×960 with a wide cinematic prompt — good enough to demo the experience; user can swap later.
- Single demo property — no property browser.
- Framer Motion for UI micro-interactions (already idiomatic for the spec).
- Tailwind v4 + custom design tokens in `src/styles.css`.

## Design system

Tokens added to `src/styles.css`:
- `--background: oklch(0.17 0.012 260)` (~#0F1115)
- Glass surface tokens: `--glass-bg`, `--glass-border`, `--glass-blur`
- Accent: cool electric blue/white for hotspots and active states
- Radius scale anchored at 16px
- Soft layered shadows + backdrop-blur utilities
- Typography: Inter Tight / SF-style (loaded via `<link>` in `__root.tsx`)

## File structure

```
src/
  routes/
    __root.tsx              # add font link, update meta
    index.tsx               # mount <VirtualTour />
  components/tour/
    VirtualTour.tsx         # top-level orchestrator + state (current room, loading)
    PanoramaViewer.tsx      # Three.js canvas, sphere, camera, walk transition
    Hotspot.tsx             # 3D-positioned floating hotspot w/ pulse + tooltip
    LoadingScreen.tsx       # animated logo + progress + fade-out
    Sidebar.tsx             # collapsible left glass panel (rooms, floors, search, progress)
    BottomDock.tsx          # floating control dock (prev/next/auto/fullscreen/VR/plan/settings)
    TopRightControls.tsx    # share/info/audio/help/reset circular buttons
    MiniMap.tsx             # floating floor plan w/ active room indicator
    InfoModal.tsx           # glass modal with backdrop blur
  lib/tour/
    rooms.ts                # room data: id, name, panorama, hotspots[{toRoomId, position}], floor, mapCoords
  assets/panoramas/         # 5 generated 360° JPGs
```

## Walk transition (core interaction)

When a hotspot is clicked:
1. Capture current camera quaternion (preserve viewing angle).
2. Tween camera FOV from 75 → 55 (forward zoom) and translate the camera slightly along the hotspot direction over ~1.4s with cubic ease-in-out.
3. At ~70% progress, crossfade a full-screen overlay (black w/ subtle blur) from 0 → 0.85 opacity.
4. Swap the sphere texture to the destination panorama, reset camera position, restore orientation.
5. Fade overlay back to 0, ease FOV back to 75.
6. Optional CSS `backdrop-filter: blur()` overlay during the swap for motion-blur feel.

Implemented with a `useTransition` hook driving `requestAnimationFrame` + easing functions (no extra deps).

## UI layer behavior

- **Sidebar**: slides in from left, collapses to a 56px rail with icons; framer-motion width animation; search filters room list; vertical progress bar shows `visitedRooms / total`.
- **Bottom dock**: floating centered, `backdrop-blur-xl`, buttons with hover glow (`box-shadow` ring on accent). Auto-Walk cycles rooms on a timer. Fullscreen uses the Fullscreen API. VR/Floor Plan/Settings open modals or toggle minimap.
- **Top-right controls**: circular 44px glass buttons stacked vertically, spring hover scale.
- **Minimap**: bottom-left card showing an SVG floor plan with room polygons; active room glows; click navigates (triggers walk transition).
- **Info modal**: centered, max-w-md, glass, backdrop blur over entire viewport, scale+fade in.
- **Loading screen**: full-cover, animated SVG ring + monogram, fades out when first panorama texture loads.

## Mobile

- Sidebar collapses to a bottom sheet trigger; top-right controls collapse into a single "more" button that expands.
- Dock shrinks to essential 4 buttons (prev/next/auto/plan).
- Hammer-free: rely on native touch + OrbitControls-style pointer handlers in the Three.js viewer (already touch-friendly).
- Minimap hidden behind a toggle on <768px.

## Asset generation

Generate 5 panoramas via `imagegen` at 1920×960 (closest to 2:1 equirectangular allowed by size limits) with prompts tuned for "wide cinematic interior, ultra-wide panoramic". They won't be perfect spherical projections but will read convincingly as immersive interiors when wrapped on the sphere with the camera centered. Also generate a small monogram logo for the loader/sidebar.

## Out of scope

- Real VR/WebXR session (VR button shows a "coming soon" toast).
- True audio narration (Audio button toggles a placeholder ambient state).
- Persistence / multi-property / backend — pure frontend demo.

## Acceptance

- Loads to a polished loading screen, fades into the Living Room panorama.
- Drag to look around; click a floating hotspot → smooth walk transition (~1.4s) into next room with preserved orientation.
- Sidebar, dock, top-right controls, minimap, and info modal all render with glassmorphism and animate smoothly.
- Responsive at 1920, 1024, 768, 390 widths with no layout breakage.
