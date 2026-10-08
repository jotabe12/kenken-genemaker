/**
 * Seedable pseudo-random number generator (Mulberry32).
 * Provides a drop-in replacement for Math.random() with reproducible sequences.
 */

export class SeededRandom {
	private state: number

	constructor(seed: number) {
		this.state = seed | 0
	}

	/** Returns a float in [0, 1) */
	next(): number {
		this.state = (this.state + 0x6D2B79F5) | 0
		let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}

	/** Returns an integer from 0 to n-1 */
	rand(n: number): number {
		return (this.next() * n) | 0
	}

	/** Shuffle array in-place using Fisher-Yates */
	shuffle<T>(arr: T[]): T[] {
		for (let i = arr.length - 1; i > 0; i--) {
			const j = this.rand(i + 1)
			;[arr[i], arr[j]] = [arr[j], arr[i]]
		}
		return arr
	}

	/** Pick a random element from an array */
	pick<T>(arr: T[]): T {
		return arr[this.rand(arr.length)]
	}

	/** Remove and return a random element from an array */
	extract<T>(arr: T[]): T {
		return arr.splice(this.rand(arr.length), 1)[0]
	}
}

/** Global RNG instance, can be replaced with a seeded one */
let globalRng: SeededRandom = new SeededRandom(Date.now())

export function setGlobalRng(rng: SeededRandom): void {
	globalRng = rng
}

export function getGlobalRng(): SeededRandom {
	return globalRng
}
