/**
 * The invariants the engine must hold. These were written against v1.0.1, which
 * failed all five — they were the specification for the closed-form rewrite, and
 * the `{ todo: true }` flags came off as each one started passing.
 *
 * One remains: `settle time does not depend on the span`. The settle threshold is
 * absolute (`|displacement| < 0.01`), so a 0->1 spring settles in half the time a
 * 0->100 one does. Making it relative changes duration for anyone animating small
 * spans, which is a 2.0.0 change — deliberately deferred, not overlooked.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, at, interpolateAt, PROFILES, PARAM_SETS } from './harness.js';

/** Positions must agree to this much of the span (1% of a 100-unit move). */
const TOLERANCE = 1;
const TIMES = [100, 200, 300, 500, 800];

/**
 * Compare every profile against a dense reference at absolute elapsed times.
 *
 * The reference runs at 1000fps so that interpolating it introduces error well
 * below the tolerance — what is left is genuine disagreement about where the
 * spring is at a given moment, which is exactly what we are testing for.
 *
 * @param {string[]} profileNames
 * @param {Object} params
 */
async function maxDeviationFromReference(profileNames, params) {
	const dense = () => 1;
	const reference = await run({ profile: dense, ...params });
	let worst = { deviation: 0, profile: null, ms: null };

	for (const name of profileNames) {
		const r = await run({ profile: PROFILES[name], ...params });
		for (const ms of TIMES) {
			const deviation = Math.abs(interpolateAt(r.samples, ms) - interpolateAt(reference.samples, ms));
			if (deviation > worst.deviation) worst = { deviation, profile: name, ms };
		}
	}
	return worst;
}

test('frame rate does not change the trajectory', async () => {
	const worst = await maxDeviationFromReference(['fps30', 'fps120', 'fps144'], PARAM_SETS.bouncy);
	assert.ok(
		worst.deviation < TOLERANCE,
		`${worst.profile} deviates ${worst.deviation.toFixed(4)} units from the dense reference at ${worst.ms}ms`
	);
});

test('frame-time jitter does not change the trajectory', async () => {
	const worst = await maxDeviationFromReference(
		['alternating', 'wobble', 'random'],
		PARAM_SETS.bouncy
	);
	assert.ok(
		worst.deviation < TOLERANCE,
		`${worst.profile} deviates ${worst.deviation.toFixed(4)} units from the dense reference at ${worst.ms}ms`
	);
});

test('a dropped frame does not stretch the animation', async () => {
	const smooth = await run({ profile: PROFILES.fps60, ...PARAM_SETS.bouncy });
	const janky = await run({ profile: PROFILES.stall, ...PARAM_SETS.bouncy });
	const drift = Math.abs(janky.elapsed - smooth.elapsed);
	assert.ok(drift < 20, `one 120ms stall moved settle time by ${drift.toFixed(0)}ms`);
});

test('settle time does not depend on the span', { todo: true }, async () => {
	const runs = await Promise.all(
		[1, 100, 1200].map((to) => run({ profile: PROFILES.fps60, ...PARAM_SETS.bouncy, to }))
	);
	const times = runs.map((r) => r.elapsed);
	const spread = Math.max(...times) - Math.min(...times);
	assert.ok(spread < 20, `settle times across spans 1/100/1200: ${times.join(', ')}ms`);
});

test('the first frame emits at elapsed zero', async () => {
	// The old engine consumed its first rAF purely to seed a timestamp and
	// returned without emitting, so the animation started a frame late — by a
	// different amount on every refresh rate. Asserting "has moved within 16.67ms"
	// would be unfair instead: at 30fps the first frame after t=0 lands at
	// 33.33ms, and no engine can paint sooner than the display allows. What we
	// can require is that frame one reports the start position rather than
	// nothing at all.
	for (const profile of ['fps30', 'fps60', 'fps144']) {
		const r = await run({ profile: PROFILES[profile], ...PARAM_SETS.bouncy, from: 0, to: 100 });
		assert.equal(r.samples[0][0], 0, `${profile}: first sample not at elapsed 0`);
		assert.equal(r.samples[0][1], 0, `${profile}: first sample not at the start position`);
	}
});

// --- Invariants that already hold. These are NOT todo: they must never break. ---

test('a spring from rest is scale-invariant', async () => {
	const runs = await Promise.all(
		[1, 100, 1200].map((to) => run({ profile: PROFILES.fps60, ...PARAM_SETS.bouncy, to }))
	);
	const normalized = runs.map((r, i) => at(r.samples, 300) / [1, 100, 1200][i]);
	const spread = Math.max(...normalized) - Math.min(...normalized);
	assert.ok(spread < 1e-9, `normalized position at 300ms varies by ${spread}`);
});

test('a spring settles at its target', async () => {
	for (const [name, params] of Object.entries(PARAM_SETS)) {
		const r = await run({ profile: PROFILES.fps60, ...params, to: 100 });
		assert.equal(r.samples[r.samples.length - 1][1], 100, `${name} did not land on target`);
	}
});
