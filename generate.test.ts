#!/usr/bin/env node
/**
 * Automated tests for KenKen generator.
 * Run with: npm test
 */


import {Cage, Puzzle} from './types'
import {makeBoard, makeCages} from './make-board'
import {countSolutions} from './unique-solver'
import {validateStructure, checkCageValues} from './validate'
import {normalizeCages} from './normalize'
import {buildOutputJson, convertCages, imageFilename} from './export-json'
import {generatePuzzleHtml} from './render-png'
import {SeededRandom, setGlobalRng} from './seeded-random'

let passed = 0
let failed = 0
let skipped = 0

function assert(condition: boolean, message: string): void {
	if (condition) {
		passed++
		console.log(`  ✓ ${message}`)
	} else {
		failed++
		console.log(`  ✗ FAIL: ${message}`)
	}
}

function assertEq<T>(actual: T, expected: T, message: string): void {
	if (actual === expected) {
		passed++
		console.log(`  ✓ ${message}`)
	} else {
		failed++
		console.log(`  ✗ FAIL: ${message} (expected ${expected}, got ${actual})`)
	}
}

// ===== Seeded RNG Tests =====
console.log('\n=== Seeded Random Tests ===')

{
	const rng1 = new SeededRandom(42)
	const rng2 = new SeededRandom(42)
	const seq1 = Array.from({length: 10}, () => rng1.next())
	const seq2 = Array.from({length: 10}, () => rng2.next())
	assert(
		seq1.every((v, i) => v === seq2[i]),
		'Same seed produces same sequence'
	)
}

{
	const rng1 = new SeededRandom(42)
	const rng2 = new SeededRandom(99)
	const v1 = rng1.next()
	const v2 = rng2.next()
	assert(v1 !== v2, 'Different seeds produce different values')
}

// ===== Board Generation Tests =====
console.log('\n=== Board Generation Tests ===')

setGlobalRng(new SeededRandom(12345))

for (const size of [3, 4, 5, 6]) {
	const board = makeBoard(size)
	// Check rows
	let rowsValid = true
	for (let r = 0; r < size; r++) {
		const sorted = [...board[r]].sort((a, b) => a - b)
		if (sorted.length !== size || sorted.some((v, i) => v !== i + 1)) {
			rowsValid = false
		}
	}
	assert(rowsValid, `${size}x${size} board: all rows contain 1..${size}`)

	// Check columns
	let colsValid = true
	for (let c = 0; c < size; c++) {
		const col = board.map(row => row[c]).sort((a, b) => a - b)
		if (col.some((v, i) => v !== i + 1)) colsValid = false
	}
	assert(colsValid, `${size}x${size} board: all columns contain 1..${size}`)
}

// ===== Cage Generation Tests =====
console.log('\n=== Cage Generation Tests ===')

setGlobalRng(new SeededRandom(12345))

for (const size of [3, 4, 5]) {
	const board = makeBoard(size)
	const cages = makeCages(board)

	// Check all cells covered
	const allCells = new Set<string>()
	for (const cage of cages) {
		for (const [r, c] of cage.boxes) {
			allCells.add(`${r},${c}`)
		}
	}
	assertEq(allCells.size, size * size, `${size}x${size} cages: all ${size * size} cells covered`)

	// Check no duplicates
	let totalBoxes = 0
	for (const cage of cages) totalBoxes += cage.boxes.length
	assertEq(totalBoxes, size * size, `${size}x${size} cages: no duplicate cells`)

	// Check operation constraints
	let opsValid = true
	for (const cage of cages) {
		if (cage.boxes.length === 1 && cage.op !== '=') opsValid = false
		if (cage.boxes.length > 2 && (cage.op === '-' || cage.op === '/')) opsValid = false
	}
	assert(opsValid, `${size}x${size} cages: operations valid for cell counts`)

	// Check cages satisfy solution
	let solutionValid = true
	for (const cage of cages) {
		const values = cage.boxes.map(([r, c]) => board[r][c])
		if (!checkCageValues(cage.op, cage.val, values)) solutionValid = false
	}
	assert(solutionValid, `${size}x${size} cages: solution satisfies all cage constraints`)
}

// ===== Uniqueness Solver Tests =====
console.log('\n=== Uniqueness Solver Tests ===')

