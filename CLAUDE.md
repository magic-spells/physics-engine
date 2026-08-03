# @magic-spells/physics-engine

## Purpose

1D spring physics interpolation engine. Animates a numeric value from a start position to an end position using a spring-damper model. This is NOT a rigid-body or collision engine — it produces a single interpolated value and progress (0-1) on each frame, meant to drive animations via events.

## Key files

- `src/physics-engine.js` — The entire library (single class, extends EventEmitter)
- `src/physics-engine.d.ts` — Hand-written TypeScript definitions, copied to `dist/` by a `closeBundle` plugin
- `dist/` — ESM and UMD builds plus the copied `.d.ts`
- `demo/index.html` — Manual testing page (served on port 3008 in dev mode). Loads the UMD build from `dist/`, so **run `npm run build` before the demo reflects a source change.**
- `demo/vendor/` — Sibling `.min.js` deps the demo script-tags (e.g. frame-engine)
- `vite.config.js` — Two-pass library build config (see Architecture)
- `test/harness.js` — Deterministic test harness: stubs `requestAnimationFrame`/`performance.now` so animations run synchronously at a chosen frame rate
- `test/fixtures/baseline.json` — Recorded v1.0.1 trajectories, used as the behaviour baseline
- `scripts/generate-baseline.js` — Regenerates `test/fixtures/baseline.json`
- `scripts/report.js` — Prints a human-readable trajectory comparison

## Commands

- `npm run build` — Two Vite passes (`BUILD_FORMAT=es`, then `umd`), outputs to `dist/`
- `npm run dev` — Vite dev server with HMR at localhost:3008 (opens `demo/index.html`)
- `npm run prod` — Vite production build with watch mode
- `npm test` — Node's built-in test runner over `test/*.test.js`
- `npm run baseline` — Regenerate the baseline fixture
- `npm run report` — Print a trajectory comparison report

## Architecture

**Analytic damped harmonic oscillator** (changed in 1.1.0 — earlier versions integrated per frame). `#deriveCoefficients` converts `attraction` and `friction` into a natural frequency `√attraction` and damping ratio `−ln(1 − friction) / (2√attraction)`, then solves the closed form for the underdamped, critically damped, or overdamped regime. `#solve(frames)` evaluates that solution at an elapsed time; each frame just samples it.

Because position is a function of elapsed time rather than an accumulation of steps, the trajectory is frame-rate independent: 30Hz, 144Hz, and a dropped frame all follow the same path, and refresh rate only decides sampling density. Time is measured in 16.66ms units, which is what makes `attraction`, `friction`, and velocity frame-relative rather than per-second quantities.

`setAttraction` / `setFriction` mid-animation call `#reseed`, which re-solves from the current position and velocity and restarts the clock, so the motion stays continuous.

Animation settles when both position and velocity are within 0.01 of the target. Progress is computed as `(current - start) / (target - start)` and **intentionally overshoots past 1** during spring oscillation — never clamp it — settling to exactly 1 on completion.

`animateTo(startValue, endValue, velocity)` returns a Promise that resolves on completion or when `stop()` is called. Calling `animateTo` while already animating silently resolves the previous Promise (no `stop` event) and starts the new animation. Recommended distance (`endValue - startValue`) is 1000. `getVelocity()` returns the current velocity in the same units `animateTo` accepts, so momentum can be carried into a retarget.

**Two-pass build**: Vite applies `rollupOptions.external` per build, so the formats cannot share one pass. `BUILD_FORMAT=es` externalizes `@magic-spells/event-emitter` (npm consumers dedupe to one copy) and clears `dist/`; `BUILD_FORMAT=umd` then bundles the emitter for self-contained script-tag use and must **not** clear `dist/`, which is why `emptyOutDir` is keyed off the format. A `closeBundle` plugin copies `src/physics-engine.d.ts` into `dist/`.

## Conventions

- Private class fields (`#`) for all internal state
- Source is plain JS; types are hand-maintained in `src/physics-engine.d.ts` and must be updated alongside any API change. No linter.
- `attraction` and `friction` must be exclusive (0, 1) — constructor and setters validate
- EventEmitter comes from `@magic-spells/event-emitter` (a real dependency, not vendored) so projects also using `animation-engine` / `frame-engine` share one copy
- **ESM and UMD only — no CJS.** The `exports` map has no `require` condition; script-tag users get the UMD build via `unpkg`/`jsdelivr`.
- UMD global name: `PhysicsEngine`
- Only `dist/` is published (`files` field in package.json); `prepublishOnly` rebuilds it

## Testing

`npm test` runs two suites against the deterministic harness in `test/harness.js`:

- `test/consistency.test.js` — the correctness suite. Asserts frame-rate independence, jitter and dropped-frame tolerance, scale invariance, settle behaviour, and that a `change` listener may call `stop()` on the settling frame.
- `test/baseline.test.js` — a **golden master pinned to v1.0.1**, bugs included. It is not a correctness test; its job is to make behavioural change visible and deliberate. The 1.1.0 analytic rewrite intentionally changed these trajectories, so these cases fail until the fixture is regenerated with `npm run baseline`. Regenerate only once each failure is one you can explain.

Use the demo page (`npm run dev`) for manual/visual testing.
