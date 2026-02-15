const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");
const fs = require("fs");

// --- Test-time module shims (replaces webpack asset/source and vscode external) ---

// Handle require("./webview.html") without webpack
require.extensions[".html"] = function (module, filename) {
	module.exports = fs.readFileSync(filename, "utf-8");
};

// Handle require("vscode") without VS Code runtime
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request) {
	if (request === "vscode") return "vscode";
	return origResolve.apply(this, arguments);
};
require.cache["vscode"] = {
	id: "vscode",
	filename: "vscode",
	loaded: true,
	exports: {
		window: {
			activeColorTheme: { kind: 1 },
			showErrorMessage: () => {},
			onDidChangeActiveColorTheme: () => ({ dispose: () => {} }),
		},
		workspace: {
			onDidChangeTextDocument: () => ({ dispose: () => {} }),
		},
		commands: {
			registerCommand: () => ({ dispose: () => {} }),
		},
		ViewColumn: { Beside: 2 },
		Uri: { joinPath: () => ({ toString: () => "" }) },
		ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
	},
};

// --- Load the extension module ---
const { extractHeadings, buildTOCTree, generateTOC, getNonce } = require("../src/extension");

// ============================================================================
// extractHeadings
// ============================================================================
describe("extractHeadings", () => {
	it("extracts h1–h6 headings", () => {
		const md = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6";
		const result = extractHeadings(md);
		assert.equal(result.length, 6);
		assert.deepEqual(result.map(h => h.level), [1, 2, 3, 4, 5, 6]);
		assert.deepEqual(result.map(h => h.text), ["H1", "H2", "H3", "H4", "H5", "H6"]);
	});

	it("returns empty array for input with no headings", () => {
		assert.deepEqual(extractHeadings("Just a paragraph.\nAnother line."), []);
	});

	it("returns empty array for empty string", () => {
		assert.deepEqual(extractHeadings(""), []);
	});

	it("ignores headings inside backtick code blocks", () => {
		const md = "# Real\n```\n# Fake\n```\n## Also Real";
		const result = extractHeadings(md);
		assert.equal(result.length, 2);
		assert.equal(result[0].text, "Real");
		assert.equal(result[1].text, "Also Real");
	});

	it("ignores headings inside triple-colon mermaid blocks", () => {
		const md = "# Before\n::: mermaid\n# Not a heading\n:::\n## After";
		const result = extractHeadings(md);
		assert.equal(result.length, 2);
		assert.equal(result[0].text, "Before");
		assert.equal(result[1].text, "After");
	});

	it("handles nested code blocks correctly", () => {
		const md = "# A\n```\ncode\n```\n# B\n```\n# C inside code\n```\n# D";
		const result = extractHeadings(md);
		assert.equal(result.length, 3);
		assert.deepEqual(result.map(h => h.text), ["A", "B", "D"]);
	});

	it("generates URL-friendly IDs", () => {
		const md = "# Hello World!";
		const result = extractHeadings(md);
		assert.match(result[0].id, /^heading-hello-world-0$/);
	});

	it("strips special characters from IDs", () => {
		const md = "## C++ & Java: A Comparison";
		const result = extractHeadings(md);
		// Special chars stripped, spaces become hyphens
		assert.ok(!result[0].id.includes("&"));
		assert.ok(!result[0].id.includes(":"));
		assert.ok(!result[0].id.includes("+"));
	});

	it("requires a space after the hash marks", () => {
		const md = "#NoSpace\n## Has Space";
		const result = extractHeadings(md);
		assert.equal(result.length, 1);
		assert.equal(result[0].text, "Has Space");
	});

	it("ignores lines with more than 6 hashes", () => {
		const md = "####### Not a heading\n###### Valid H6";
		const result = extractHeadings(md);
		assert.equal(result.length, 1);
		assert.equal(result[0].level, 6);
	});

	it("records correct lineIndex for each heading", () => {
		const md = "paragraph\n# First\nparagraph\n## Second";
		const result = extractHeadings(md);
		assert.equal(result[0].lineIndex, 1);
		assert.equal(result[1].lineIndex, 3);
	});
});

