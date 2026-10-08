/**
 * Export puzzles to the output JSON format.
 * Converts from internal format (max, val, boxes, *, /) 
 * to output format (n, target, cells, x, ÷).
 */

import {Cage} from './types'

/** Output format types */
export interface OutputCage {
	op: string
	target: number
	cells: number[][]
}

export interface OutputPuzzleEntry {
	filename: string
	cages: OutputCage[]
}

export interface OutputJson {
	n: number
	images: OutputPuzzleEntry[]
}

/** Map internal op symbols to output symbols */
function convertOp(op: string): string {
	switch (op) {
		case '*': return 'x'
		case '/': return '÷'
		default: return op // '+', '-', '=' stay the same
	}
}

/** Convert a single puzzle's cages to output format */
export function convertCages(cages: Cage[]): OutputCage[] {
	return cages.map(cage => ({
		op: convertOp(cage.op),
		target: cage.val,
		cells: cage.boxes.map(([r, c]) => [r, c])
	}))
}

/** Build the complete output JSON structure for a size */
export function buildOutputJson(
	n: number,
	puzzles: {filename: string; cages: Cage[]}[]
): OutputJson {
	return {
		n,
		images: puzzles.map(p => ({
			filename: p.filename,
			cages: convertCages(p.cages)
		}))
	}
}

/** Generate the image filename for a puzzle */
export function imageFilename(n: number, index: number): string {
	return `imagen${n}x${n}_${index}.png`
}
