#!/usr/bin/env node
/**
 * Batch KenKen puzzle generator.
 * 
 * Usage:
 *   npm run generate -- --min-size 3 --max-size 9 --per-size 4 --output output
 *   npm run generate -- --seed 12345
 *   npm run generate -- --min-size 3 --max-size 3 --per-size 1 --verbose
 */

import * as fs from 'fs'
import * as path from 'path'
import {Cage, Puzzle} from './types'
import {makeBoard, makeCages} from './make-board'
import {countSolutions} from './unique-solver'
import {validateStructure, checkCageValues} from './validate'
import {normalizeCages} from './normalize'
import {buildOutputJson, imageFilename} from './export-json'
import {renderPuzzlesBatch} from './render-png'
import {SeededRandom, setGlobalRng} from './seeded-random'

interface GenerateOptions {
	minSize: number
	maxSize: number
	perSize: number
	output: string
	seed?: number
	verbose: boolean
	maxAttempts: number
}

function parseArgs(): GenerateOptions {
	const args = process.argv.slice(2)
	const opts: GenerateOptions = {
		minSize: 3,
		maxSize: 9,
		perSize: 4,
		output: 'output',
		verbose: false,
		maxAttempts: 500
	}

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--min-size':
				opts.minSize = parseInt(args[++i], 10)
				break
			case '--max-size':
				opts.maxSize = parseInt(args[++i], 10)
				break
			case '--per-size':
				opts.perSize = parseInt(args[++i], 10)
				break
			case '--output':
				opts.output = args[++i]
				break
			case '--seed':
				opts.seed = parseInt(args[++i], 10)
				break
			case '--verbose':
				opts.verbose = true
				break
			case '--max-attempts':
				opts.maxAttempts = parseInt(args[++i], 10)
				break
			case '--help':
				console.log(`
KenKen Batch Generator

Usage: npm run generate -- [options]

Options:
  --min-size N      Minimum board size (default: 3)
  --max-size N      Maximum board size (default: 9)
  --per-size N      Number of puzzles per size (default: 4)
  --output DIR      Output directory (default: output)
  --seed N          Random seed for reproducibility
  --verbose         Show detailed progress
  --max-attempts N  Max generation attempts per puzzle (default: 500)
  --help            Show this help message
`)
				process.exit(0)
				break
			default:
				console.error(`Unknown argument: ${args[i]}`)
				process.exit(1)
		}
	}

	return opts
}

interface GeneratedPuzzle {
	n: number
	cages: Cage[]
	solution: number[][]
	filename: string
}

/**
 * Verify that the solution satisfies all cage constraints.
 */
function verifySolutionSatisfiesCages(cages: Cage[], solution: number[][]): boolean {
	for (const cage of cages) {
		const values = cage.boxes.map(([r, c]) => solution[r][c])
		if (!checkCageValues(cage.op, cage.val, values)) {
			return false
		}
	}
	return true
}

