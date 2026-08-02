/**
 * Deterministic test harness.
 *
 * PhysicsEngine is driven by requestAnimationFrame and reads real frame
 * timestamps, so its output normally depends on the machine it runs on. This
 * shim replaces rAF with a queue we drain by hand, feeding synthetic timestamps
 * from a frame profile — which makes every run reproducible and lets us ask
 * "what does this spring do at 144Hz?" without a 144Hz display.
 *
 * The shim is installed globally for the duration of a run and restored after,
 * so tests can still use a real rAF if one exists.
 */

import PhysicsEngine from '../src/physics-engine.js';

/**
 * Frame profiles: (frameIndex) => delta in ms for that frame.
 * All of them average ~16.66ms except the explicit frame-rate ones, so any
 * difference between them isolates jitter rather than nominal rate.
 */
export const PROFILES = {
	fps30: () => 1000 / 30,
	fps60: () => 1000 / 60,
	fps120: () => 1000 / 120,
	fps144: () => 1000 / 144,
	// Two-frame alternation, ±0.1ms — a display that is nominally 60Hz.
	alternating: (i) => (i % 2 === 0 ? 16.76 : 16.56),
	// Smooth ±2ms wobble.
	wobble: (i) => 16.66 + Math.sin(i * 1.7) * 2,
	// Pseudo-random ±3ms. Hashed from the frame index rather than accumulated in
	// a closure: a stateful generator would carry its seed between runs and make
	// the profile unreproducible, which is the one thing this harness must not be.
	random: (i) => {
		const x = Math.sin((i + 1) * 12.9898) * 43758.5453;
		return 16.66 + (x - Math.floor(x) - 0.5) * 6;
	},
	// One long stall partway in, to exercise the delta clamp.
	stall: (i) => (i === 20 ? 120 : 16.66),
};

/**
 * Run a spring to completion against a frame profile.
 *
 * @param {Object} opts
 * @param {Function} opts.profile - (frameIndex) => ms delta
 * @param {number} [opts.attraction]
 * @param {number} [opts.friction]
 * @param {number} [opts.from]
 * @param {number} [opts.to]
 * @param {number} [opts.velocity]
 * @param {number} [opts.maxFrames] - Safety stop for a spring that never settles.
 * @returns {Promise<{samples: Array<[number, number]>, frames: number, elapsed: number, peak: number}>}
 */
export async function run({
	profile,
	attraction = 0.026,
	friction = 0.28,
	from = 0,
	to = 100,
	velocity = 0,
	maxFrames = 100000,
} = {}) {
	const queue = [];
	const realRAF = globalThis.requestAnimationFrame;
	globalThis.requestAnimationFrame = (fn) => queue.push(fn);

	try {
		const engine = new PhysicsEngine({ attraction, friction });
		const samples = [];
		let time = 0;

		// Timestamp each emission with the clock as of the frame that produced it.
		engine.on('change', (e) => samples.push([time, e.position]));

		const done = engine.animateTo(from, to, velocity);

		let i = 0;
		while (queue.length && i < maxFrames) {
			queue.shift()(time);
			time += profile(i++);
		}
		await done;

		const positions = samples.map(([, p]) => p);
		const overshootsUp = to >= from;
		return {
			samples,
			frames: i,
			elapsed: samples.length ? samples[samples.length - 1][0] : 0,
			peak: overshootsUp ? Math.max(...positions) : Math.min(...positions),
		};
	} finally {
		if (realRAF) globalThis.requestAnimationFrame = realRAF;
		else delete globalThis.requestAnimationFrame;
	}
}

/**
 * Position at an absolute elapsed time — the last sample at or before `ms`.
 *
 * Always compare runs at absolute times, never at frame indices: two profiles
 * put their Nth frame at different instants, so index-wise comparison reports
 * differences that are pure sampling artifact.
 *
 * @param {Array<[number, number]>} samples
 * @param {number} ms
 * @returns {number}
 */
export function at(samples, ms) {
	// The epsilon is load-bearing: accumulating 16.666… lands the 6th frame at
	// 100.00000000000001, and a strict `t > ms` would discard it and report the
	// position a whole frame earlier — which reads as a 14-unit engine
	// difference at 60fps that does not exist.
	const limit = ms + 1e-9;
	let out = samples.length ? samples[0][1] : 0;
	for (const [t, p] of samples) {
		if (t > limit) break;
		out = p;
	}
	return out;
}

/**
 * Position at an absolute elapsed time, linearly interpolated between the
 * bracketing samples.
 *
 * `at()` steps back to the previous sample, which is right for fixture
 * comparison but wrong for comparing two frame profiles: their samples land at
 * different instants, so a step-back lookup compares x(100ms) against x(97.2ms)
 * and reports the gap as an engine difference. Interpolating removes that,
 * leaving only the interpolation error itself — keep the reference profile dense
 * so that stays negligible.
 *
 * @param {Array<[number, number]>} samples
 * @param {number} ms
 * @returns {number}
 */
export function interpolateAt(samples, ms) {
	if (!samples.length) return 0;
	if (ms <= samples[0][0]) return samples[0][1];

	for (let i = 1; i < samples.length; i++) {
		const [t1, p1] = samples[i];
		if (t1 < ms) continue;
		const [t0, p0] = samples[i - 1];
		if (t1 === t0) return p1;
		return p0 + ((p1 - p0) * (ms - t0)) / (t1 - t0);
	}
	return samples[samples.length - 1][1];
}

/** Absolute times every run is sampled at, for fixture comparison. */
export const SAMPLE_TIMES = [50, 100, 150, 200, 300, 400, 500, 700, 1000, 1500, 2000];

/** Parameter sets worth characterising — spread across the useful range. */
export const PARAM_SETS = {
	default: { attraction: 0.026, friction: 0.28 },
	bouncy: { attraction: 0.08, friction: 0.22 },
	stiff: { attraction: 0.2, friction: 0.5 },
	slow: { attraction: 0.01, friction: 0.15 },
};