// ============================================================================
// buildTOCTree
// ============================================================================
describe("buildTOCTree", () => {
	it("returns empty array for no headings", () => {
		assert.deepEqual(buildTOCTree([]), []);
	});

	it("puts same-level headings as siblings at root", () => {
		const headings = [
			{ level: 2, text: "A", id: "a" },
			{ level: 2, text: "B", id: "b" },
			{ level: 2, text: "C", id: "c" },
		];
		const tree = buildTOCTree(headings);
		assert.equal(tree.length, 3);
		tree.forEach(node => assert.equal(node.children.length, 0));
	});

	it("nests lower-level headings under higher-level parents", () => {
		const headings = [
			{ level: 1, text: "Parent", id: "p" },
			{ level: 2, text: "Child", id: "c" },
			{ level: 3, text: "Grandchild", id: "gc" },
		];
		const tree = buildTOCTree(headings);
		assert.equal(tree.length, 1);
		assert.equal(tree[0].heading.text, "Parent");
		assert.equal(tree[0].children.length, 1);
		assert.equal(tree[0].children[0].heading.text, "Child");
		assert.equal(tree[0].children[0].children.length, 1);
		assert.equal(tree[0].children[0].children[0].heading.text, "Grandchild");
	});

	it("handles skipped levels (h1 → h3 with no h2)", () => {
		const headings = [
			{ level: 1, text: "Top", id: "t" },
			{ level: 3, text: "Deep", id: "d" },
		];
		const tree = buildTOCTree(headings);
		assert.equal(tree.length, 1);
		assert.equal(tree[0].children.length, 1);
		assert.equal(tree[0].children[0].heading.text, "Deep");
	});

	it("handles multiple top-level sections with children", () => {
		const headings = [
			{ level: 1, text: "Section A", id: "a" },
			{ level: 2, text: "Sub A1", id: "a1" },
			{ level: 1, text: "Section B", id: "b" },
			{ level: 2, text: "Sub B1", id: "b1" },
		];
		const tree = buildTOCTree(headings);
		assert.equal(tree.length, 2);
		assert.equal(tree[0].children.length, 1);
		assert.equal(tree[1].children.length, 1);
	});
});

// ============================================================================
// generateTOC
// ============================================================================
describe("generateTOC", () => {
	it("returns 'No headings found' message for empty array", () => {
		const result = generateTOC([]);
		assert.ok(result.includes("No headings found"));
		assert.ok(result.includes("var(--vscode-descriptionForeground)"));
	});

	it("generates a <ul> list for non-empty headings", () => {
		const headings = [{ level: 1, text: "Title", id: "title" }];
		const result = generateTOC(headings);
		assert.ok(result.includes("<ul class=\"toc-list\">"));
		assert.ok(result.includes("Title"));
		assert.ok(result.includes("href=\"#title\""));
	});

	it("uses <details>/<summary> for headings with children", () => {
		const headings = [
			{ level: 1, text: "Parent", id: "p" },
			{ level: 2, text: "Child", id: "c" },
		];
		const result = generateTOC(headings);
		assert.ok(result.includes("<details"));
		assert.ok(result.includes("<summary"));
	});

	it("marks h1 details as open by default", () => {
		const headings = [
			{ level: 1, text: "Open", id: "o" },
			{ level: 2, text: "Child", id: "c" },
		];
		const result = generateTOC(headings);
		assert.ok(result.includes("open"));
	});

	it("shows correct prefix pound signs", () => {
		const headings = [{ level: 3, text: "Heading", id: "h" }];
		const result = generateTOC(headings);
		assert.ok(result.includes("###"));
	});
});

// ============================================================================
// getNonce
// ============================================================================
describe("getNonce", () => {
	it("returns a 32-character string", () => {
		assert.equal(getNonce().length, 32);
	});

	it("contains only alphanumeric characters", () => {
		const nonce = getNonce();
		assert.match(nonce, /^[A-Za-z0-9]{32}$/);
	});

	it("generates different values on successive calls", () => {
		const a = getNonce();
		const b = getNonce();
		assert.notEqual(a, b);
	});
});
