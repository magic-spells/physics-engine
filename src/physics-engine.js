
import EventEmitter from '@magic-spells/event-emitter';

/**
 * One frame at the 60fps baseline, in ms. Time is measured in frames throughout
 * so that `attraction`, `friction` and the velocity `animateTo()` accepts all
 * keep the per-frame units they have always had.
 */
const FRAME_MS = 16.66;

/** Below this, |damping ratio - 1| is treated as critically damped. */
const CRITICAL_EPSILON = 1e-9;

export default class PhysicsEngine extends EventEmitter {

	#attraction;
	#friction;
	#velocity;
	#currentValue;
	#targetValue;
	#startValue;
	#startTime;
	#animationId;
	#resolve;
	#coefficients;

	/**
	 * Creates an instance of PhysicsEngine.
	 * @param {number} [attraction=0.026] - The attraction value for physics-based animation (0 < attraction < 1).
	 * @param {number} [friction=0.28] - The friction value for physics-based animation (0 < friction < 1).
	 */
	constructor({ attraction = 0.026, friction = 0.28 } = {}) {
		super();

		// Validate attraction
		if (!Number.isFinite(attraction) || attraction <= 0 || attraction >= 1) {
			throw new Error('Attraction must be a number between 0 and 1 (exclusive).');
		}
		// Validate friction
		if (!Number.isFinite(friction) || friction <= 0 || friction >= 1) {
			throw new Error('Friction must be a number between 0 and 1 (exclusive).');
		}

		this.#attraction = attraction;
		this.#friction = friction;

		this.#velocity = 0;
		this.#currentValue = 0;
		this.#targetValue = 0;
		this.#startValue = 0;

		this.isAnimating = false;
		this.#startTime = null;

		this.#animationId = 0;
		this.#resolve = null;
		this.#coefficients = null;
	}

	/**
	 * Solves the spring for the current parameters and initial conditions.
	 *
	 * The engine used to integrate the spring one frame at a time, which made the
	 * trajectory depend on how the frames happened to land: a 144Hz display and a
	 * 30Hz display took measurably different paths, and a dropped frame stretched
	 * the animation. A damped harmonic oscillator has an exact solution, so we
	 * solve it once and evaluate at absolute elapsed time instead. Frame rate,
	 * frame-time jitter and stalls then only decide when we *sample* the motion,
	 * never what the motion is.
	 *
	 * Reading the old recurrence as an ODE in frame-time gives the mapping:
	 * `v += attraction * (target - x)` is the spring constant, and `v *= 1 - friction`
	 * is exponential decay at rate `-ln(1 - friction)` per frame.
	 *
	 * @param {number} displacement - Current position minus target.
	 * @param {number} velocity - Current velocity, in units per frame.
	 * @returns {Object} Coefficients consumed by #solve.
	 */
	#deriveCoefficients(displacement, velocity) {
		const naturalFrequency = Math.sqrt(this.#attraction);
		const dampingRate = -Math.log(1 - this.#friction);
		const dampingRatio = dampingRate / (2 * naturalFrequency);

		if (Math.abs(dampingRatio - 1) < CRITICAL_EPSILON) {
			return {
				regime: 'critical',
				naturalFrequency,
				a: displacement,
				b: velocity + naturalFrequency * displacement,
			};
		}

		if (dampingRatio < 1) {
			const dampedFrequency = naturalFrequency * Math.sqrt(1 - dampingRatio * dampingRatio);
			return {
				regime: 'under',
				naturalFrequency,
				dampingRatio,
				dampedFrequency,
				a: displacement,
				b: (velocity + dampingRatio * naturalFrequency * displacement) / dampedFrequency,
			};
		}

		const spread = naturalFrequency * Math.sqrt(dampingRatio * dampingRatio - 1);
		const root1 = -dampingRatio * naturalFrequency + spread;
		const root2 = -dampingRatio * naturalFrequency - spread;
		const a = (velocity - root2 * displacement) / (root1 - root2);
		return {
			regime: 'over',
			root1,
			root2,
			a,
			b: displacement - a,
		};
	}

	/**
	 * Evaluates displacement and velocity at a time offset.
	 * @param {number} frames - Elapsed time, in 16.66ms frames.
	 * @returns {{displacement: number, velocity: number}}
	 */
	#solve(frames) {
		const c = this.#coefficients;

		if (c.regime === 'critical') {
			const decay = Math.exp(-c.naturalFrequency * frames);
			const linear = c.a + c.b * frames;
			return {
				displacement: decay * linear,
				velocity: decay * (c.b - c.naturalFrequency * linear),
			};
		}

		if (c.regime === 'under') {
			const { naturalFrequency: wn, dampingRatio: z, dampedFrequency: wd, a, b } = c;
			const decay = Math.exp(-z * wn * frames);
			const cos = Math.cos(wd * frames);
			const sin = Math.sin(wd * frames);
			return {
				displacement: decay * (a * cos + b * sin),
				velocity: decay * ((b * wd - z * wn * a) * cos - (a * wd + z * wn * b) * sin),
			};
		}

		const first = c.a * Math.exp(c.root1 * frames);
		const second = c.b * Math.exp(c.root2 * frames);
		return {
			displacement: first + second,
			velocity: c.root1 * first + c.root2 * second,
		};
	}

