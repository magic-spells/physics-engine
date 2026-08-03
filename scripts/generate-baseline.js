/**
 * Records the CURRENT engine's behaviour to test/fixtures/baseline.json.
 *
 * Run this once against the engine as it stands, commit the fixture, then leave
 * it alone: it is the reference picture every later change is measured against.
 * Re-running it after a change overwrites the evidence — that is the point of
 * committing it, so a rewrite has to be a deliberate act.
 *
 *   npm run baseline
 *
 * This lives in scripts/ rather than test/ for exactly that reason: `node --test`
 * executes every file under test/, so while it sat there `npm test` silently ran
 * it and rewrote the fixture with whatever the engine currently does — quietly
 * destroying the evidence the golden-master test exists to preserve.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, at, PROFILES, SAMPLE_TIMES, PARAM_SETS } from '../test/harness.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Spans and velocities: distance is scale-invariant from rest, velocity is not. */
const CASES = [
	{ name: 'span100', from: 0, to: 100, velocity: 0 },
	{ name: 'span1', from: 0, to: 1, velocity: 0 },
	{ name: 'span1200', from: 0, to: 1200, velocity: 0 },
	{ name: 'span100-vel50', from: 0, to: 100, velocity: 50 },
	{ name: 'negative', from: 100, to: 0, velocity: 0 },
];

const round = (n) => Number(n.toFixed(6));

const out = {
	note: 'Behaviour of physics-engine 1.1.0, the analytic damped-oscillator solver. Do not regenerate casually.',
	sampleTimes: SAMPLE_TIMES,
	results: {},
};

for (const [paramName, params] of Object.entries(PARAM_SETS)) {
	for (const testCase of CASES) {
		for (const [profileName, profile] of Object.entries(PROFILES)) {
			const key = `${paramName}/${testCase.name}/${profileName}`;
			const r = await run({
				profile,
				...params,
				from: testCase.from,
				to: testCase.to,
				velocity: testCase.velocity,
			});
			out.results[key] = {
				positions: SAMPLE_TIMES.map((ms) => round(at(r.samples, ms))),
				peak: round(r.peak),
				settleMs: round(r.elapsed),
				frames: r.frames,
			};
		}
	}
}

mkdirSync(resolve(__dirname, '../test/fixtures'), { recursive: true });
const path = resolve(__dirname, '../test/fixtures/baseline.json');
writeFileSync(path, `${JSON.stringify(out, null, '\t')}\n`);
console.log(`wrote ${Object.keys(out.results).length} cases to ${path}`);