async function main() {
	const opts = parseArgs()

	// Initialize RNG
	if (opts.seed !== undefined) {
		console.log(`Using seed: ${opts.seed}`)
		setGlobalRng(new SeededRandom(opts.seed))
	} else {
		const seed = Date.now()
		console.log(`Using random seed: ${seed}`)
		setGlobalRng(new SeededRandom(seed))
	}

	// Create output directories
	const imagesDir = path.join(opts.output, 'images')
	fs.mkdirSync(imagesDir, {recursive: true})

	const allPuzzles: GeneratedPuzzle[] = []
	const renderQueue: {n: number; cages: Cage[]; outputPath: string}[] = []

	console.log(`\nGenerating KenKen puzzles:`)
	console.log(`  Sizes: ${opts.minSize}x${opts.minSize} to ${opts.maxSize}x${opts.maxSize}`)
	console.log(`  Per size: ${opts.perSize}`)
	console.log(`  Total: ${(opts.maxSize - opts.minSize + 1) * opts.perSize} puzzles`)
	console.log(`  Output: ${path.resolve(opts.output)}\n`)

	for (let n = opts.minSize; n <= opts.maxSize; n++) {
		const sizePuzzles: GeneratedPuzzle[] = []
		const fingerprints = new Set<string>()
		let attempts = 0
		let rejected = 0

		while (sizePuzzles.length < opts.perSize) {
			attempts++
			if (attempts > opts.maxAttempts) {
				console.error(
					`\nFailed to generate ${opts.perSize} unique ${n}x${n} puzzles ` +
					`after ${opts.maxAttempts} attempts (generated ${sizePuzzles.length}). ` +
					`Try increasing --max-attempts.`
				)
				process.exit(1)
			}

			if (opts.verbose) {
				process.stdout.write(`  Generating ${n}x${n}: ${sizePuzzles.length + 1}/${opts.perSize} (attempt ${attempts})...\r`)
			}

			// 1. Generate latin square
			const board = makeBoard(n)

			// 2. Generate cages
			const cages = makeCages(board)

			// 3. Validate structure
			const puzzle: Puzzle = {max: n, cages}
			const structResult = validateStructure(puzzle)
			if (!structResult.valid) {
				if (opts.verbose) {
					console.log(`  Rejected ${n}x${n}: structure invalid - ${structResult.errors[0]}`)
				}
				rejected++
				continue
			}

			// 4. Verify solution satisfies cages
			if (!verifySolutionSatisfiesCages(cages, board)) {
				if (opts.verbose) {
					console.log(`  Rejected ${n}x${n}: solution doesn't satisfy cages`)
				}
				rejected++
				continue
			}

			// 5. Check for duplicate (normalization)
			const fingerprint = normalizeCages(cages)
			if (fingerprints.has(fingerprint)) {
				if (opts.verbose) {
					console.log(`  Rejected ${n}x${n}: duplicate puzzle`)
				}
				rejected++
				continue
			}

			// 6. Verify unique solution (the critical check)
			const solutionCount = countSolutions(puzzle, 2)
			if (solutionCount === 0) {
				if (opts.verbose) {
					console.log(`  Rejected ${n}x${n}: no solution found by backtracker`)
				}
				rejected++
				continue
			}
			if (solutionCount >= 2) {
				if (opts.verbose) {
					console.log(`  Rejected ${n}x${n}: multiple solutions`)
				}
				rejected++
				continue
			}

			// 7. Accept puzzle
			fingerprints.add(fingerprint)
			const idx = sizePuzzles.length + 1
			const filename = imageFilename(n, idx)
			const generatedPuzzle: GeneratedPuzzle = {
				n,
				cages,
				solution: board,
				filename
			}
			sizePuzzles.push(generatedPuzzle)

			const outputPath = path.join(imagesDir, filename)
			renderQueue.push({n, cages, outputPath})

			console.log(`  Accepted ${n}x${n} puzzle ${idx}/${opts.perSize}: unique solution (attempt ${attempts}, ${rejected} rejected)`)
		}

		// Save JSON for this size
		const jsonData = buildOutputJson(
			n,
			sizePuzzles.map(p => ({filename: p.filename, cages: p.cages}))
		)
		const jsonPath = path.join(opts.output, `${n}x${n}.json`)
		fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8')
		console.log(`  Saved ${jsonPath}`)

		// Optionally save solutions for debugging
		const solutionsPath = path.join(opts.output, `${n}x${n}_solutions.json`)
		const solutions = sizePuzzles.map(p => ({
			filename: p.filename,
			solution: p.solution
		}))
		fs.writeFileSync(solutionsPath, JSON.stringify(solutions, null, 2), 'utf8')

		allPuzzles.push(...sizePuzzles)
		console.log(`  ${n}x${n} complete: ${sizePuzzles.length} puzzles, ${attempts} attempts, ${rejected} rejected\n`)
	}

	// Render all PNGs
	console.log(`Rendering ${renderQueue.length} PNG images...`)
	try {
		await renderPuzzlesBatch(renderQueue)
		console.log(`All PNG images saved to ${imagesDir}`)
	} catch (err) {
		console.error(`\nPNG rendering failed: ${err instanceof Error ? err.message : err}`)
		console.error('JSON files have been saved. To fix PNG rendering:')
		console.error('  npx playwright install chromium')
		process.exit(1)
	}

	// Final summary
	console.log(`\n${'='.repeat(50)}`)
	console.log(`Generation complete!`)
	console.log(`  Total puzzles: ${allPuzzles.length}`)
	console.log(`  Output directory: ${path.resolve(opts.output)}`)
	console.log(`${'='.repeat(50)}`)
}

main().catch(err => {
	console.error('Fatal error:', err)
	process.exit(1)
})
