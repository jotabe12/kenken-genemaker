/**
 * Render KenKen puzzles as PNG images using Playwright.
 * Generates self-contained HTML, opens in headless Chromium, takes screenshot.
 */

import {Cage} from './types'

/** Display symbols for operations */
const DISPLAY_OPS: Record<string, string> = {
	'=': '',
	'*': '×',
	'/': '÷',
	'+': '+',
	'-': '-'
}

/** Generate self-contained HTML for a puzzle */
export function generatePuzzleHtml(n: number, cages: Cage[]): string {
	const cellSize = Math.max(50, Math.min(80, 400 / n))
	const fontSize = Math.max(10, Math.min(16, cellSize * 0.28))
	const borderWidth = Math.max(2, Math.min(4, cellSize * 0.05))
	const thinBorder = Math.max(1, borderWidth * 0.5)
	const totalSize = cellSize * n + borderWidth * 2

	// Map each cell to its cage
	const cellCageMap = new Map<string, number>()
	for (let ci = 0; ci < cages.length; ci++) {
		for (const [r, c] of cages[ci].boxes) {
			cellCageMap.set(`${r},${c}`, ci)
		}
	}

	// Find top-left cell of each cage for label placement
	const cageLabels = new Map<string, string>()
	for (const cage of cages) {
		let topLeft: [number, number] = [Infinity, Infinity]
		for (const [r, c] of cage.boxes) {
			if (r < topLeft[0] || (r === topLeft[0] && c < topLeft[1])) {
				topLeft = [r, c]
			}
		}
		let displayOp = DISPLAY_OPS[cage.op] ?? cage.op
		const label = `${cage.val}${displayOp}`
		cageLabels.set(`${topLeft[0]},${topLeft[1]}`, label)
	}

	// Build CSS classes for each cell's borders
	const cellStyles: string[][] = []
	for (let r = 0; r < n; r++) {
		cellStyles[r] = []
		for (let c = 0; c < n; c++) {
			const myIdx = cellCageMap.get(`${r},${c}`)
			const borders: string[] = []
			// Top border
			if (r === 0 || cellCageMap.get(`${r - 1},${c}`) !== myIdx) {
				borders.push('bt')
			}
			// Left border
			if (c === 0 || cellCageMap.get(`${r},${c - 1}`) !== myIdx) {
				borders.push('bl')
			}
			// Right border
			if (c === n - 1 || cellCageMap.get(`${r},${c + 1}`) !== myIdx) {
				borders.push('br')
			}
			// Bottom border
			if (r === n - 1 || cellCageMap.get(`${r + 1},${c}`) !== myIdx) {
				borders.push('bb')
			}
			cellStyles[r][c] = borders.join(' ')
		}
	}

	// Generate HTML
	const html = `<!DOCTYPE html>
<html>
<head>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
	background: white; 
	display: flex; 
	justify-content: center; 
	align-items: center;
	width: ${totalSize}px;
	height: ${totalSize}px;
}
table { 
	border-collapse: collapse; 
	border: ${borderWidth}px solid #000;
}
td { 
	width: ${cellSize}px; 
	height: ${cellSize}px; 
	position: relative;
	border: ${thinBorder}px dashed #999;
	vertical-align: top;
	padding: 2px 3px;
	font-family: Arial, Helvetica, sans-serif;
	font-size: ${fontSize}px;
	font-weight: bold;
	color: #333;
}
.bt { border-top: ${borderWidth}px solid #000; }
.bl { border-left: ${borderWidth}px solid #000; }
.br { border-right: ${borderWidth}px solid #000; }
.bb { border-bottom: ${borderWidth}px solid #000; }
</style>
</head>
<body>
<table>
${Array.from({length: n}, (_, r) => 
	`<tr>${Array.from({length: n}, (_, c) => {
		const classes = cellStyles[r][c]
		const label = cageLabels.get(`${r},${c}`) || ''
		return `<td class="${classes}">${label}</td>`
	}).join('')}</tr>`
).join('\n')}
</table>
</body>
</html>`

	return html
}

/** Render a puzzle to a PNG file using Playwright */
export async function renderPuzzlePng(
	n: number,
	cages: Cage[],
	outputPath: string
): Promise<void> {
	const html = generatePuzzleHtml(n, cages)

	// Dynamically import playwright to handle missing browser gracefully
	let chromium: typeof import('playwright').chromium
	try {
		const pw = await import('playwright')
		chromium = pw.chromium
	} catch (_e) {
		throw new Error(
			'Playwright is not installed. Run: npm install playwright && npx playwright install chromium'
		)
	}

	const cellSize = Math.max(50, Math.min(80, 400 / n))
	const borderWidth = Math.max(2, Math.min(4, cellSize * 0.05))
	const totalSize = Math.ceil(cellSize * n + borderWidth * 2 + 10) // small padding

	let browser
	try {
		browser = await chromium.launch({headless: true})
	} catch (_e) {
		throw new Error(
			'Chromium browser not found. Run: npx playwright install chromium'
		)
	}

	try {
		const page = await browser.newPage()
		await page.setViewportSize({width: totalSize + 20, height: totalSize + 20})
		await page.setContent(html, {waitUntil: 'networkidle'})

		// Screenshot just the table
		const table = await page.$('table')
		if (!table) throw new Error('Could not find table element')

		await table.screenshot({path: outputPath, type: 'png'})
	} finally {
		await browser.close()
	}
}

/**
 * Render multiple puzzles sharing a single browser instance for efficiency.
 */
export async function renderPuzzlesBatch(
	puzzles: {n: number; cages: Cage[]; outputPath: string}[]
): Promise<void> {
	if (puzzles.length === 0) return

	let chromium: typeof import('playwright').chromium
	try {
		const pw = await import('playwright')
		chromium = pw.chromium
	} catch (_e) {
		throw new Error(
			'Playwright is not installed. Run: npm install playwright && npx playwright install chromium'
		)
	}

	let browser
	try {
		browser = await chromium.launch({headless: true})
	} catch (_e) {
		throw new Error(
			'Chromium browser not found. Run: npx playwright install chromium'
		)
	}

	try {
		for (const {n, cages, outputPath} of puzzles) {
			const html = generatePuzzleHtml(n, cages)
			const cellSize = Math.max(50, Math.min(80, 400 / n))
			const borderWidth = Math.max(2, Math.min(4, cellSize * 0.05))
			const totalSize = Math.ceil(cellSize * n + borderWidth * 2 + 10)

			const page = await browser.newPage()
			await page.setViewportSize({width: totalSize + 20, height: totalSize + 20})
			await page.setContent(html, {waitUntil: 'networkidle'})

			const table = await page.$('table')
			if (!table) throw new Error('Could not find table element for ' + outputPath)

			await table.screenshot({path: outputPath, type: 'png'})
			await page.close()
		}
	} finally {
		await browser.close()
	}
}
