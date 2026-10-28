/**
 * Tests that every D2 diagram in docs/d2.md has a pre-drawn SVG copy that matches its source.
 *
 * Why it exists: GitHub readers see the guide without the extension, so each D2 block is followed by an
 * image of its picture. The copies are generated files, so an edit to a source that does not regenerate
 * its picture would leave the page showing a diagram that no longer matches the text above it.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { findPairs, hashOf } = require("./visual/render-guide-svgs");

const docsDir = path.resolve(__dirname, "../docs");
const guide = fs.readFileSync(path.join(docsDir, "d2.md"), "utf8");
const pairs = findPairs(guide);

describe("guide diagrams", () => {
	it("every D2 block in the guide is followed by its picture", () => {
		const blocks = (guide.match(/^```d2$/gm) || []).length;
		assert.ok(blocks >= 5, `${blocks} D2 blocks`);
		assert.equal(pairs.length, blocks, "a D2 block has no picture after it");
	});

	it("no two blocks share a picture", () => {
		assert.equal(new Set(pairs.map((pair) => pair.file)).size, pairs.length);
	});

	for (const { source, file } of pairs) {
		describe(file, () => {
			const svg = fs.existsSync(path.join(docsDir, file))
				? fs.readFileSync(path.join(docsDir, file), "utf8")
				: "";

			it("exists and is a drawing", () => {
				assert.ok(svg.includes("<svg") && svg.includes("</svg>") && /viewBox="/.test(svg));
				assert.ok(svg.length < 200 * 1024, `${svg.length} bytes`);
			});

			it("was drawn from the source above it", () => {
				const recorded = /<!-- d2-source-sha256: ([0-9a-f]{64}) -->/.exec(svg)?.[1];
				assert.equal(recorded, hashOf(source), "run: node test/visual/render-guide-svgs.js <renderer-url>");
			});

			it("holds no script and loads nothing from the network", () => {
				assert.ok(!/<script/i.test(svg));
				assert.ok(!/(?:href|src)="https?:/i.test(svg));
			});

			it("follows the reader's light or dark color scheme", () => {
				assert.ok(svg.includes("prefers-color-scheme"));
			});
		});
	}
});
