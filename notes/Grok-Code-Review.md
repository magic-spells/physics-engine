# Deep review: `@magic-spells/physics-engine` (1.1.0)

**Scope:** full library + the frame-rate rewrite on `release/1.1.0` vs `main` (v1.0.1). Read-only — no code changes.

**Measured:** min bundle **2981 → 3956** B raw, gzip **~1109 → 1501** B. Consistency suite **green**. Baseline suite **160 red**.

---

## Architecture overview

Single-class spring engine (`PhysicsEngine` → vendored `EventEmitter`). 1.1.0 replaces per-frame Euler integration with a closed-form damped harmonic oscillator: `#deriveCoefficients` / `#solve` / `#reseed`, sampled on rAF from absolute elapsed time in `FRAME_MS` units. That is the right model for frame-rate independence. Surface area stays small; tests are a deterministic rAF harness plus golden-master + invariant suites.

---

## Findings

### Critical

No critical findings.

---

### Important

#### 1. Golden-master baseline still points at v1.0.1 — `npm test` is fully red

**Location:** `test/baseline.test.js`, `test/fixtures/baseline.json`  
**Fix effort:** Contained  
**Confidence:** 95  
**Tag:** Introduced (release unfinished, not a solver bug)

The fixture is explicitly the **pre-rewrite** trajectory. Every baseline case fails under the analytic solver (e.g. position drift at 50ms). Consistency tests pass and prove the actual 1.1.0 goals (rate independence, stall behavior, first-frame emit, reentrant `stop`).

That matches the comments in the test file — fail, explain, **then regenerate**. Regeneration has not landed yet, so the default test script is red on the release branch.

**Why it matters:** Anyone running `npm test` (CI, contributor, you in six months) sees 160 failures and has to know the intentional gate. Not a runtime bug, but it blocks a clean 1.1.0 ship signal.

**Suggested approach:**

1. Keep `BEFORE.txt` / `AFTER.txt` (or a short changelog note) as the human “what moved” record.
2. Run `npm run baseline` once, deliberately, after you’re happy with the feel.
3. Commit the new fixture as the **1.1.0** golden master and update the fixture note so it no longer says “BEFORE the frame-rate work.”

Do **not** loosen epsilon to make old numbers pass — the curves really did change (slightly springier; documented in README).

---

### Minor

#### 2. Zero-span + nonzero velocity: progress stays `0` until complete

**Location:** `src/physics-engine.js` ~194–198, 232–237, 249–254  
**Fix effort:** Contained  
**Tag:** Pre-existing (same progress model as v1.0.1)

`animateTo(x, x, v)` with `v ≠ 0` still runs (momentum around a point). `totalDistance === 0` forces `progress = 0` every frame; settle snaps to `progress: 1`. README’s opacity-from-progress pattern would stay flat then jump.

**Why it matters:** Rare API use, but surprising if someone retargets in place with velocity.

**Suggested approach:** Only if you care about this call shape — e.g. treat “no distance” as progress `1` always, or skip progress and document it. Not worth a redesign for 1.1.0 unless you hit it in product code.

---

#### 3. Gzip grew for real reasons — not much dead weight to cut

**Location:** `src/physics-engine.js` `#deriveCoefficients` / `#solve` / `#reseed`; `vite.config.js`  
**Fix effort:** Contained (micro) / skip (macro)  
**Confidence:** 88

~**+400 B gzip** is almost entirely the three closed-form regimes + mid-flight reseed. That is the feature. There is no large dead path in the library.

**Worth doing only if you want free nickels:**

| Idea | Approx value | Notes |
|------|----------------|-------|
| Shared `(0,1)` validator for constructor / setters | tiny | Dedupes long error strings |
| Regime as `0/1/2` instead of `'critical'/'under'/'over'` | tiny | |
| Drop `build.esbuild.keepNames: true` | ~0 | Mis-nested / ineffective; min already mangles `class c` |
| Shorter validation error strings | tiny | |
| Delete three regimes / EventEmitter / reseed | large but wrong | Breaks correctness or API |

**Not worth it:** rewriting the solver for size, stripping EventEmitter features, “minifying by hand” in source, or inventing a smaller half-correct underdamped-only path.

Published package is `dist/` only (`package.json` `files`) — demo cruft does not affect npm size. Demo already imports live `../src/physics-engine.js`.

---

#### 4. Small doc/test drift (not engine bugs)

**Fix effort:** Trivial

- `test/harness.js` stall profile comment still says it exercises a **delta clamp** — that clamp died with the integrator.
- `scripts/report.js` header still says `node test/report.js`; real entry is `npm run report` / `scripts/report.js`.
- `Claude.md` says consistency covers mid-flight parameter changes; there is **no** `setAttraction` / `setFriction` continuity test (reseed path is untested beyond manual reasoning). Optional one-liner test would lock the reseed contract.

---

### Nit

- Settle emits snapped `position: target` but leaves `#currentValue` / `#velocity` as residuals (`getVelocity()` ~`1e-3` after complete). Pre-existing; only matters if you chain on post-complete velocity and expect exact `0`.
- Early `animateTo(a,a,0)` emits complete without writing internal target state. Pre-existing; only events matter for normal use.

---

## Strengths

- Analytic sampling is the correct fix for rate/jitter/stall dependence; BEFORE/AFTER numbers show the win clearly.
- Post-`change` guard for reentrant `stop` / `animateTo` is deliberate and tested — several “race” claims against this code do **not** hold.
- Long background gaps (even multi-hour) still settle cleanly; near-critical parameter edges stayed finite in probes.
- Harness is careful (absolute-time compare, interpolate vs step-back, reproducible “random” profile).
- Size still ~1.5 KB gzip for a real closed-form spring + EventEmitter — still lean.

---

## Open questions (product, not bugs)

1. **Semver:** feel change is intentional and documented; is **1.1.0** enough, or do carefully tuned consumers need a louder “curves shifted” note / major? I’d keep 1.1.0 with the README callout you already have.
2. **Span-dependent settle** (`todo` test): absolute `0.01` threshold — correctly deferred to 2.0 if you ever want relative settle. Leave it.

---

## Verdict

**Ready with fixes** — engine logic looks solid for 1.1.0; regenerate the baseline (and optionally the tiny cleanups) before treating the branch as “done.”

---

## Plan (ordered by severity × effort — no code yet)

### Do before calling 1.1.0 done

1. **Regenerate golden master** (`npm run baseline`), update fixture note to “1.1.0 analytic,” re-run `npm test` → expect green consistency + green baseline.
2. **Skim failures mentally once** against BEFORE/AFTER so the new fixture is a conscious accept, not a blind overwrite.

### Optional polish (only if you want; skip if you’re shipping)

3. Fix the two stale comments (harness stall / report path).
4. One consistency test: mid-flight `setAttraction` keeps position continuous and still settles (locks `#reseed`).
5. Micro size only if you care about another ~10–30 B: shared validator, drop dead `keepNames`, numeric regimes. **Do not** restructure the solver for size.

### Explicitly do not do

- No second architecture pass on EventEmitter.
- No relative settle threshold in this release.
- No “fix” for reentrancy / NaN progress / post-settle reseed — those were checked and are already handled.
- No large refactor to claw back the ~400 B gzip; you paid that for frame-rate independence.

### If you want a single next step

**Regenerate baseline + green `npm test`.** Everything else is optional and small.