	/**
	 * Re-solves from the current position and velocity, restarting the clock.
	 * Used when the parameters change mid-flight — the coefficients are baked at
	 * solve time, so a changed spring has to become a new initial-value problem
	 * rather than being picked up on the next frame.
	 * @param {number} time - Current rAF timestamp, or null to seed on next frame.
	 */
	#reseed(time) {
		this.#coefficients = this.#deriveCoefficients(
			this.#currentValue - this.#targetValue,
			this.#velocity
		);
		this.#startTime = time;
	}

	/**
	 * Animates from a start value to an end value.
	 * @param {number} startValue - The starting value.
	 * @param {number} endValue - The target value.
	 * @param {number} [velocity=0] - Initial velocity, in units per 16.66ms frame.
	 * @returns {Promise} Resolves when animation completes or is stopped.
	 */
	animateTo(startValue, endValue, velocity = 0) {

		// Validate arguments
		if (!Number.isFinite(startValue)) {
			throw new Error('startValue must be a finite number.');
		}
		if (!Number.isFinite(endValue)) {
			throw new Error('endValue must be a finite number.');
		}
		if (!Number.isFinite(velocity)) {
			throw new Error('velocity must be a finite number.');
		}

		// If already animating, stop the previous animation
		if (this.isAnimating) {
			this.#stopInternal();
		}

		// Early return if already at target with no velocity
		if (startValue === endValue && velocity === 0) {
			// Settle the internal state before emitting: otherwise the getters keep
			// reporting whatever the previous animation left behind.
			this.#currentValue = endValue;
			this.#startValue = startValue;
			this.#targetValue = endValue;
			this.#velocity = 0;
			this.emit('change', { position: endValue, progress: 1 });
			this.emit('complete', { position: endValue, progress: 1 });
			return Promise.resolve();
		}

		this.#currentValue = startValue;
		this.#startValue = startValue;
		this.#targetValue = endValue;
		this.#velocity = velocity;
		this.isAnimating = true;
		this.#reseed(null);

		// Increment animation ID to invalidate any previous rAF callbacks
		const animationId = ++this.#animationId;

		return new Promise((resolve) => {
			this.#resolve = resolve;

			const animate = (time) => {
				// Bail if this animation has been superseded
				if (animationId !== this.#animationId) return;
				if (!this.isAnimating) return;

				// The first frame seeds the clock at elapsed 0. It still emits: the
				// old engine returned silently here because a delta needs a previous
				// timestamp to exist, so the spring painted nothing on its first
				// frame. That was a missing initial paint, not a timing shift — both
				// versions measure elapsed time from the first rAF.
				if (this.#startTime === null) this.#startTime = time;

				const frames = (time - this.#startTime) / FRAME_MS;
				const { displacement, velocity: currentVelocity } = this.#solve(frames);

				this.#currentValue = this.#targetValue + displacement;
				this.#velocity = currentVelocity;

				// Calculate progress
				const totalDistance = this.#targetValue - this.#startValue;
				let progress = 0;
				if (totalDistance !== 0) {
					progress = (this.#currentValue - this.#startValue) / totalDistance;
				}

				// Emit change event
				this.emit('change', { position: this.#currentValue, progress });

				// A listener is free to call stop() or animateTo() during that emit.
				// Both invalidate this frame's claim on the animation — without this
				// guard, the settle branch below would resolve a Promise that is no
				// longer ours (or null, which throws).
				if (animationId !== this.#animationId || !this.isAnimating) return;

				// Check if animation is complete (both position and velocity settled)
				if (Math.abs(displacement) < 0.01 && Math.abs(this.#velocity) < 0.01) {
					this.isAnimating = false;
					// Snap internal state to match what the settle events report, so
					// getVelocity() and the emitted position agree after completion
					// instead of leaking the sub-threshold solver residuals.
					this.#currentValue = this.#targetValue;
					this.#velocity = 0;
					const pendingResolve = this.#resolve;
					this.#resolve = null;
					this.emit('change', { position: this.#targetValue, progress: 1 });
					this.emit('complete', { position: this.#targetValue, progress: 1 });
					pendingResolve();
					return;
				}

				requestAnimationFrame(animate);
			};

			requestAnimationFrame(animate);
		});
	}

	/**
	 * Internal stop — resolves Promise without emitting 'stop'.
	 * Used when a new animateTo supersedes the current one.
	 */
	#stopInternal() {
		this.isAnimating = false;
		if (this.#resolve) {
			this.#resolve();
			this.#resolve = null;
		}
	}

	/**
	 * Stops the ongoing animation.
	 * Emits 'stop' event and resolves the pending Promise.
	 */
	stop() {
		if (!this.isAnimating) return;
		this.isAnimating = false;
		this.#animationId++;
		const pendingResolve = this.#resolve;
		this.#resolve = null;
		this.emit('stop', { position: this.#currentValue });
		if (pendingResolve) pendingResolve();
	}

	/**
	 * Gets the current velocity, in units per 16.66ms frame.
	 * Same units animateTo() accepts, so it can be handed straight back in
	 * to retarget an animation without losing momentum.
	 * @returns {number} The current velocity.
	 */
	getVelocity() {
		return this.#velocity;
	}

	/**
	 * Sets the attraction value
	 * @param {number} attraction - The attraction value for physics-based animation (0 < attraction < 1).
	 */
	setAttraction(attraction){
		if (!Number.isFinite(attraction) || attraction <= 0 || attraction >= 1) {
			throw new Error('Attraction must be a number between 0 and 1 (exclusive).');
		}
		this.#attraction = attraction;
		if (this.isAnimating) this.#reseed(null);
	}

	/**
	 * Sets the friction value
	 * @param {number} friction - The friction value for physics-based animation (0 < friction < 1).
	 */
	setFriction(friction){
		if (!Number.isFinite(friction) || friction <= 0 || friction >= 1) {
			throw new Error('Friction must be a number between 0 and 1 (exclusive).');
		}
		this.#friction = friction;
		if (this.isAnimating) this.#reseed(null);
	}
}
