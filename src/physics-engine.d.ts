import EventEmitter from '@magic-spells/event-emitter';

/** Payload for the `change` and `complete` events. */
export interface PhysicsEvent {
  /** Current interpolated position. */
  position: number;
  /**
   * Progress from `startValue` to `endValue`, as `(current - start) / (target - start)`.
   * Intentionally overshoots past 1 while the spring oscillates, and settles to
   * exactly 1 on completion. Do not clamp it — the overshoot is the point.
   */
  progress: number;
}

/** Payload for the `stop` event. */
export interface StopEvent {
  /** Position at the moment `stop()` was called. */
  position: number;
}

export interface PhysicsEngineOptions {
  /** Spring stiffness. Must be in the exclusive range (0, 1). Default `0.026`. */
  attraction?: number;
  /** Per-frame velocity decay. Must be in the exclusive range (0, 1). Default `0.28`. */
  friction?: number;
}

export interface PhysicsEngineEvents {
  change: (event: PhysicsEvent) => void;
  complete: (event: PhysicsEvent) => void;
  stop: (event: StopEvent) => void;
}

/**
 * 1D spring physics interpolation engine.
 *
 * Solves a damped harmonic oscillator analytically and evaluates it at the
 * elapsed time on every frame, so the trajectory is frame-rate independent.
 * Time is measured in 16.66ms units, which makes `attraction`, `friction` and
 * velocity frame-relative rather than per-second quantities.
 */
export default class PhysicsEngine extends EventEmitter {
  constructor(options?: PhysicsEngineOptions);

  /** `true` while an animation is in progress. */
  isAnimating: boolean;

  /**
   * Animate from `startValue` to `endValue`.
   * Resolves when the spring settles or `stop()` is called. Calling this while
   * already animating silently resolves the previous promise (no `stop` event).
   * @param velocity Initial velocity, in units per 16.66ms frame. Default `0`.
   */
  animateTo(startValue: number, endValue: number, velocity?: number): Promise<void>;

  /** Halt the current animation. Emits `stop` and resolves the pending promise. */
  stop(): void;

  /**
   * Current velocity, in units per 16.66ms frame — the same units `animateTo()`
   * accepts, so it can be handed straight back in to retarget without losing
   * momentum.
   */
  getVelocity(): number;

  /**
   * Update attraction while running or idle. Re-solves from the current
   * position and velocity so motion stays continuous.
   * @throws If `attraction` is not in the exclusive range (0, 1).
   */
  setAttraction(attraction: number): void;

  /**
   * Update friction while running or idle. Re-solves from the current position
   * and velocity so motion stays continuous.
   * @throws If `friction` is not in the exclusive range (0, 1).
   */
  setFriction(friction: number): void;

  on<K extends keyof PhysicsEngineEvents>(event: K, listener: PhysicsEngineEvents[K]): this;
  off<K extends keyof PhysicsEngineEvents>(event: K, listener: PhysicsEngineEvents[K]): this;
  removeAllListeners(event?: keyof PhysicsEngineEvents): this;
}
