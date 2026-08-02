/**
 * Human-readable summary of the invariants under test. Run before and after the
 * frame-rate work to see what moved:
 *
 *   node test/report.js
 */

import { run, at, PROFILES, PARAM_SETS } from './harness.js';

const params = PARAM_SETS.bouncy;
const pad = (s, n) => String(s).padStart(n);

console.log(`spring: attraction ${params.attraction}, friction ${params.friction}, 0 → 100\n`);

console.log('FRAME RATE');
console.log('  profile |  p@100ms |  p@300ms |  p@500ms |     peak | settle ms');
for (const name of ['fps30', 'fps60', 'fps120', 'fps144']) {
	const r = await run({ profile: PROFILES[name], ...params });
	console.log(
		`  ${pad(name, 11)} | ${pad(at(r.samples, 100).toFixed(4), 8)} | ${pad(at(r.samples, 300).toFixed(4), 8)} | ${pad(at(r.samples, 500).toFixed(4), 8)} | ${pad(r.peak.toFixed(4), 8)} | ${pad(r.elapsed.toFixed(0), 9)}`
	);
}

console.log('\nJITTER (all ~16.66ms mean)');
console.log('  profile |  p@100ms |  p@300ms |  p@500ms |     peak | settle ms');
for (const name of ['fps60', 'alternating', 'wobble', 'random', 'stall']) {
	const r = await run({ profile: PROFILES[name], ...params });
	console.log(
		`  ${pad(name, 11)} | ${pad(at(r.samples, 100).toFixed(4), 8)} | ${pad(at(r.samples, 300).toFixed(4), 8)} | ${pad(at(r.samples, 500).toFixed(4), 8)} | ${pad(r.peak.toFixed(4), 8)} | ${pad(r.elapsed.toFixed(0), 9)}`
	);
}

console.log('\nSPAN (normalized — shape is scale-invariant, duration is not)');
console.log('     span | norm@300ms | settle ms');
for (const to of [1, 100, 1200]) {
	const r = await run({ profile: PROFILES.fps60, ...params, to });
	console.log(`  ${pad(to, 7)} | ${pad((at(r.samples, 300) / to).toFixed(6), 10)} | ${pad(r.elapsed.toFixed(0), 9)}`);
}

console.log('\nFIRST FRAME');
for (const name of ['fps30', 'fps60', 'fps144']) {
	const r = await run({ profile: PROFILES[name], ...params });
	const first = r.samples.find(([, p]) => p !== 0);
	console.log(`  ${pad(name, 11)}: first movement at ${first[0].toFixed(2)}ms`);
}