// Test 1: Known puzzle with unique solution (3x3)
{
	const puzzle: Puzzle = {
		max: 3,
		cages: [
			{op: '-', val: 2, boxes: [[0, 0], [0, 1]]},
			{op: '+', val: 5, boxes: [[0, 2], [1, 2]]},
			{op: '=', val: 1, boxes: [[1, 0]]},
			{op: '=', val: 2, boxes: [[1, 1]]},
			{op: '*', val: 6, boxes: [[2, 0], [2, 1]]},
			{op: '=', val: 1, boxes: [[2, 2]]}
		]
	}
	// Solution: 
	// 2 1 3
	// 3 2 1
	// 1 3 2
	const count = countSolutions(puzzle, 2)
	assertEq(count, 1, 'Known 3x3 puzzle has exactly 1 solution')
}

// Test 2: Puzzle with multiple solutions
{
	// A 3x3 with very loose constraints
	const puzzle: Puzzle = {
		max: 3,
		cages: [
			{op: '+', val: 6, boxes: [[0, 0], [0, 1], [0, 2]]},
			{op: '+', val: 6, boxes: [[1, 0], [1, 1], [1, 2]]},
			{op: '+', val: 6, boxes: [[2, 0], [2, 1], [2, 2]]}
		]
	}
	const count = countSolutions(puzzle, 2)
	assertEq(count, 2, 'Puzzle with row-only constraints has multiple solutions (returns 2)')
}

// Test 3: Invalid puzzle (no solution)
{
	const puzzle: Puzzle = {
		max: 3,
		cages: [
			{op: '=', val: 1, boxes: [[0, 0]]},
			{op: '=', val: 1, boxes: [[0, 1]]},
			{op: '=', val: 3, boxes: [[0, 2]]},
			{op: '=', val: 2, boxes: [[1, 0]]},
			{op: '=', val: 3, boxes: [[1, 1]]},
			{op: '=', val: 1, boxes: [[1, 2]]},
			{op: '=', val: 3, boxes: [[2, 0]]},
			{op: '=', val: 2, boxes: [[2, 1]]},
			{op: '=', val: 1, boxes: [[2, 2]]}
		]
	}
	// Row 0: [1, 1, 3] - duplicate 1s, so no valid Latin square
	const count = countSolutions(puzzle, 2)
	assertEq(count, 0, 'Invalid puzzle returns 0 solutions')
}

// ===== Validation Tests =====
console.log('\n=== Validation Tests ===')

{
	setGlobalRng(new SeededRandom(42))
	const board = makeBoard(3)
	const cages = makeCages(board)
	const puzzle: Puzzle = {max: 3, cages}
	const result = validateStructure(puzzle)
	assert(result.valid, '3x3 generated puzzle passes structural validation')
}

{
	// Non-contiguous cage
	const puzzle: Puzzle = {
		max: 3,
		cages: [
			{op: '+', val: 4, boxes: [[0, 0], [0, 2]]}, // not contiguous
			{op: '=', val: 2, boxes: [[0, 1]]},
			{op: '+', val: 6, boxes: [[1, 0], [1, 1], [1, 2]]},
			{op: '+', val: 6, boxes: [[2, 0], [2, 1], [2, 2]]}
		]
	}
	const result = validateStructure(puzzle)
	assert(!result.valid, 'Non-contiguous cage detected')
}

{
	// Missing cells
	const puzzle: Puzzle = {
		max: 3,
		cages: [
			{op: '+', val: 3, boxes: [[0, 0], [0, 1]]},
			{op: '=', val: 3, boxes: [[0, 2]]}
			// Missing rows 1 and 2
		]
	}
	const result = validateStructure(puzzle)
	assert(!result.valid, 'Missing cells detected')
}

// ===== Operation Conversion Tests =====
console.log('\n=== Operation Conversion Tests ===')

{
	const cages: Cage[] = [
		{op: '*', val: 6, boxes: [[0, 0], [0, 1]]},
		{op: '/', val: 2, boxes: [[1, 0], [1, 1]]},
		{op: '+', val: 5, boxes: [[2, 0], [2, 1]]},
		{op: '-', val: 1, boxes: [[0, 2], [1, 2]]},
		{op: '=', val: 3, boxes: [[2, 2]]}
	]
	const converted = convertCages(cages)
	assertEq(converted[0].op, 'x', '"*" converts to "x"')
	assertEq(converted[1].op, '÷', '"/" converts to "÷"')
	assertEq(converted[2].op, '+', '"+" stays "+"')
	assertEq(converted[3].op, '-', '"-" stays "-"')
	assertEq(converted[4].op, '=', '"=" stays "="')
}

