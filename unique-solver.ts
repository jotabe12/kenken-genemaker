/**
 * Backtracking solver with solution counting.
 * Used to verify that a KenKen puzzle has exactly one solution.
 * 
 * Unlike the logic-based solver in solve.ts, this performs complete
 * exhaustive search via backtracking, guaranteeing correctness.
 */

import {Op, Puzzle} from './types'

interface CageInfo {
	op: Op
	target: number
	cellIndices: number[] // indices into the flat grid (row * n + col)
}

/**
 * Count the number of solutions for a puzzle, stopping at `limit`.
 * 
 * @returns number of solutions found (0, 1, or 2 when limit=2)
 * - 0: puzzle is invalid / no solution
 * - 1: unique solution (valid puzzle)
 * - 2: multiple solutions (puzzle should be rejected)
 */
export function countSolutions(puzzle: Puzzle, limit: number = 2): number {
	const n = puzzle.max
	const totalCells = n * n

	// Build cage info with flat cell indices
	const cageInfos: CageInfo[] = puzzle.cages.map(cage => ({
		op: cage.op,
		target: cage.val,
		cellIndices: cage.boxes.map(([r, c]) => r * n + c)
	}))

	// Map each cell to its cage index
	const cellToCage = new Int32Array(totalCells)
	for (let ci = 0; ci < cageInfos.length; ci++) {
		for (const idx of cageInfos[ci].cellIndices) {
			cellToCage[idx] = ci
		}
	}

	// Grid: 0 means unfilled
	const grid = new Int32Array(totalCells)

	// Track which numbers are used in each row and column (bitmasks)
	const rowUsed = new Int32Array(n) // bit i set means number i+1 is used in that row
	const colUsed = new Int32Array(n)

	let solutionCount = 0

	/**
	 * Check if a cage constraint is satisfiable with current partial assignment.
	 * Returns true if the cage is still potentially valid.
	 */
	function checkCage(cageIdx: number): boolean {
		const cage = cageInfos[cageIdx]
		const values: number[] = []
		let allFilled = true

		for (const idx of cage.cellIndices) {
			if (grid[idx] === 0) {
				allFilled = false
			} else {
				values.push(grid[idx])
			}
		}

		if (!allFilled) {
			// Partial check: prune obviously impossible states
			return checkCagePartial(cage, values)
		}

		// All cells filled: verify the cage constraint exactly
		return checkCageComplete(cage.op, cage.target, values)
	}

	function checkCagePartial(cage: CageInfo, filledValues: number[]): boolean {
		if (filledValues.length === 0) return true

		const {op, target} = cage
		switch (op) {
			case '=':
				return filledValues.length === 0 || filledValues[0] === target
			case '+': {
				const partialSum = filledValues.reduce((a, b) => a + b, 0)
				// Partial sum must not exceed target
				// Remaining cells need at least 1 each
				const remaining = cage.cellIndices.length - filledValues.length
				return partialSum + remaining <= target && partialSum + remaining * n >= target
			}
			case '*': {
				const partialProduct = filledValues.reduce((a, b) => a * b, 1)
				// Product must divide target
				if (target % partialProduct !== 0) return false
				const remaining = cage.cellIndices.length - filledValues.length
				const quotient = target / partialProduct
				// Remaining cells need values 1..n, product must equal quotient
				return quotient >= 1 && quotient <= Math.pow(n, remaining)
			}
			case '-': {
				// Only for 2-cell cages
				if (filledValues.length === 1) {
					// Other cell must be v+target or v-target, both in [1,n]
					const v = filledValues[0]
					return (v + target >= 1 && v + target <= n) ||
					       (v - target >= 1 && v - target <= n)
				}
				return true
			}
			case '/': {
				// Only for 2-cell cages
				if (filledValues.length === 1) {
					const v = filledValues[0]
					// Other cell must be v*target or v/target, both in [1,n] and integer
					const mult = v * target
					const div = v / target
					return (mult >= 1 && mult <= n) ||
					       (div >= 1 && div <= n && div === (div | 0))
				}
				return true
			}
		}
		return true
	}

	function checkCageComplete(op: Op, target: number, values: number[]): boolean {
		switch (op) {
			case '=':
				return values[0] === target
			case '+':
				return values.reduce((a, b) => a + b, 0) === target
			case '*':
				return values.reduce((a, b) => a * b, 1) === target
			case '-': {
				// Absolute difference for exactly 2 cells
				return Math.abs(values[0] - values[1]) === target
			}
			case '/': {
				// Division in either order for exactly 2 cells
				const [a, b] = values
				return (a / b === target && a % b === 0) ||
				       (b / a === target && b % a === 0)
			}
		}
		return false
	}

	/**
	 * Backtracking: fill cells left-to-right, top-to-bottom.
	 */
	function solve(cellIdx: number): void {
		if (solutionCount >= limit) return

		if (cellIdx === totalCells) {
			solutionCount++
			return
		}

		const row = (cellIdx / n) | 0
		const col = cellIdx % n

		for (let num = 1; num <= n; num++) {
			const bit = 1 << num
			// Check row and column constraints
			if ((rowUsed[row] & bit) || (colUsed[col] & bit)) continue

			// Place the number
			grid[cellIdx] = num
			rowUsed[row] |= bit
			colUsed[col] |= bit

			// Check cage constraint
			const cageIdx = cellToCage[cellIdx]
			if (checkCage(cageIdx)) {
				solve(cellIdx + 1)
			}

			// Undo
			grid[cellIdx] = 0
			rowUsed[row] &= ~bit
			colUsed[col] &= ~bit

			if (solutionCount >= limit) return
		}
	}

	solve(0)
	return solutionCount
}

