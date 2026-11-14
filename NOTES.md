# StepOut — NOTES

Project: StepOut (WipeOut-style) split-screen anti-gravity racer, single self-contained `index.html` (Three.js `0.160.0` via ES module CDN + importmap). One `<script type="module">`, organized into `CONFIG` / `DIAG` / `INPUT` / `TRACK` / `SHIP PHYSICS` / `CAMERA` / `RENDER & FX` / `HUD & OVERLAYS` / `GAME STATE`. Works identically from `http://127.0.0.1:8017/` and `file://`.

## Current phase
**Phase 7 — COMPLETE (Phases 1 through 7 all implemented and verified in headful Chrome).**

## Key architecture & fixes completed
- **Fixed-timestep 120 Hz physics (`CONFIG.physics.fixedHz = 120`):** Single consolidated velocity integration pass per ship (`stepShip`), zero heap allocations in the 120 Hz hot loop (reused scratch `Vector3` / `Quaternion` / `Matrix4` instances), interpolated render poses (`prev → cur` with `alpha`).
- **World-continuous inertial heading:** Ship yaw (`heading`) is maintained continuously across discrete spline sample transitions so ships carry real inertia into corners instead of auto-steering like slot cars.
- **Core WipeOut skill loop verified:** Yaw authority tapers at high speed (`steerSpeedTaper = 0.56`), while single-side airbrakes (`Q`/`E` for P1, `,`/`.` for P2, `L1`/`R1` on gamepad) add strong yaw (`airbrakeYawGain = 1.45`), extra lateral grip bite (`airbrakeLateralGain = 1.45`), and minimal drag (`airbrakeSingleDragFrac = 0.03`). Benchmarked through the 180° hairpin (`t = 0.15 → 0.42`):
  - `VOLT`: Plain steer `5.41 s` (8 wall hits, `41.0 m/s` exit) vs. Airbrake **`4.28 s`** (`56.3 m/s` exit).
  - `ARC`: Plain steer `5.27 s` (6 wall hits, `45.1 m/s` exit) vs. Airbrake **`4.12 s`** (`0` wall hits, `51.8 m/s` exit).
- **Bugs fixed from audit:**
  - Defined `CONFIG.physics.racingLineBoostRegenGain = 1.65` (fixed `NaN` boost poisoning near center line).
  - Proper spawn pose initialization in `makeShip` (eliminated frame-1 false respawn penalty).
  - Oriented start line, ramp lip, and chevron boost pads flat on the road surface (`Matrix4.makeBasis(right, tangent, up)`).
  - Fixed `ConeGeometry` normal inversion (`scale` applied to geometry + `computeVertexNormals()` before mesh creation, plus rear bulkhead, tail fins, chase fill light, and `RoomEnvironment` PMREM reflections) so ships are bright cyan (`P1`) and magenta (`P2`) instead of dark silhouettes.
  - Wired `F2` track-frame helper toggle (default off) and `F1` developer telemetry toggle (clean arcade HUD shown by default).
  - Made `init()` / `buildTrack()` idempotent with proper geometry/material/render-target disposal (zero scene or GPU memory leaks).
- **Phase 5 (Race Flow):** 2-player Ship Select screen (`VOLT` / `ARC` with live rotating 3D models and Speed / Handling / Thrust stat bars), `3 - 2 - 1 - GO!` countdown, 3-lap counter with mid-track checkpoint validation, `1ST` / `2ND` live ranking, lap & best-lap timers, and Finish / Rematch / Ship-Select overlay.
- **Phase 6 & 7 (AAA Neon Render/FX + Polish):**
  - `PMREMGenerator` + `RoomEnvironment` glossy reflections on textured sci-fi asphalt + metallic/emissive ship hulls.
  - Gradient shader sky dome, cyan/magenta neon track edge rails, amber jump-ramp lip, and glowing chevron boost pads.
  - Per-viewport `HalfFloatType` `EffectComposer` (`RenderPass` + `UnrealBloomPass` with `threshold = 1.15` + radial high-speed chromatic aberration `ShaderPass` + `OutputPass`), blitted cleanly into top/bottom split-screen halves.
  - Additive vertex-colored engine ribbon trails, streaky wall-contact spark pool, camera-space high-speed streak lines, procedural camera shake on impacts/landings/pads, reward HUD badges (`PERFECT LANDING +BOOST`, `DRIFT +`, `WALL IMPACT`), and standard Web Gamepad API support.

## Final Ship Tuning Table

| Parameter | VOLT (Speed / Drift) | ARC (Precision / Grip) | Shared / Physics |
| :--- | :---: | :---: | :---: |
| `topSpeed` (m/s) | `62` (~670 km/h) | `54` (~583 km/h) | `boostTopSpeedBonus = +32%` |
| `accel` (m/s²) | `46` | `40` | `thrustKnee = 0.70`, `boostThrustMult = 1.75` |
| `steerRate` (rad/s) | `1.50` | `1.92` | `steerSpeedTaper = 0.34` |
| `lateralGrip` (1/s) | `2.8` | `6.0` | `gripAirMult = 0.18` |
| `airbrake` | `32` | `52` | `airbrakeYawGain = 1.28`, `airbrakeComboYawBonus = 1.22`, `airbrakeSoloGripMult = 0.72`, `airbrakeComboGripMult = 1.65`, double-tap `SIDESHIFT` (`17.5 m/s` impulse) |
| `hoverK` / `hoverDamp` | `34` / `10.5` | `36` / `11.0` | `hoverHeight = 1.5 m`, `gravity = 16.5 m/s²` |

## Verification Summary (Headful Chrome on `:0`, fresh profile)
- Tested on both `http://127.0.0.1:8017/` (`1920×1080` window, **144 FPS locked** in split-screen via unified single `EffectComposer` + quarter-res `UnrealBloomPass` + combined `FXAA + Chroma` shader pass) and `file:///home/rogst/Documents/Hermes/games/wipeout-v2/index.html`.
- Standard arcade chase camera (`fovBase = 52 → 63`, `backDistance = 6.3`, `upDistance = 2.35`, springing relative offset so ships never pull away at 600+ km/h).
- Depth-tested (`depthTest: true`, `NormalBlending`) glossy ship & ribbon-trail reflections strictly on the road surface — 100% occluded by closer ships and barriers (never draws on top of other objects).
- `window.__errorCount === 0`, `0` console/page exceptions, and all assertions in `window.__physicsChecks()` pass (`true`).
