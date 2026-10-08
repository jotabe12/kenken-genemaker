/**
 * Normalize cage representation for deduplication.
 * Two puzzles with the same cages in different order produce the same fingerprint.
 */

import {Cage} from './types'

/**
 * Generate a canonical string fingerprint for a set of cages.
 * - Cells within each cage are sorted by [row, col]
 * - Cages are sorted lexicographically by their string representation
 */
export function normalizeCages(cages: Cage[]): string {
	const normalizedCages = cages.map(cage => {
		const sortedCells = [...cage.boxes]
			.sort((a, b) => a[0] - b[0] || a[1] - b[1])
		return `${cage.op}:${cage.val}:${sortedCells.map(c => `${c[0]},${c[1]}`).join(';')}`
	})
	normalizedCages.sort()
	return normalizedCages.join('|')
}