// ===== Normalization Tests =====
console.log('\n=== Normalization Tests ===')

{
	const cages1: Cage[] = [
		{op: '+', val: 5, boxes: [[0, 0], [1, 0]]},
		{op: '*', val: 6, boxes: [[0, 1], [0, 2]]}
	]
	const cages2: Cage[] = [
		{op: '*', val: 6, boxes: [[0, 2], [0, 1]]}, // reversed cells
		{op: '+', val: 5, boxes: [[1, 0], [0, 0]]}  // reversed order + cells
	]
	const fp1 = normalizeCages(cages1)
	const fp2 = normalizeCages(cages2)
	assertEq(fp1, fp2, 'Same cages in different order produce same fingerprint')
}

{
	const cages1: Cage[] = [
		{op: '+', val: 5, boxes: [[0, 0], [1, 0]]}
	]
	const cages2: Cage[] = [
		{op: '+', val: 6, boxes: [[0, 0], [1, 0]]}
	]
	const fp1 = normalizeCages(cages1)
	const fp2 = normalizeCages(cages2)
	assert(fp1 !== fp2, 'Different targets produce different fingerprints')
}

// ===== JSON Export Tests =====
console.log('\n=== JSON Export Tests ===')

{
	const cages: Cage[] = [
		{op: '*', val: 4, boxes: [[0, 0], [1, 0]]},
		{op: '=', val: 2, boxes: [[0, 1]]},
		{op: '+', val: 5, boxes: [[0, 2], [1, 2], [1, 1]]},
		{op: '-', val: 1, boxes: [[2, 0], [2, 1]]},
		{op: '=', val: 1, boxes: [[2, 2]]}
	]
	const json = buildOutputJson(3, [{filename: 'imagen3x3_1.png', cages}])

	assertEq(json.n, 3, 'JSON n field correct')
	assertEq(json.images.length, 1, 'JSON has 1 image entry')
	assertEq(json.images[0].filename, 'imagen3x3_1.png', 'JSON filename correct')
	assertEq(json.images[0].cages[0].op, 'x', 'JSON op converted from * to x')
	assert(!JSON.stringify(json).includes('"val"'), 'JSON does not contain "val" field')
	assert(!JSON.stringify(json).includes('"boxes"'), 'JSON does not contain "boxes" field')
	assert(!JSON.stringify(json).includes('"max"'), 'JSON does not contain "max" field')
}

{
	assertEq(imageFilename(3, 1), 'imagen3x3_1.png', 'Image filename 3x3_1 correct')
	assertEq(imageFilename(9, 4), 'imagen9x9_4.png', 'Image filename 9x9_4 correct')
}

// ===== HTML Rendering Test =====
console.log('\n=== HTML Rendering Tests ===')

{
	const cages: Cage[] = [
		{op: '+', val: 3, boxes: [[0, 0], [0, 1]]},
		{op: '=', val: 3, boxes: [[0, 2]]},
		{op: '+', val: 6, boxes: [[1, 0], [1, 1], [1, 2]]},
		{op: '+', val: 6, boxes: [[2, 0], [2, 1], [2, 2]]}
	]
	const html = generatePuzzleHtml(3, cages)
	assert(html.includes('<table>'), 'HTML contains table element')
	assert(html.includes('<td'), 'HTML contains td elements')
	assert(html.includes('3'), 'HTML contains cage target')
	assert(!html.includes('solution'), 'HTML does not contain solution numbers')
}

// ===== Integration: Generate and Validate 3x3 =====
console.log('\n=== Integration: Generate & Validate 3x3 ===')

