# @magic-spells/physics-engine

**~1.1 KB** gzipped

Spring physics engine for smooth, natural animations. Drives a numeric value from start to end using a spring-damper model, emitting position and progress on every frame.

🔍 **[Live Demo](https://magic-spells.github.io/physics-engine/demo/)** - See it in action!

## Install

```bash
npm install @magic-spells/physics-engine
```

```js
import PhysicsEngine from '@magic-spells/physics-engine';
```

```html
<!-- CDN (UMD) — exposes window.PhysicsEngine -->
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

Each frame the engine computes a spring force (`(target - current) * attraction`), adds it to the velocity, damps the velocity by friction, and advances the position. The time delta is normalized to a 16.66ms baseline so the spring behaves consistently across different frame rates. The animation settles when both position and velocity are within 0.01 of the target.

## License

MIT

---

<p align="center">
  Made by <a href="https://github.com/coryschulz">Cory Schulz</a>
</p>
