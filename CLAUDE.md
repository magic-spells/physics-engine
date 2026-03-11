# @magic-spells/physics-engine

## Purpose

1D spring physics interpolation engine. Animates a numeric value from a start position to an end position using a spring-damper model. This is NOT a rigid-body or collision engine — it produces a single interpolated value and progress (0-1) on each frame, meant to drive animations via events.

## Key files

- `src/physics-engine.js` — The entire library (single class, extends EventEmitter)
- `src/event-emitter.js` — Vendored EventEmitter base class (on/off/emit/removeAllListeners)
- `dist/` — UMD and ESM builds
- `demo/index.html` — Manual testing page (served on port 3008 in dev mode)
- `vite.config.js` — Library build config (UMD + ESM output to `dist/`)

## Commands

- `npm run build` — Vite production build (minified, outputs to `dist/`)
- `npm run dev` — Vite dev server with HMR at localhost:3008 (opens `demo/index.html`)
- `npm run prod` — Vite production build with watch mode

## Architecture

**Spring-damper model**: Each frame computes `force = (target - current) * attraction`, adds force to velocity, then damps velocity by `friction`. Position updates by `velocity * timeDeltaFactor`. The time delta is normalized to a 16.66ms baseline (60 FPS) so the spring feels consistent across frame rates.

Animation settles when both position and velocity are within 0.01 of the target. Progress is computed as `(current - start) / (target - start)` and intentionally overshoots past 1 during spring oscillation, settling to exactly 1 on completion.

`animateTo(startValue, endValue, velocity)` returns a Promise that resolves on completion or when `stop()` is called. Calling `animateTo` while already animating silently resolves the previous Promise (no `stop` event) and starts the new animation. Recommended distance (`endValue - startValue`) is 1000.

## Conventions

- Private class fields (`#`) for all internal state
- No TypeScript, no tests, no linter
- `attraction` and `friction` must be exclusive (0, 1) — constructor and setters validate
- EventEmitter is vendored locally (not an npm dependency)
- UMD global name: `PhysicsEngine`

## Testing

No test suite. Use the demo page (`npm run dev`) for manual testing.
