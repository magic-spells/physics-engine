
import EventEmitter from './event-emitter.js';

export default class PhysicsEngine extends EventEmitter {

	#attraction;
	#friction;
	#frictionFactor;
	#velocity;
	#currentValue;
	#targetValue;
	#prevTime;
	#animationId;
	#resolve;

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
		this.#frictionFactor = 1 - friction;

		this.#velocity = 0;
		this.#currentValue = 0;
		this.#targetValue = 0;

		this.isAnimating = false;
		this.#prevTime = null;

		this.#animationId = 0;
		this.#resolve = null;
	}

	/**
	 * Animates from a start value to an end value.
	 * @param {number} startValue - The starting value.
	 * @param {number} endValue - The target value.
	 * @param {number} [velocity=0] - Initial velocity.
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
			this.emit('change', { position: endValue, progress: 1 });
			this.emit('complete', { position: endValue, progress: 1 });
			return Promise.resolve();
		}

		this.#currentValue = startValue;
		this.#targetValue = endValue;
		this.#velocity = velocity;
		this.isAnimating = true;
		this.#prevTime = null;

		// Increment animation ID to invalidate any previous rAF callbacks
		const animationId = ++this.#animationId;

		return new Promise((resolve) => {
			this.#resolve = resolve;

			const animate = (time) => {
				// Bail if this animation has been superseded
				if (animationId !== this.#animationId) return;
				if (!this.isAnimating) return;

				if (this.#prevTime === null) {
					this.#prevTime = time;
					requestAnimationFrame(animate);
					return;
				}

				const timeDelta = Math.min(time - this.#prevTime, 64);
				const timeDeltaFactor = timeDelta / 16.66; // Assuming 60 FPS baseline

				this.#prevTime = time;

				// Calculate attraction force
				const force = (this.#targetValue - this.#currentValue) * this.#attraction;

				// Update velocity
				this.#velocity += (force * timeDeltaFactor);

				// Apply friction
				this.#velocity *= Math.pow(this.#frictionFactor, timeDeltaFactor);

				// Update current value
				this.#currentValue += this.#velocity * timeDeltaFactor;

				// Calculate progress
				const totalDistance = this.#targetValue - startValue;
				let progress = 0;
				if (totalDistance !== 0) {
					progress = (this.#currentValue - startValue) / totalDistance;
				}

				// Emit change event
				this.emit('change', { position: this.#currentValue, progress });

				// Check if animation is complete (both position and velocity settled)
				if (Math.abs(this.#currentValue - this.#targetValue) < 0.01 && Math.abs(this.#velocity) < 0.01) {
					this.isAnimating = false;
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
	 * Sets the attraction value
	 * @param {number} attraction - The attraction value for physics-based animation (0 < attraction < 1).
	 */
	setAttraction(attraction){
		if (!Number.isFinite(attraction) || attraction <= 0 || attraction >= 1) {
			throw new Error('Attraction must be a number between 0 and 1 (exclusive).');
		}
		this.#attraction = attraction;
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
		this.#frictionFactor = 1 - friction;
	}
}
