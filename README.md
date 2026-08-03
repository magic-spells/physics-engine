# @magic-spells/physics-engine

Spring physics engine for smooth, natural animations. Drives a numeric value from start to end using a spring-damper model, emitting position and progress on every frame.

🔍 **[Live Demo](https://magic-spells.github.io/physics-engine/demo/)** - See it in action!

## Uses

- [`@magic-spells/event-emitter`](https://github.com/magic-spells/event-emitter) — the
  `on`/`off`/`emit`/`removeAllListeners` base class this engine extends. The only
  dependency, installed automatically with this package.

The ESM build lists it as a dependency rather than bundling it, so a project that
also pulls in other `@magic-spells` packages resolves a single shared copy instead
of one per package. The UMD build bundles it, since a script tag has no npm to
dedupe with — that inlined copy is the whole 0.09 kB difference between the two
size numbers below.

## Size & scope

**1.35 kB** gzipped (ESM core — event-emitter installs alongside via npm) · **1.44 kB** gzipped (UMD core, script-tag ready, self-contained). Ships TypeScript definitions.

This is a 1D interpolator, not a rigid-body or collision engine. It gives you one numeric value and a progress ratio per frame, frame-rate independent, and leaves it to you to map those onto whatever you're animating. You do **not** get collisions, multi-body simulation, or a scrubbing playhead.

## Install

```bash
npm install @magic-spells/physics-engine
```

```js
import PhysicsEngine from '@magic-spells/physics-engine';
```

```html
<!-- CDN (UMD) — exposes window.PhysicsEngine, self-contained -->
<script src="https://unpkg.com/@magic-spells/physics-engine/dist/physics-engine.min.js"></script>
```

## Usage

```js
const spring = new PhysicsEngine({ attraction: 0.026, friction: 0.28 });

spring.on('change', ({ position, progress }) => {
  element.style.transform = `translateX(${position}px)`;
});

await spring.animateTo(0, 400);
```

Chained animations with initial velocity:

```js
const spring = new PhysicsEngine({ attraction: 0.02, friction: 0.14 });

spring.on('change', ({ position, progress }) => {
  element.style.opacity = progress;
  element.style.transform = `translateY(${position}px)`;
});

// Animate forward, then back with carry-over velocity
await spring.animateTo(0, 300, 100);
await spring.animateTo(300, 0, -50);
```

## API reference

### `new PhysicsEngine({ attraction?, friction? })`

Create a spring engine.

- **attraction** `number` — Spring stiffness. Default `0.026`. Must be in range (0, 1) exclusive.
- **friction** `number` — Velocity damping. Default `0.28`. Must be in range (0, 1) exclusive.

Throws if either value is outside the valid range.

### `animateTo(startValue, endValue, velocity?) -> Promise`

Animate from `startValue` to `endValue`. Returns a Promise that resolves when the spring settles or `stop()` is called.

- **startValue** `number` — Starting position.
- **endValue** `number` — Target position.
- **velocity** `number` — Initial velocity. Default `0`.

If called while already animating, the previous animation is silently stopped and its Promise resolves.

### `stop()`

Halts the current animation. Emits a `stop` event and resolves the pending Promise.

### `getVelocity()`

Returns the current velocity, in units per 16.66ms frame — the same units `animateTo()` accepts, so it can be handed straight back in to retarget an animation without losing momentum.

```js
let current = 0;
spring.on('change', ({ position }) => { current = position; });

// Redirect mid-flight without losing momentum
spring.animateTo(current, newTarget, spring.getVelocity());
```

### `setAttraction(n)`

Update attraction while running or idle. Throws if `n` is not in (0, 1).

### `setFriction(n)`

Update friction while running or idle. Throws if `n` is not in (0, 1).

### `isAnimating`

Boolean property. `true` while an animation is in progress.

## Events

| Event | Payload | When |
|-------|---------|------|
| `change` | `{ position, progress }` | Every animation frame |
| `complete` | `{ position, progress }` | Spring has settled at the target |
| `stop` | `{ position }` | `stop()` was called |

Register and remove listeners with `on`, `off`, and `removeAllListeners`:

```js
function onChange({ position, progress }) { /* ... */ }

spring.on('change', onChange);
spring.off('change', onChange);
spring.removeAllListeners('change'); // remove all for one event
spring.removeAllListeners();         // remove all listeners
```

All three methods return the instance for chaining.

## How it works

The engine solves the damped harmonic oscillator analytically and evaluates it at the elapsed time on every frame. `attraction` is the spring constant and `friction` is the per-frame velocity decay; together they give a natural frequency of `√attraction` and a damping ratio of `−ln(1 − friction) / (2√attraction)`, so all three regimes — underdamped, critically damped and overdamped — are covered. The animation settles when both position and velocity are within 0.01 of the target.

Because position is a function of elapsed time rather than an accumulation of per-frame steps, the trajectory does not depend on how the frames land. A 30Hz display, a 144Hz display and a page that drops a frame all follow the same path; refresh rate only decides how often that path is sampled.

Time is measured in 16.66ms units, which is what makes `attraction`, `friction` and the velocity `animateTo()` accepts frame-relative quantities rather than per-second ones.

## Changelog

> **Breaking in 2.0.0.** The package is now ESM-only — the `require` condition has
> been removed, so CommonJS consumers must either move to `import` or load the UMD
> build directly. `EventEmitter` is no longer vendored into the source; it is now a
> dependency on `@magic-spells/event-emitter`, which npm installs automatically.
> Behaviour of the spring itself is unchanged from 1.1.0. Also in this release:
> TypeScript definitions, and a Vite 8 two-pass build.

> **Changed in 1.1.0.** Earlier versions integrated the spring one frame at a time and scaled each step by the frame delta. That made the motion depend on refresh rate — overshoot measured about 3% lower at 30Hz than at 144Hz — and a single dropped frame stretched the animation, because deltas were clamped at 64ms and the excess was discarded. Curves are very slightly springier now: the old integrator consistently undershot the true solution.

## License

MIT

---

<p align="center">
  Made by <a href="https://github.com/coryschulz">Cory Schulz</a>
</p>