/**
 * Solve a puzzle and return the solution grid, or null if no unique solution.
 */
export function findUniqueSolution(puzzle: Puzzle): number[][] | null {
	const n = puzzle.max
	const totalCells = n * n

	const cageInfos: CageInfo[] = puzzle.cages.map(cage => ({
		op: cage.op,
		target: cage.val,
		cellIndices: cage.boxes.map(([r, c]) => r * n + c)
	}))

	const cellToCage = new Int32Array(totalCells)
	for (let ci = 0; ci < cageInfos.length; ci++) {
		for (const idx of cageInfos[ci].cellIndices) {
			cellToCage[idx] = ci
		}
	}

	const grid = new Int32Array(totalCells)
	const rowUsed = new Int32Array(n)
	const colUsed = new Int32Array(n)
	let found: Int32Array | null = null
	let solutionCount = 0

	function checkCage(cageIdx: number): boolean {
		const cage = cageInfos[cageIdx]
		const values: number[] = []
		let allFilled = true
		for (const idx of cage.cellIndices) {
			if (grid[idx] === 0) { allFilled = false } else { values.push(grid[idx]) }
		}
		if (!allFilled) return checkPartial(cage, values)
		return checkComplete(cage.op, cage.target, values)
	}

	function checkPartial(cage: CageInfo, filledValues: number[]): boolean {
		if (filledValues.length === 0) return true
		const {op, target} = cage
		switch (op) {
			case '=': return filledValues[0] === target
			case '+': {
				const s = filledValues.reduce((a, b) => a + b, 0)
				const rem = cage.cellIndices.length - filledValues.length
				return s + rem <= target && s + rem * n >= target
			}
			case '*': {
				const p = filledValues.reduce((a, b) => a * b, 1)
				if (target % p !== 0) return false
				const rem = cage.cellIndices.length - filledValues.length
				return target / p >= 1 && target / p <= Math.pow(n, rem)
			}
			case '-': {
				if (filledValues.length === 1) {
					const v = filledValues[0]
					return (v + target >= 1 && v + target <= n) || (v - target >= 1 && v - target <= n)
				}
				return true
			}
			case '/': {
				if (filledValues.length === 1) {
					const v = filledValues[0]
					const mult = v * target, div = v / target
					return (mult >= 1 && mult <= n) || (div >= 1 && div <= n && div === (div | 0))
				}
				return true
			}
		}
		return true
	}

	function checkComplete(op: Op, target: number, values: number[]): boolean {
		switch (op) {
			case '=': return values[0] === target
			case '+': return values.reduce((a, b) => a + b, 0) === target
			case '*': return values.reduce((a, b) => a * b, 1) === target
			case '-': return Math.abs(values[0] - values[1]) === target
			case '/': {
				const [a, b] = values
				return (a % b === 0 && a / b === target) || (b % a === 0 && b / a === target)
			}
		}
		return false
	}

	function solve(cellIdx: number): void {
		if (solutionCount >= 2) return
		if (cellIdx === totalCells) {
			solutionCount++
			if (solutionCount === 1) found = new Int32Array(grid)
			return
		}
		const row = (cellIdx / n) | 0
		const col = cellIdx % n
		for (let num = 1; num <= n; num++) {
			const bit = 1 << num
			if ((rowUsed[row] & bit) || (colUsed[col] & bit)) continue
			grid[cellIdx] = num
			rowUsed[row] |= bit
			colUsed[col] |= bit
			if (checkCage(cellToCage[cellIdx])) solve(cellIdx + 1)
			grid[cellIdx] = 0
			rowUsed[row] &= ~bit
			colUsed[col] &= ~bit
			if (solutionCount >= 2) return
		}
	}

	solve(0)

	if (solutionCount !== 1 || !found) return null

	// Convert flat array to 2D
	const result: number[][] = []
	for (let r = 0; r < n; r++) {
		const row: number[] = []
		for (let c = 0; c < n; c++) {
			row.push(found[r * n + c])
		}
		result.push(row)
	}
	return result
}
