import e from "@magic-spells/event-emitter";
//#region src/physics-engine.js
var t = 16.66, n = 1e-9, r = class extends e {
	#e;
	#t;
	#n;
	#r;
	#i;
	#a;
	#o;
	#s;
	#c;
	#l;
	constructor({ attraction: e = .026, friction: t = .28 } = {}) {
		if (super(), !Number.isFinite(e) || e <= 0 || e >= 1) throw Error("Attraction must be a number between 0 and 1 (exclusive).");
		if (!Number.isFinite(t) || t <= 0 || t >= 1) throw Error("Friction must be a number between 0 and 1 (exclusive).");
		this.#e = e, this.#t = t, this.#n = 0, this.#r = 0, this.#i = 0, this.#a = 0, this.isAnimating = !1, this.#o = null, this.#s = 0, this.#c = null, this.#l = null;
	}
	#u(e, t) {
		let r = Math.sqrt(this.#e), i = -Math.log(1 - this.#t) / (2 * r);
		if (Math.abs(i - 1) < n) return {
			regime: "critical",
			naturalFrequency: r,
			a: e,
			b: t + r * e
		};
		if (i < 1) {
			let n = r * Math.sqrt(1 - i * i);
			return {
				regime: "under",
				naturalFrequency: r,
				dampingRatio: i,
				dampedFrequency: n,
				a: e,
				b: (t + i * r * e) / n
			};
		}
		let a = r * Math.sqrt(i * i - 1), o = -i * r + a, s = -i * r - a, c = (t - s * e) / (o - s);
		return {
			regime: "over",
			root1: o,
			root2: s,
			a: c,
			b: e - c
		};
	}
	#d(e) {
		let t = this.#l;
		if (t.regime === "critical") {
			let n = Math.exp(-t.naturalFrequency * e), r = t.a + t.b * e;
			return {
				displacement: n * r,
				velocity: n * (t.b - t.naturalFrequency * r)
			};
		}
		if (t.regime === "under") {
			let { naturalFrequency: n, dampingRatio: r, dampedFrequency: i, a, b: o } = t, s = Math.exp(-r * n * e), c = Math.cos(i * e), l = Math.sin(i * e);
			return {
				displacement: s * (a * c + o * l),
				velocity: s * ((o * i - r * n * a) * c - (a * i + r * n * o) * l)
			};
		}
		let n = t.a * Math.exp(t.root1 * e), r = t.b * Math.exp(t.root2 * e);
		return {
			displacement: n + r,
			velocity: t.root1 * n + t.root2 * r
		};
	}
	#f(e) {
		this.#l = this.#u(this.#r - this.#i, this.#n), this.#o = e;
	}
	animateTo(e, n, r = 0) {
		if (!Number.isFinite(e)) throw Error("startValue must be a finite number.");
		if (!Number.isFinite(n)) throw Error("endValue must be a finite number.");
		if (!Number.isFinite(r)) throw Error("velocity must be a finite number.");
		if (this.isAnimating && this.#p(), e === n && r === 0) return this.emit("change", {
			position: n,
			progress: 1
		}), this.emit("complete", {
			position: n,
			progress: 1
		}), Promise.resolve();
		this.#r = e, this.#a = e, this.#i = n, this.#n = r, this.isAnimating = !0, this.#f(null);
		let i = ++this.#s;
		return new Promise((e) => {
			this.#c = e;
			let n = (e) => {
				if (i !== this.#s || !this.isAnimating) return;
				this.#o === null && (this.#o = e);
				let r = (e - this.#o) / t, { displacement: a, velocity: o } = this.#d(r);
				this.#r = this.#i + a, this.#n = o;
				let s = this.#i - this.#a, c = 0;
				if (s !== 0 && (c = (this.#r - this.#a) / s), this.emit("change", {
					position: this.#r,
					progress: c
				}), !(i !== this.#s || !this.isAnimating)) {
					if (Math.abs(a) < .01 && Math.abs(this.#n) < .01) {
						this.isAnimating = !1;
						let e = this.#c;
						this.#c = null, this.emit("change", {
							position: this.#i,
							progress: 1
						}), this.emit("complete", {
							position: this.#i,
							progress: 1
						}), e();
						return;
					}
					requestAnimationFrame(n);
				}
			};
			requestAnimationFrame(n);
		});
	}
	#p() {
		this.isAnimating = !1, this.#c &&= (this.#c(), null);
	}
	stop() {
		if (!this.isAnimating) return;
		this.isAnimating = !1, this.#s++;
		let e = this.#c;
		this.#c = null, this.emit("stop", { position: this.#r }), e && e();
	}
	getVelocity() {
		return this.#n;
	}
	setAttraction(e) {
		if (!Number.isFinite(e) || e <= 0 || e >= 1) throw Error("Attraction must be a number between 0 and 1 (exclusive).");
		this.#e = e, this.isAnimating && this.#f(null);
	}
	setFriction(e) {
		if (!Number.isFinite(e) || e <= 0 || e >= 1) throw Error("Friction must be a number between 0 and 1 (exclusive).");
		this.#t = e, this.isAnimating && this.#f(null);
	}
};
//#endregion
export { r as default };
