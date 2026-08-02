/**
 * Golden-master test: the engine must reproduce test/fixtures/baseline.json.
 *
 * This is not a correctness test — the fixture records what the engine did at
 * v1.0.1, bugs included. Its job is to make any behavioural change visible and
 * deliberate. When the frame-rate work lands, the cases that change are exactly
 * the ones this file will fail on, and each failure should be one you can
 * explain before you regenerate the fixture.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, at, PROFILES, PARAM_SETS } from './harness.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const baseline = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/baseline.json'), 'utf8'));

const CASES = {
	span100: { from: 0, to: 100, velocity: 0 },
	span1: { from: 0, to: 1, velocity: 0 },
	span1200: { from: 0, to: 1200, velocity: 0 },
	'span100-vel50': { from: 0, to: 100, velocity: 50 },
	negative: { from: 100, to: 0, velocity: 0 },
};

// The fixture stores 6 decimal places, so it cannot be compared more tightly
// than it was written. Replaying the same arithmetic is otherwise exact.
const EPSILON = 1e-6;

for (const [key, expected] of Object.entries(baseline.results)) {
	const [paramName, caseName, profileName] = key.split('/');

	test(`baseline ${key}`, async () => {
		const r = await run({
			profile: PROFILES[profileName],
			...PARAM_SETS[paramName],
			...CASES[caseName],
		});

		baseline.sampleTimes.forEach((ms, i) => {
			assert.ok(
				Math.abs(at(r.samples, ms) - expected.positions[i]) < EPSILON,
				`position at ${ms}ms: got ${at(r.samples, ms)}, baseline ${expected.positions[i]}`
			);
		});
		assert.ok(
			Math.abs(r.peak - expected.peak) < EPSILON,
			`peak: got ${r.peak}, baseline ${expected.peak}`
		);
		assert.ok(
			Math.abs(r.elapsed - expected.settleMs) < EPSILON,
			`settle: got ${r.elapsed}ms, baseline ${expected.settleMs}ms`
		);
	});
}
