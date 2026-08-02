class g {
  #t;
  constructor() {
    this.#t = /* @__PURE__ */ new Map();
  }
  /**
   * Binds a listener to an event.
   * @param {string} event - The event to bind the listener to.
   * @param {Function} listener - The listener function to bind.
   * @returns {EventEmitter} The current instance for chaining.
   * @throws {TypeError} If the listener is not a function.
   */
  on(t, i) {
    if (typeof i != "function")
      throw new TypeError("Listener must be a function");
    const s = this.#t.get(t) || [];
    return s.includes(i) || s.push(i), this.#t.set(t, s), this;
  }
  /**
   * Unbinds a listener from an event.
   * @param {string} event - The event to unbind the listener from.
   * @param {Function} listener - The listener function to unbind.
   * @returns {EventEmitter} The current instance for chaining.
   */
  off(t, i) {
    const s = this.#t.get(t);
    if (!s) return this;
    const r = s.indexOf(i);
    return r !== -1 && (s.splice(r, 1), s.length === 0 ? this.#t.delete(t) : this.#t.set(t, s)), this;
  }
  /**
   * Triggers an event and calls all bound listeners.
   * @param {string} event - The event to trigger.
   * @param {...*} args - Arguments to pass to the listener functions.
   * @returns {boolean} True if the event had listeners, false otherwise.
   */
  emit(t, ...i) {
    const s = this.#t.get(t);
    if (!s || s.length === 0) return !1;
    const r = s.slice();
    for (let e = 0, n = r.length; e < n; ++e)
      try {
        r[e].apply(this, i);
      } catch (o) {
        console.error(`Error in listener for event '${t}':`, o);
      }
    return !0;
  }
  /**
   * Removes all listeners for a specific event or all events.
   * @param {string} [event] - The event to remove listeners from. If not provided, removes all listeners.
   * @returns {EventEmitter} The current instance for chaining.
   */
  removeAllListeners(t) {
    return t ? this.#t.delete(t) : this.#t.clear(), this;
  }
}
const p = 16.66, b = 1e-9;
class d extends g {
  #t;
  #a;
  #n;
  #s;
  #e;
  #h;
  #r;
  #o;
  #i;
  #u;
  /**
   * Creates an instance of PhysicsEngine.
   * @param {number} [attraction=0.026] - The attraction value for physics-based animation (0 < attraction < 1).
   * @param {number} [friction=0.28] - The friction value for physics-based animation (0 < friction < 1).
   */
  constructor({ attraction: t = 0.026, friction: i = 0.28 } = {}) {
    if (super(), !Number.isFinite(t) || t <= 0 || t >= 1)
      throw new Error("Attraction must be a number between 0 and 1 (exclusive).");
    if (!Number.isFinite(i) || i <= 0 || i >= 1)
      throw new Error("Friction must be a number between 0 and 1 (exclusive).");
    this.#t = t, this.#a = i, this.#n = 0, this.#s = 0, this.#e = 0, this.#h = 0, this.isAnimating = !1, this.#r = null, this.#o = 0, this.#i = null, this.#u = null;
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
  #l(t, i) {
    const s = Math.sqrt(this.#t), e = -Math.log(1 - this.#a) / (2 * s);
    if (Math.abs(e - 1) < b)
      return {
        regime: "critical",
        naturalFrequency: s,
        a: t,
        b: i + s * t
      };
    if (e < 1) {
      const u = s * Math.sqrt(1 - e * e);
      return {
        regime: "under",
        naturalFrequency: s,
        dampingRatio: e,
        dampedFrequency: u,
        a: t,
        b: (i + e * s * t) / u
      };
    }
    const n = s * Math.sqrt(e * e - 1), o = -e * s + n, h = -e * s - n, a = (i - h * t) / (o - h);
    return {
      regime: "over",
      root1: o,
      root2: h,
      a,
      b: t - a
    };
  }
  /**
   * Evaluates displacement and velocity at a time offset.
   * @param {number} frames - Elapsed time, in 16.66ms frames.
   * @returns {{displacement: number, velocity: number}}
   */
  #m(t) {
    const i = this.#u;
    if (i.regime === "critical") {
      const e = Math.exp(-i.naturalFrequency * t), n = i.a + i.b * t;
      return {
        displacement: e * n,
        velocity: e * (i.b - i.naturalFrequency * n)
      };
    }
    if (i.regime === "under") {
      const { naturalFrequency: e, dampingRatio: n, dampedFrequency: o, a: h, b: a } = i, u = Math.exp(-n * e * t), c = Math.cos(o * t), l = Math.sin(o * t);
      return {
        displacement: u * (h * c + a * l),
        velocity: u * ((a * o - n * e * h) * c - (h * o + n * e * a) * l)
      };
    }
    const s = i.a * Math.exp(i.root1 * t), r = i.b * Math.exp(i.root2 * t);
    return {
      displacement: s + r,
      velocity: i.root1 * s + i.root2 * r
    };
  }
  /**
   * Re-solves from the current position and velocity, restarting the clock.
   * Used when the parameters change mid-flight — the coefficients are baked at
   * solve time, so a changed spring has to become a new initial-value problem
   * rather than being picked up on the next frame.
   * @param {number} time - Current rAF timestamp, or null to seed on next frame.
   */
  #c(t) {
    this.#u = this.#l(
      this.#s - this.#e,
      this.#n
    ), this.#r = t;
  }
  /**
   * Animates from a start value to an end value.
   * @param {number} startValue - The starting value.
   * @param {number} endValue - The target value.
   * @param {number} [velocity=0] - Initial velocity, in units per 16.66ms frame.
   * @returns {Promise} Resolves when animation completes or is stopped.
   */
  animateTo(t, i, s = 0) {
    if (!Number.isFinite(t))
      throw new Error("startValue must be a finite number.");
    if (!Number.isFinite(i))
      throw new Error("endValue must be a finite number.");
    if (!Number.isFinite(s))
      throw new Error("velocity must be a finite number.");
    if (this.isAnimating && this.#f(), t === i && s === 0)
      return this.emit("change", { position: i, progress: 1 }), this.emit("complete", { position: i, progress: 1 }), Promise.resolve();
    this.#s = t, this.#h = t, this.#e = i, this.#n = s, this.isAnimating = !0, this.#c(null);
    const r = ++this.#o;
    return new Promise((e) => {
      this.#i = e;
      const n = (o) => {
        if (r !== this.#o || !this.isAnimating) return;
        this.#r === null && (this.#r = o);
        const h = (o - this.#r) / p, { displacement: a, velocity: u } = this.#m(h);
        this.#s = this.#e + a, this.#n = u;
        const c = this.#e - this.#h;
        let l = 0;
        if (c !== 0 && (l = (this.#s - this.#h) / c), this.emit("change", { position: this.#s, progress: l }), !(r !== this.#o || !this.isAnimating)) {
          if (Math.abs(a) < 0.01 && Math.abs(this.#n) < 0.01) {
            this.isAnimating = !1;
            const f = this.#i;
            this.#i = null, this.emit("change", { position: this.#e, progress: 1 }), this.emit("complete", { position: this.#e, progress: 1 }), f();
            return;
          }
          requestAnimationFrame(n);
        }
      };
      requestAnimationFrame(n);
    });
  }
  /**
   * Internal stop — resolves Promise without emitting 'stop'.
   * Used when a new animateTo supersedes the current one.
   */
  #f() {
    this.isAnimating = !1, this.#i && (this.#i(), this.#i = null);
  }
  /**
   * Stops the ongoing animation.
   * Emits 'stop' event and resolves the pending Promise.
   */
  stop() {
    if (!this.isAnimating) return;
    this.isAnimating = !1, this.#o++;
    const t = this.#i;
    this.#i = null, this.emit("stop", { position: this.#s }), t && t();
  }
  /**
   * Gets the current velocity, in units per 16.66ms frame.
   * Same units animateTo() accepts, so it can be handed straight back in
   * to retarget an animation without losing momentum.
   * @returns {number} The current velocity.
   */
  getVelocity() {
    return this.#n;
  }
  /**
   * Sets the attraction value
   * @param {number} attraction - The attraction value for physics-based animation (0 < attraction < 1).
   */
  setAttraction(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= 1)
      throw new Error("Attraction must be a number between 0 and 1 (exclusive).");
    this.#t = t, this.isAnimating && this.#c(null);
  }
  /**
   * Sets the friction value
   * @param {number} friction - The friction value for physics-based animation (0 < friction < 1).
   */
  setFriction(t) {
    if (!Number.isFinite(t) || t <= 0 || t >= 1)
      throw new Error("Friction must be a number between 0 and 1 (exclusive).");
    this.#a = t, this.isAnimating && this.#c(null);
  }
}
export {
  d as default
};
