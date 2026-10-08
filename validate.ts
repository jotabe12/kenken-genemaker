/**
 * Comprehensive validation for KenKen puzzles.
 * Checks structural integrity, solution correctness, and uniqueness.
 */

import {Puzzle, Box} from './types'
import {countSolutions} from './unique-solver'

export interface ValidationResult {
	valid: boolean
	errors: string[]
}

/**
 * Run all 14 validations on a puzzle, optionally with a known solution.
 */
export function validatePuzzle(
	puzzle: Puzzle,
	solution?: number[][]
): ValidationResult {
	const errors: string[] = []
	const n = puzzle.max

	// 1. Board size is valid
	if (n < 2 || n > 15 || !Number.isInteger(n)) {
		errors.push(`Invalid board size: ${n}`)
		return {valid: false, errors}
	}

	const totalCells = n * n
	const allCells = new Set<string>()
	const duplicateCells: string[] = []

	for (const cage of puzzle.cages) {
		// 6. Each cage has at least one cell
		if (cage.boxes.length === 0) {
			errors.push('Cage has no cells')
		}

		for (const [r, c] of cage.boxes) {
			// 2. All cells within range
			if (r < 0 || r >= n || c < 0 || c >= n) {
				errors.push(`Cell [${r},${c}] out of range for ${n}x${n} board`)
				continue
			}

			const key = `${r},${c}`
			// 5. No duplicate cells
			if (allCells.has(key)) {
				duplicateCells.push(key)
			}
			allCells.add(key)
		}

		// 7. Cage is orthogonally contiguous
		if (!isCageContiguous(cage.boxes)) {
			errors.push(`Cage with op=${cage.op} target=${cage.val} is not contiguous`)
		}

		// 8. Operations valid for number of cells
		if (cage.boxes.length === 1 && cage.op !== '=') {
			errors.push(`Single-cell cage must use '=', got '${cage.op}'`)
		}
		if (cage.boxes.length > 2 && (cage.op === '-' || cage.op === '/')) {
			errors.push(`Operation '${cage.op}' only allowed for 2-cell cages, got ${cage.boxes.length} cells`)
		}

		// 9. Target is valid number
		if (!Number.isInteger(cage.val) || cage.val < 0) {
			errors.push(`Invalid target value: ${cage.val}`)
		}
	}

	// 3 & 4. Every cell belongs to exactly one cage, no missing cells
	if (allCells.size < totalCells) {
		const missing: string[] = []
		for (let r = 0; r < n; r++) {
			for (let c = 0; c < n; c++) {
				if (!allCells.has(`${r},${c}`)) missing.push(`[${r},${c}]`)
			}
		}
		errors.push(`Missing cells: ${missing.join(', ')}`)
	}

	if (duplicateCells.length > 0) {
		errors.push(`Duplicate cells: ${duplicateCells.join(', ')}`)
	}

	// Solution-based validations (10-12)
	if (solution) {
		// 10. Solution satisfies all rows
		for (let r = 0; r < n; r++) {
			const row = new Set(solution[r])
			if (row.size !== n) {
				errors.push(`Row ${r} has duplicate values`)
			}
			for (let v = 1; v <= n; v++) {
				if (!row.has(v)) {
					errors.push(`Row ${r} missing value ${v}`)
				}
			}
		}

		// 11. Solution satisfies all columns
		for (let c = 0; c < n; c++) {
			const col = new Set<number>()
			for (let r = 0; r < n; r++) col.add(solution[r][c])
			if (col.size !== n) {
				errors.push(`Column ${c} has duplicate values`)
			}
			for (let v = 1; v <= n; v++) {
				if (!col.has(v)) {
					errors.push(`Column ${c} missing value ${v}`)
				}
			}
		}

		// 12. Solution satisfies all cages
		for (const cage of puzzle.cages) {
			const values = cage.boxes.map(([r, c]) => solution[r][c])
			if (!checkCageValues(cage.op, cage.val, values)) {
				errors.push(
					`Cage op=${cage.op} target=${cage.val} cells=[${cage.boxes.map(b => `[${b}]`).join(',')}] ` +
					`values=[${values.join(',')}] does not satisfy constraint`
				)
			}
		}
	}

	// 13 & 14. Solution existence and uniqueness (only if structural checks pass)
	if (errors.length === 0) {
		const count = countSolutions(puzzle, 2)
		if (count === 0) {
			errors.push('Puzzle has no solution')
		} else if (count >= 2) {
			errors.push('Puzzle has multiple solutions')
		}
	}

	return {valid: errors.length === 0, errors}
}

/**
 * Quick structural validation without uniqueness check (faster).
 */
export function validateStructure(puzzle: Puzzle): ValidationResult {
	const errors: string[] = []
	const n = puzzle.max

	if (n < 2 || n > 15 || !Number.isInteger(n)) {
		errors.push(`Invalid board size: ${n}`)
		return {valid: false, errors}
	}

	const totalCells = n * n
	const allCells = new Set<string>()

	for (const cage of puzzle.cages) {
		if (cage.boxes.length === 0) {
			errors.push('Cage has no cells')
		}
		for (const [r, c] of cage.boxes) {
			if (r < 0 || r >= n || c < 0 || c >= n) {
				errors.push(`Cell [${r},${c}] out of range`)
				continue
			}
			const key = `${r},${c}`
			if (allCells.has(key)) errors.push(`Duplicate cell: ${key}`)
			allCells.add(key)
		}
		if (!isCageContiguous(cage.boxes)) {
			errors.push('Non-contiguous cage')
		}
		if (cage.boxes.length === 1 && cage.op !== '=') {
			errors.push(`Single-cell cage must use '='`)
		}
		if (cage.boxes.length > 2 && (cage.op === '-' || cage.op === '/')) {
			errors.push(`'${cage.op}' only allowed for 2-cell cages`)
		}
	}

	if (allCells.size !== totalCells) {
		errors.push(`Expected ${totalCells} cells, got ${allCells.size}`)
	}

	return {valid: errors.length === 0, errors}
}

/** Check if a set of boxes forms a contiguous region (orthogonal adjacency) */
function isCageContiguous(boxes: Box[]): boolean {
	if (boxes.length <= 1) return true

	const boxSet = new Set(boxes.map(([r, c]) => `${r},${c}`))
	const visited = new Set<string>()
	const queue = [`${boxes[0][0]},${boxes[0][1]}`]
	visited.add(queue[0])

	const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]]

	while (queue.length > 0) {
		const current = queue.pop()!
		const [r, c] = current.split(',').map(Number)

		for (const [dr, dc] of dirs) {
			const key = `${r + dr},${c + dc}`
			if (boxSet.has(key) && !visited.has(key)) {
				visited.add(key)
				queue.push(key)
			}
		}
	}

	return visited.size === boxes.length
}

/** Check whether values satisfy a cage's operation and target */
export function checkCageValues(op: string, target: number, values: number[]): boolean {
	switch (op) {
		case '=':
			return values.length === 1 && values[0] === target
		case '+':
			return values.reduce((a, b) => a + b, 0) === target
		case '*':
			return values.reduce((a, b) => a * b, 1) === target
		case '-': {
			if (values.length !== 2) return false
			return Math.abs(values[0] - values[1]) === target
		}
		case '/': {
			if (values.length !== 2) return false
			const [a, b] = values
			return (b !== 0 && a % b === 0 && a / b === target) ||
			       (a !== 0 && b % a === 0 && b / a === target)
		}
	}
	return false
}
