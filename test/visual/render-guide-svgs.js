/**
 * Draws the pre-drawn copies of the diagrams in docs/d2.md.
 *
 * Why it exists: GitHub shows a Markdown page without this extension, so each D2 block in the guide
 * is followed by an image of its picture, stored as an SVG file beside the guide. GitHub drops inline
 * <svg> tags from Markdown, so the pictures are files that an image tag points at. Each file records a
 * hash of the source it was drawn from, and test/guide-svgs.test.js fails when a source changes and
 * its picture does not.
 *
 * Usage: node test/visual/render-guide-svgs.js http://localhost:8080
 * The copies carry both a light theme and a dark theme, so they follow the reader's color scheme.
 */
/* global fetch */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const guide = path.resolve(__dirname, "../../docs/d2.md");

/**
 * Finds every D2 block that is followed by an image, and the file that image names.
 *
 * @param {string} markdown - Text of the guide
 * @returns {{ source: string, file: string }[]} The source of each block and the SVG file path relative to docs/
 */
function findPairs(markdown) {
	return [...markdown.matchAll(/```d2\n([\s\S]*?)\n```\n\n!\[[^\]]*\]\((d2\/[\w-]+\.svg)\)/g)].map((match) => ({ source: match[1], file: match[2] }));
}

/**
 * Hashes a block's source the way the files record it.
 *
 * @param {string} source - Text between the fences
 * @returns {string} Hex SHA-256
 */
function hashOf(source) {
	return crypto.createHash("sha256").update(source).digest("hex");
}

async function main() {
	const base = (process.argv[2] || "").replace(/\/+$/, "");
	if (!base) {
		console.error("usage: node test/visual/render-guide-svgs.js <renderer-url>");
		process.exit(2);
	}
	const pairs = findPairs(fs.readFileSync(guide, "utf8"));
	for (const { source, file } of pairs) {
		// A second vars block merges with the author's own, so the copy gets both themes without changing the source shown
		const themed = `vars: {\n  d2-config: {\n    theme-id: 0\n    dark-theme-id: 200\n  }\n}\n${source}`;
		const payload = zlib.deflateSync(Buffer.from(themed, "utf8"), { level: 9 }).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
		const response = await fetch(`${base}/d2/svg/${payload}`);
		const svg = await response.text();
		if (!response.ok || !svg.includes("<svg")) throw new Error(`${file}: ${response.status} ${svg.slice(0, 200)}`);
		const out = svg.replace(/^(<\?xml[^>]*\?>)?/, (xml) => `${xml || ""}<!-- d2-source-sha256: ${hashOf(source)} -->`);
		fs.writeFileSync(path.resolve(path.dirname(guide), file), out);
		console.log(`${file}: ${out.length} bytes`);
	}
}

if (require.main === module) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}

module.exports = { findPairs, hashOf };
