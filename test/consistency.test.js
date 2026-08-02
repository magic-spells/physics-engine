/**
 * The invariants we WANT. Every test here is marked `todo` because the v1.0.1
 * engine fails them — they are the specification for the frame-rate work, not a
 * description of current behaviour. Node reports todo failures without failing
 * the run, so the suite stays green while the gap stays visible.
 *
 * When the rework lands, delete the `{ todo: true }` flags. Any that still fail
 * is work that is not finished.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, at, PROFILES, PARAM_SETS } from './harness.js';

/** Positions must agree to this much of the span (1% of a 100-unit move). */
const TOLERANCE = 1;
const TIMES = [100, 200, 300, 500, 800];

/**
 * Compare every profile against the 60fps reference at absolute elapsed times.
 * @param {string[]} profileNames
 * @param {Object} params
 */
async function maxDeviationFrom60(profileNames, params) {
	const reference = await run({ profile: PROFILES.fps60, ...params });
	let worst = { deviation: 0, profile: null, ms: null };

	for (const name of profileNames) {
		const r = await run({ profile: PROFILES[name], ...params });
		for (const ms of TIMES) {
			const deviation = Math.abs(at(r.samples, ms) - at(reference.samples, ms));
			if (deviation > worst.deviation) worst = { deviation, profile: name, ms };
		}
	}
	return worst;
}

test('frame rate does not change the trajectory', { todo: true }, async () => {
	const worst = await maxDeviationFrom60(['fps30', 'fps120', 'fps144'], PARAM_SETS.bouncy);
	assert.ok(
		worst.deviation < TOLERANCE,
		`${worst.profile} deviates ${worst.deviation.toFixed(4)} units from 60fps at ${worst.ms}ms`
	);
});

test('frame-time jitter does not change the trajectory', { todo: true }, async () => {
	const worst = await maxDeviationFrom60(
		['alternating', 'wobble', 'random'],
		PARAM_SETS.bouncy
	);
	assert.ok(
		worst.deviation < TOLERANCE,
		`${worst.profile} deviates ${worst.deviation.toFixed(4)} units from 60fps at ${worst.ms}ms`
	);
});

test('a dropped frame does not stretch the animation', { todo: true }, async () => {
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

test('the first frame is not discarded', { todo: true }, async () => {
	// At 60fps the spring should have moved by the end of the first frame.
	const r = await run({ profile: PROFILES.fps60, ...PARAM_SETS.bouncy });
	const firstMotion = r.samples.find(([, p]) => p !== 0);
	assert.ok(
		firstMotion && firstMotion[0] <= 16.67,
		`first movement at ${firstMotion ? firstMotion[0].toFixed(2) : 'never'}ms, expected within one frame`
	);
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
