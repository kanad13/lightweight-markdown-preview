/**
 * Builds static copies of the preview page so a person or an agent can LOOK at them.
 *
 * Why it exists: unit tests prove the markup and the CSP string, but only a
 * browser shows whether a diagram appears, a label is clipped, or the CSP blocks
 * the renderer. The pages come from the extension's real output (the same
 * `activate` path and the same webview.html), with VS Code's color variables
 * added so light, dark and high-contrast themes look like the editor.
 *
 * Usage: node test/visual/build-visual-check.js <out-dir> [--renderer name=URL]... [--doc file.md]... [--only doc,doc] [--themes light,dark]
 * `--only` and `--themes` keep a run small, which matters for a shared renderer on a small budget.
 * Renderer URLs are arguments, never stored in the repository. Serve <out-dir>
 * over http and open index.html.
 */
const fs = require("fs");
const path = require("path");
const { install, settings, vscode, makeDoc, openPreview } = require("../helpers/fake-vscode");

install();
const { activate } = require("../../src/extension");

/** Color variables the editor provides, for the three theme kinds the extension distinguishes */
const THEME_VARIABLES = {
	light: { kind: 1, vars: "--vscode-editor-background:#ffffff;--vscode-editor-foreground:#3b3b3b;--vscode-textCodeBlock-background:#f0f0f0;--vscode-widget-border:#c8c8c8;--vscode-editorWidget-background:#f3f3f3;--vscode-inputValidation-warningBackground:#f6f5d2;--vscode-inputValidation-warningBorder:#b89500;--vscode-textLink-foreground:#005fb8;--vscode-descriptionForeground:#717171;--vscode-sideBar-background:#f8f8f8;" },
	dark: { kind: 2, vars: "--vscode-editor-background:#1f1f1f;--vscode-editor-foreground:#cccccc;--vscode-textCodeBlock-background:#2b2b2b;--vscode-widget-border:#454545;--vscode-editorWidget-background:#202020;--vscode-inputValidation-warningBackground:#352a05;--vscode-inputValidation-warningBorder:#b89500;--vscode-textLink-foreground:#4daafc;--vscode-descriptionForeground:#9d9d9d;--vscode-sideBar-background:#181818;" },
	hc: { kind: 3, vars: "--vscode-editor-background:#000000;--vscode-editor-foreground:#ffffff;--vscode-textCodeBlock-background:#000000;--vscode-widget-border:#6fc3df;--vscode-editorWidget-background:#0c141f;--vscode-inputValidation-warningBackground:#000000;--vscode-inputValidation-warningBorder:#b89500;--vscode-textLink-foreground:#21a6ff;--vscode-descriptionForeground:#ffffff;--vscode-sideBar-background:#000000;" },
};

/** A graph with enough nodes to stress layout while the encoded address stays under the extension's limit */
function bigGraph(nodes) {
	const lines = [];
	for (let i = 0; i < nodes; i++) {
		lines.push(`n${i}: Node ${i}`);
		if (i > 0) lines.push(`n${Math.floor((i - 1) / 2)} -> n${i}`);
	}
	return lines.join("\n");
}

/** Documents that exercise the cases in the test plan; each is rendered once per renderer and theme */
const SCENARIOS = {
	types: [
		"# Diagram types",
		"## Plain graph\n```d2\nx -> y: Ping\ny -> x: Pong\n```",
		"## Containers\n```d2\nCloud: {\n  api: API\n  worker: Worker\n  api -> worker: queue\n}\nUser -> Cloud.api\n```",
		"## SQL table\n```d2\nusers: {\n  shape: sql_table\n  id: int {constraint: primary_key}\n  email: varchar\n}\norders: {\n  shape: sql_table\n  id: int {constraint: primary_key}\n  user_id: int {constraint: foreign_key}\n}\norders.user_id -> users.id\n```",
		"## Sequence\n```d2\nshape: sequence_diagram\nalice -> bob: hello\nbob -> alice: hi\n```",
		"## Unicode and emoji\n```d2\nUser: Käyttäjä 🙂\n日本語: 注文\nUser -> 日本語: ✓ 送信\n```",
		"## Larger graph\n```d2\n" + bigGraph(40) + "\n```",
	].join("\n\n"),
	mixed: [
		"# Mixed document",
		"Inline math $a^2 + b^2 = c^2$ and a price of $5 and $10.",
		"```mermaid\nflowchart LR\n  A --> B --> C\n```",
		"```d2\nclient -> server: request\nserver -> db: query\n```",
		"$$ \\int_0^1 x^2 \\, dx = \\tfrac{1}{3} $$",
		"```python\nprint('hello')\n```",
		"- A list item\n\n  ```d2\n  in -> list\n  ```\n- Another item",
		"> ```d2\n> quoted -> diagram\n> ```",
	].join("\n\n"),
	many: ["# Many blocks", ...Array.from({ length: 12 }, (_, i) => `## Block ${i + 1}\n\n\`\`\`d2\na${i} -> b${i}: step ${i + 1}\n\`\`\``)].join("\n\n"),
	errors: [
		"# Errors",
		"## Syntax error (renderer answers 400)\n```d2\nx -> -> y {\n```",
		"## Valid block after the error\n```d2\nstill -> works\n```",
		"## Empty block\n```d2\n```",
		"## Compressible source over the renderer limit (413)\n```d2\n" + "a -> b\n".repeat(50000) + "\n```",
	].join("\n\n"),
	// No heading, so the page is only the diagram and the four option variants can be compared side by side
	options: "```d2\ndirection: right\nclient -> gateway -> auth\ngateway -> orders -> db\norders -> payments -> db\nauth -> db\n```",
};