{
	setGlobalRng(new SeededRandom(777))
	let found = false
	for (let attempt = 0; attempt < 100; attempt++) {
		const board = makeBoard(3)
		const cages = makeCages(board)
		const puzzle: Puzzle = {max: 3, cages}

		const structResult = validateStructure(puzzle)
		if (!structResult.valid) continue

		// Verify solution satisfies cages
		let solutionOk = true
		for (const cage of cages) {
			const values = cage.boxes.map(([r, c]: [number, number]) => board[r][c])
			if (!checkCageValues(cage.op, cage.val, values)) {
				solutionOk = false
				break
			}
		}
		if (!solutionOk) continue

		const count = countSolutions(puzzle, 2)
		if (count === 1) {
			found = true
			console.log(`  Found valid 3x3 on attempt ${attempt + 1}`)
			break
		}
	}
	assert(found, 'Can generate at least one valid 3x3 puzzle with unique solution')
}

// ===== Integration: Generate 4 puzzles of 3x3 =====
console.log('\n=== Integration: Generate 4 puzzles of 3x3 ===')

{
	setGlobalRng(new SeededRandom(999))
	const puzzles: Puzzle[] = []
	const fingerprints = new Set<string>()
	let attempts = 0

	while (puzzles.length < 4 && attempts < 200) {
		attempts++
		const board = makeBoard(3)
		const cages = makeCages(board)
		const puzzle: Puzzle = {max: 3, cages}

		const structResult = validateStructure(puzzle)
		if (!structResult.valid) continue

		let solutionOk = true
		for (const cage of cages) {
			const values = cage.boxes.map(([r, c]: [number, number]) => board[r][c])
			if (!checkCageValues(cage.op, cage.val, values)) {
				solutionOk = false
				break
			}
		}
		if (!solutionOk) continue

		const fp = normalizeCages(cages)
		if (fingerprints.has(fp)) continue

		const count = countSolutions(puzzle, 2)
		if (count === 1) {
			fingerprints.add(fp)
			puzzles.push(puzzle)
		}
	}

	assertEq(puzzles.length, 4, `Generated 4 unique 3x3 puzzles (in ${attempts} attempts)`)
}

// ===== Integration: At least one puzzle of each size 3-7 =====
console.log('\n=== Integration: One puzzle per size 3-7 ===')

for (const size of [3, 4, 5, 6, 7]) {
	setGlobalRng(new SeededRandom(42 + size))
	let found = false
	const maxAttempts = size <= 5 ? 100 : 200

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const board = makeBoard(size)
		const cages = makeCages(board)
		const puzzle: Puzzle = {max: size, cages}

		const structResult = validateStructure(puzzle)
		if (!structResult.valid) continue

		let solutionOk = true
		for (const cage of cages) {
			const values = cage.boxes.map(([r, c]: [number, number]) => board[r][c])
			if (!checkCageValues(cage.op, cage.val, values)) {
				solutionOk = false
				break
			}
		}
		if (!solutionOk) continue

		const count = countSolutions(puzzle, 2)
		if (count === 1) {
			found = true
			console.log(`  ${size}x${size}: found on attempt ${attempt + 1}`)
			break
		}
	}
	assert(found, `Can generate at least one valid ${size}x${size} puzzle`)
}

// ===== Cage value check tests =====
console.log('\n=== Cage Value Check Tests ===')

assert(checkCageValues('=', 5, [5]), '"=" cage: 5 == 5')
assert(!checkCageValues('=', 5, [3]), '"=" cage: 3 != 5')
assert(checkCageValues('+', 7, [3, 4]), '"+" cage: 3+4 == 7')
assert(checkCageValues('+', 10, [2, 3, 5]), '"+" cage: 2+3+5 == 10')
assert(checkCageValues('-', 1, [3, 2]), '"-" cage: |3-2| == 1')
assert(checkCageValues('-', 1, [2, 3]), '"-" cage: |2-3| == 1')
assert(checkCageValues('*', 12, [3, 4]), '"*" cage: 3*4 == 12')
assert(checkCageValues('*', 24, [2, 3, 4]), '"*" cage: 2*3*4 == 24')
assert(checkCageValues('/', 2, [4, 2]), '"/" cage: 4/2 == 2')
assert(checkCageValues('/', 2, [2, 4]), '"/" cage: 4/2 == 2 (reversed)')
assert(!checkCageValues('/', 3, [4, 2]), '"/" cage: 4/2 != 3')

// ===== Summary =====
console.log(`\n${'='.repeat(50)}`)
console.log(`Tests complete: ${passed} passed, ${failed} failed, ${skipped} skipped`)
if (failed > 0) {
	console.log('SOME TESTS FAILED')
	process.exit(1)
} else {
	console.log('ALL TESTS PASSED')
}
