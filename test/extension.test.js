const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");
const fs = require("fs");

// --- Test-time module shims (replaces webpack asset/source and vscode external) ---

// Handle require("./webview.html") without webpack
require.extensions[".html"] = function (module, filename) {
	module.exports = fs.readFileSync(filename, "utf-8");
};

// Handlers the extension registers on the fake vscode module, captured so tests can fire them
const handlers = {};

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
			onDidChangeActiveTextEditor: (handler) => {
				handlers.activeEditor = handler;
				return { dispose: () => {} };
			},
		},
		workspace: {
			onDidChangeTextDocument: () => ({ dispose: () => {} }),
		},
		commands: {
			registerCommand: (id, fn) => {
				handlers.command = fn;
				return { dispose: () => {} };
			},
		},
		ViewColumn: { Beside: 2 },
		Uri: { joinPath: () => ({ toString: () => "" }) },
		ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
	},
};

// --- Load the extension module ---
const { activate, extractHeadings, buildTOCTree, generateTOC, getNonce, escapeHtml, renderMarkdown, getWebviewContent, CDN_VERSIONS } = require("../src/extension");

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

	it("is hexadecimal", () => {
		assert.match(getNonce(), /^[0-9a-f]{32}$/);
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

// ============================================================================
// escapeHtml
// ============================================================================
describe("escapeHtml", () => {
	it("escapes &, <, > and double quotes", () => {
		assert.equal(escapeHtml("<a href=\"x\">&</a>"), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
	});

	it("leaves plain text unchanged", () => {
		assert.equal(escapeHtml("plain text 123"), "plain text 123");
	});
});

// ============================================================================
// generateTOC escaping
// ============================================================================
describe("generateTOC escaping", () => {
	it("escapes HTML in heading text", () => {
		const html = generateTOC(extractHeadings("# <img src=x onerror=alert(1)>"));
		assert.ok(!html.includes("<img"));
		assert.ok(html.includes("&lt;img"));
	});
});

// ============================================================================
// renderMarkdown
// ============================================================================
describe("renderMarkdown", () => {
	it("preserves inline and block math with delimiters intact", () => {
		const { html } = renderMarkdown("Energy $E = mc^2$ here\n\n$$\n\\int x\n$$\n");
		assert.ok(html.includes("$E = mc^2$"));
		assert.ok(html.includes("$$\n\\int x\n$$"));
	});

	it("escapes HTML characters inside math", () => {
		const { html } = renderMarkdown("$a<b$");
		assert.ok(html.includes("$a&lt;b$"));
	});

	it("keeps dollar signs inside Mermaid blocks out of math extraction", () => {
		const { html } = renderMarkdown("```mermaid\ngraph TD\n  A[\"$5\"] --> B[\"$6\"]\n```\n");
		assert.ok(html.includes("<pre class=\"mermaid\">"));
		assert.ok(html.includes("$5") && html.includes("$6"));
		assert.ok(!html.includes("PRESERVED_"));
	});

	it("renders both Mermaid syntaxes identically", () => {
		const a = renderMarkdown("```mermaid\ngraph TD\n  A-->B\n```\n").html;
		const b = renderMarkdown("::: mermaid\ngraph TD\n  A-->B\n:::\n").html;
		assert.equal(a, b);
	});

	it("escapes markup in Mermaid source so it cannot break out of the pre element", () => {
		const { html } = renderMarkdown("```mermaid\ngraph TD\n  A[</pre><img src=x>]\n```\n");
		assert.ok(!html.includes("<img src=x>"));
	});

	it("adds heading IDs matching the extracted headings", () => {
		const { html, headings } = renderMarkdown("# Title\n\n## Sub\n");
		assert.equal(headings.length, 2);
		for (const h of headings) {
			assert.ok(html.includes(`<h${h.level} id="${h.id}">`));
		}
	});
});

// ============================================================================
// getWebviewContent
// ============================================================================
describe("getWebviewContent", () => {
	const theme = { mermaidTheme: "default", hljsTheme: "https://example.test/theme.css" };
	const page = getWebviewContent("<p>x</p>", "NONCE123", [], theme);

	it("leaves no unreplaced placeholders", () => {
		assert.ok(!/\{\{[A-Z_]+\}\}/.test(page));
	});

	it("loads every CDN library at its pinned version", () => {
		assert.ok(page.includes(`mermaid@${CDN_VERSIONS.mermaid}/`));
		assert.ok(page.includes(`mathjax@${CDN_VERSIONS.mathjax}/`));
		assert.ok(page.includes(`cdn-assets@${CDN_VERSIONS.highlightjs}/`));
		assert.ok(!/(mermaid|mathjax)@\d+\//.test(page), "floating major version found");
	});

	it("puts the nonce on every script tag and in the CSP", () => {
		const scripts = page.match(/<script\b[^>]*>/g);
		assert.ok(scripts.length >= 4);
		for (const tag of scripts) {
			assert.ok(tag.includes("nonce=\"NONCE123\""), tag);
		}
		assert.ok(page.includes("'nonce-NONCE123'"));
	});
});

// ============================================================================
// getWebviewContent placeholders
// ============================================================================
describe("getWebviewContent placeholders", () => {
	const theme = { mermaidTheme: "default", hljsTheme: "https://example.test/theme.css" };

	it("writes an escaped document key for the scroll position", () => {
		const page = getWebviewContent("", "N", [], theme, "file:///a\"b.md");
		assert.ok(page.includes("data-doc=\"file:///a&quot;b.md\""));
	});

	it("does not substitute placeholder text that appears inside content", () => {
		const page = getWebviewContent("<p>{{TOC}} and {{NONCE}}</p>", "N", extractHeadings("# {{CONTENT}}"), theme);
		assert.ok(page.includes("<p>{{TOC}} and {{NONCE}}</p>"));
		assert.ok(page.includes("{{CONTENT}}"));
	});
});

// ============================================================================
// Following the active editor
// ============================================================================
describe("active editor following", () => {
	const vscode = require("vscode");
	const makeDoc = (name, text, languageId = "markdown", scheme = "file") => ({
		languageId,
		getText: () => text,
		uri: { scheme, path: `/${name}`, with: () => ({}), toString: () => `${scheme}:///${name}` },
	});
	const docA = makeDoc("a.md", "# Alpha heading");
	const docB = makeDoc("b.md", "# Beta heading");
	let panel;

	const open = (doc) => {
		panel = { webview: { html: "", asWebviewUri: (u) => u }, reveal() {}, onDidDispose() {} };
		vscode.window.createWebviewPanel = () => panel;
		vscode.window.activeTextEditor = { document: doc };
		activate({ extensionUri: {}, subscriptions: [] });
		handlers.command();
	};

	it("renders the file the command was run on", () => {
		open(docA);
		assert.ok(panel.webview.html.includes("Alpha heading"));
	});

	it("switches to another Markdown editor when it becomes active", () => {
		open(docA);
		handlers.activeEditor({ document: docB });
		assert.ok(panel.webview.html.includes("Beta heading"));
		assert.ok(!panel.webview.html.includes("Alpha heading"));
	});

	it("keeps the preview when focus moves to the panel (no editor)", () => {
		open(docA);
		handlers.activeEditor(undefined);
		assert.ok(panel.webview.html.includes("Alpha heading"));
	});

	it("keeps the preview when a non-Markdown file becomes active", () => {
		open(docA);
		handlers.activeEditor({ document: makeDoc("c.js", "const x = 1;", "javascript") });
		assert.ok(panel.webview.html.includes("Alpha heading"));
	});

	it("ignores the git side of a diff", () => {
		open(docA);
		handlers.activeEditor({ document: makeDoc("a.md", "# Old revision", "markdown", "git") });
		assert.ok(panel.webview.html.includes("Alpha heading"));
	});

	it("does nothing when no preview is open", () => {
		open(docA);
		panel.webview.html = "";
		// A fresh activation has no panel; its handler replaces the previous one
		activate({ extensionUri: {}, subscriptions: [] });
		handlers.activeEditor({ document: docB });
		assert.equal(panel.webview.html, "");
	});
});