/** Settings variants: name, then the d2 settings to apply on top of the renderer URL */
const VARIANTS = {
	default: {},
	sketch: { sketch: true },
	elk: { layout: "elk" },
	tala: { layout: "tala" },
};

/**
 * Renders one page with the real extension.
 *
 * @param {string} markdown - Document text
 * @param {string} rendererUrl - Value for the rendererUrl setting
 * @param {string} theme - Key of THEME_VARIABLES
 * @param {{ sketch?: boolean, layout?: string }} variant - Extra D2 settings
 * @returns {string} Complete HTML page
 */
function renderPage(markdown, rendererUrl, theme, variant) {
	for (const key of Object.keys(settings)) delete settings[key];
	settings["lightweightMarkdownViewer.d2.rendererUrl"] = rendererUrl;
	if (variant.sketch) settings["lightweightMarkdownViewer.d2.sketch"] = true;
	if (variant.layout) settings["lightweightMarkdownViewer.d2.layout"] = variant.layout;
	vscode.window.activeColorTheme.kind = THEME_VARIABLES[theme].kind;
	const html = openPreview(activate, makeDoc("/visual/doc.md", markdown)).webview.html;
	// The editor supplies these variables; outside it the page would have no colors
	return html.replace("</head>", `<style>:root{${THEME_VARIABLES[theme].vars}}</style></head>`);
}

function main() {
	const args = process.argv.slice(2);
	const out = args.shift();
	if (!out) {
		console.error("usage: node test/visual/build-visual-check.js <out-dir> [--renderer name=URL]... [--doc file.md]... [--only doc,doc] [--themes light,dark]");
		process.exit(2);
	}
	const renderers = {};
	const extraDocs = {};
	let only;
	let themes = Object.keys(THEME_VARIABLES);
	for (let i = 0; i < args.length; i += 2) {
		if (args[i] === "--renderer") {
			const [name, ...rest] = args[i + 1].split("=");
			renderers[name] = rest.join("=");
		} else if (args[i] === "--only") {
			only = args[i + 1].split(",");
		} else if (args[i] === "--themes") {
			themes = args[i + 1].split(",");
		} else if (args[i] === "--doc") {
			extraDocs[path.basename(args[i + 1], ".md")] = fs.readFileSync(args[i + 1], "utf8");
		}
	}
	renderers.empty = renderers.empty ?? "";
	fs.mkdirSync(out, { recursive: true });
	const pages = [];
	const write = (name, html) => {
		fs.writeFileSync(path.join(out, `${name}.html`), html);
		pages.push(name);
	};
	const docs = { ...SCENARIOS, ...extraDocs };
	for (const [renderer, url] of Object.entries(renderers)) {
		for (const [doc, markdown] of Object.entries(docs)) {
			if (only && !only.includes(doc)) continue;
			for (const theme of themes) {
				for (const [variantName, variant] of Object.entries(VARIANTS)) {
					// Options matter for the 'options' document; other documents only need the default variant
					if (variantName !== "default" && doc !== "options") continue;
					if (theme !== "light" && variantName !== "default") continue;
					if (theme === "hc" && !["types", "mixed"].includes(doc) && !(doc in extraDocs)) continue;
					write(`${renderer}--${doc}--${theme}--${variantName}`, renderPage(markdown, url, theme, variant));
				}
			}
		}
	}
	fs.writeFileSync(path.join(out, "index.html"), `<!doctype html><meta charset="utf-8"><title>visual check</title><ul>${pages.map((p) => `<li><a href="${p}.html">${p}</a></li>`).join("")}</ul>`);
	console.log(`wrote ${pages.length} pages to ${out}`);
}

main();
