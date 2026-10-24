/**
 * VS Code extension entry point: a lightweight Markdown preview in a webview.
 *
 * Why it exists: the built-in preview is heavier than needed for people who
 * want Mermaid, MathJax, and a navigable outline with nothing else. This file
 * holds all extension logic; `webview.html` supplies the page template.
 *
 * Approach and invariants:
 * - One webview panel, reused across files; state lives in the `activate` closure.
 * - Markdown is rendered in the extension host, then injected as a whole page.
 * - Untrusted text reaches HTML only through `marked` or `escapeHtml`, and the
 *   CSP runs only scripts that carry the per-render nonce.
 */
const crypto = require("crypto");
const vscode = require("vscode");
const { marked } = require("marked");
const webviewTemplate = require("./webview.html");

/**
 * Exact versions of the libraries the webview loads from jsDelivr.
 *
 * Each value is an exact version, so a compromised or regressed upstream
 * release reaches users only after a maintainer reviews it and changes this
 * constant. Selection criteria and upgrade rules live in docs/dependencies.md.
 */
const CDN_VERSIONS = {
	mermaid: "12.1.0",
	mathjax: "4.1.3",
	highlightjs: "11.12.0",
};

/**
 * Escapes the characters that are significant in HTML text and attributes
 *
 * Used wherever untrusted document text is placed into generated markup that
 * marked does not process (TOC entries, preserved math and Mermaid source).
 * Browsers decode the entities back, so MathJax and Mermaid still read the
 * original source from the element text.
 *
 * @param {string} text - Raw text to escape
 * @returns {string} Text safe to embed in HTML
 */
function escapeHtml(text) {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Activation function - called when the extension loads
 *
 * This extension provides a lightweight Markdown preview with Mermaid diagram and MathJax support.
 * It maintains a single webview panel that follows the active Markdown editor.
 *
 * State managed:
 * - currentPanel: The active preview panel (or undefined if closed)
 * - currentDocument: The markdown document currently being previewed
 *
 * This approach prevents resource exhaustion and keeps the extension lightweight.
 *
 * @param {vscode.ExtensionContext} context - Extension context provided by VS Code
 */
function activate(context) {
	// Keep track of current panel to avoid duplicates and enable updates
	let currentPanel = undefined;
	let currentDocument = undefined;
	let updateTimer = undefined;

	const disposable = vscode.commands.registerCommand("lightweightMarkdownViewer.showPreview", function () {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage("No active editor");
			return;
		}

		const doc = editor.document;
		if (doc.languageId !== "markdown") {
			vscode.window.showErrorMessage("Not a Markdown file");
			return;
		}

		if (currentPanel) {
			// If panel exists, reveal it and update content
			currentPanel.reveal(vscode.ViewColumn.Beside);
			currentDocument = doc;
			updateWebviewContent(currentPanel, doc);
		} else {
			// Create new panel with proper options
			const workspaceFolders = vscode.workspace.workspaceFolders;
			const localResourceRoots = [context.extensionUri];

			// Add workspace folder(s) to allow access to markdown files and images
			if (workspaceFolders) {
				localResourceRoots.push(...workspaceFolders.map((folder) => folder.uri));
			}

			currentPanel = vscode.window.createWebviewPanel(
				"markdownPreviewBasic",
				"Markdown Preview",
				vscode.ViewColumn.Beside,
				{
					enableScripts: true, // Required for Mermaid to work
					localResourceRoots: localResourceRoots,
				}
			);

			currentDocument = doc;
			updateWebviewContent(currentPanel, doc);

			// Handle panel disposal
			currentPanel.onDidDispose(
				() => {
					clearTimeout(updateTimer);
					currentPanel = undefined;
					currentDocument = undefined;
				},
				null,
				context.subscriptions
			);
		}
	});

	// Listen for document changes to update preview with debounce
	const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
		if (currentPanel && currentDocument && e.document.uri.toString() === currentDocument.uri.toString()) {
			clearTimeout(updateTimer);
			updateTimer = setTimeout(() => {
				updateWebviewContent(currentPanel, e.document);
			}, 300);
		}
	});

	// Follow the active Markdown editor. The panel itself taking focus reports no editor, and non-Markdown
	// editors keep the last preview. The "git" scheme is the old side of a diff, which must not replace the file being edited.
	const activeEditorSubscription = vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (!currentPanel || !editor) {
			return;
		}
		const doc = editor.document;
		if (doc.languageId !== "markdown" || doc.uri.scheme === "git") {
			return;
		}
		if (currentDocument && doc.uri.toString() === currentDocument.uri.toString()) {
			return;
		}
		// A pending debounced update belongs to the previous file and would overwrite this one
		clearTimeout(updateTimer);
		currentDocument = doc;
		updateWebviewContent(currentPanel, doc);
	});

	// Re-render when VS Code color theme changes (light ↔ dark)
	const themeChangeSubscription = vscode.window.onDidChangeActiveColorTheme(() => {
		if (currentPanel && currentDocument) {
			updateWebviewContent(currentPanel, currentDocument);
		}
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(changeDocumentSubscription);
	context.subscriptions.push(activeEditorSubscription);
	context.subscriptions.push(themeChangeSubscription);
}

/**
 * Resolves and converts image paths to webview-accessible URIs
 *
 * Handles:
 * - Relative paths: Resolved relative to the markdown file's directory
 * - Absolute file paths: Converted to webview-accessible URIs
 * - HTTPS URLs: Passed through unchanged
 * - Data URIs: Passed through unchanged
 *
 * @param {string} imagePath - The image path from markdown
 * @param {vscode.TextDocument} document - The markdown document
 * @param {vscode.WebviewPanel} panel - The webview panel for URI conversion
 * @returns {string} The converted image path or original if not a local file
 */
function resolveImagePath(imagePath, document, panel) {
	// Skip external URLs and data URIs
	if (imagePath.startsWith("http://") || imagePath.startsWith("https://") || imagePath.startsWith("data:")) {
		return imagePath;
	}

	try {
		const documentPath = document.uri;
		const documentDir = documentPath.with({ path: documentPath.path.substring(0, documentPath.path.lastIndexOf("/")) });

		// Resolve relative path against document directory
		let imagePath_parsed;
		if (imagePath.startsWith("/")) {
			// Absolute path - treat as workspace-relative
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (workspaceFolders && workspaceFolders.length > 0) {
				imagePath_parsed = vscode.Uri.joinPath(workspaceFolders[0].uri, imagePath);
			} else {
				return imagePath;
			}
		} else {
			// Relative path - resolve against document directory
			imagePath_parsed = vscode.Uri.joinPath(documentDir, imagePath);
		}

		// Convert to webview-accessible URI
		return panel.webview.asWebviewUri(imagePath_parsed).toString();
	} catch (error) {
		console.error(`Failed to resolve image path: ${imagePath}`, error);
		return imagePath; // Return original if resolution fails
	}
}

/**
 * Extracts headings from markdown raw text
 *
 * Parses markdown headings and returns a nested structure
 * for generating a table of contents.
 *
 * Importantly, this function ignores headings inside code blocks (```...```)
 * to avoid including comment lines from code samples in the TOC.
 *
 * @param {string} raw - The raw markdown text
 * @returns {Array} Array of heading objects with level, text, and id
 */
function extractHeadings(raw) {
	const headings = [];
	const lines = raw.split("\n");
	let insideCodeBlock = false;
	let insideColonBlock = false;

	lines.forEach((line, index) => {
		// Track if we're entering or exiting a backtick code block
		if (line.match(/^```/)) {
			insideCodeBlock = !insideCodeBlock;
			return; // Don't process code fence lines
		}

		// Track triple-colon blocks (Azure DevOps / Fenced Div style)
		if (line.match(/^:::\s*mermaid/)) {
			insideColonBlock = true;
			return;
		}
		if (insideColonBlock && line.match(/^:::\s*$/)) {
			insideColonBlock = false;
			return;
		}

		// Only extract headings if we're NOT inside any block
		if (!insideCodeBlock && !insideColonBlock) {
			const match = line.match(/^(#{1,6})\s+(.+)$/);
			if (match) {
				const level = match[1].length;
				const text = match[2].trim();
				// Create a URL-friendly ID from heading text
				const id = `heading-${text
					.toLowerCase()
					.replace(/[^\w\s-]/g, "")
					.replace(/\s+/g, "-")}-${index}`;

				headings.push({ level, text, id, lineIndex: index });
			}
		}
	});

	return headings;
}

/**
 * Converts markdown source to body HTML plus the heading list for the TOC
 *
 * Pipeline:
 * 1. Extract Mermaid blocks, then block and inline math, before parsing
 * 2. Convert the remaining markdown to HTML with marked
 * 3. Attach heading IDs and restore the preserved blocks
 *
 * Why extraction happens first:
 * - marked would escape or reflow the backticks, delimiters and operators in Mermaid and math source
 * - Mermaid goes first because diagram labels may contain "$", which the math passes would swallow
 * - Preserved source is HTML-escaped; the browser decodes it, so Mermaid and MathJax read the original text
 *
 * @param {string} source - Raw markdown text
 * @returns {{ html: string, headings: Array }} Rendered HTML and extracted headings
 */
function renderMarkdown(source) {
	let raw = source;
	const preservedBlocks = [];
	const preserve = (content) => {
		preservedBlocks.push(content);
		return `<!--PRESERVED_${preservedBlocks.length - 1}-->`;
	};

	const headings = extractHeadings(raw);

	// Both the backtick (```) and triple-colon (:::) forms render, for GitHub and Azure DevOps compatibility
	const preserveMermaid = (match, code) => preserve(`<pre class="mermaid">${escapeHtml(code.trim())}</pre>`);
	raw = raw.replace(/```mermaid\s*\n([\s\S]*?)```/g, preserveMermaid);
	raw = raw.replace(/:::\s*mermaid\s*\n([\s\S]*?):::/g, preserveMermaid);

	// Block math ($$...$$) must come before inline math ($...$)
	const preserveMath = (match) => preserve(escapeHtml(match));
	raw = raw.replace(/\$\$\s*\n[\s\S]*?\$\$/g, preserveMath);
	raw = raw.replace(/\$[^$\n]+\$/g, preserveMath);

	let html = marked(raw);

	// Add IDs to headings for anchor linking
	headings.forEach((heading) => {
		html = html.replace(`<h${heading.level}>`, `<h${heading.level} id="${heading.id}">`);
	});

	html = html.replace(/<!--PRESERVED_(\d+)-->/g, (match, index) => {
		return preservedBlocks[parseInt(index, 10)] ?? match;
	});

	return { html, headings };
}

/**
 * Renders a markdown document into the webview
 *
 * Runs renderMarkdown, rewrites image paths to webview URIs, then injects the
 * result into the HTML template with a fresh CSP nonce. Errors surface as a
 * VS Code notification, so a failed render is visible.
 *
 * @param {vscode.WebviewPanel} panel - The webview to update
 * @param {vscode.TextDocument} document - The markdown document to render
 */
function updateWebviewContent(panel, document) {
	try {
		const { html: renderedHtml, headings } = renderMarkdown(document.getText());

		const html = renderedHtml.replace(/<img\s+src="([^"]+)"/g, (match, imagePath) => {
			const resolvedPath = resolveImagePath(imagePath, document, panel);
			return `<img src="${resolvedPath}"`;
		});

		panel.webview.html = getWebviewContent(html, getNonce(), headings, resolveTheme(), document.uri.toString());
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to render markdown: ${error.message}`);
	}
}

/**
 * Builds a parent-child tree from a flat array of headings
 *
 * Uses a stack to track nesting: each heading becomes a child of the most
 * recent heading with a lower level. Handles irregular hierarchies gracefully
 * (e.g., h1 followed by h3 with no h2 makes h3 a child of h1).
 *
 * @param {Array} headings - Array of heading objects with level, text, id
 * @returns {Array} Array of root tree nodes, each with { heading, children }
 */
function buildTOCTree(headings) {
	const root = { children: [] };
	const stack = [{ node: root, level: 0 }];

	headings.forEach((heading) => {
		const newNode = { heading, children: [] };

		// Pop stack until we find a parent with a lower level
		while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
			stack.pop();
		}

		stack[stack.length - 1].node.children.push(newNode);
		stack.push({ node: newNode, level: heading.level });
	});

	return root.children;
}

/**
 * Recursively renders a TOC tree node to HTML
 *
 * Parent nodes (those with children) are wrapped in <details>/<summary> for
 * native collapsibility. Leaf nodes render as plain list items. All nodes
 * include a pound-sign prefix indicating heading depth.
 *
 * @param {Object} node - Tree node with { heading, children }
 * @returns {string} HTML string for this node and its descendants
 */
function renderTOCNode(node) {
	const h = node.heading;
	const prefix = "#".repeat(h.level);
	const hasChildren = node.children.length > 0;

	let html = `<li class="toc-item toc-level-${h.level}${hasChildren ? "" : " toc-leaf"}">`;

	if (hasChildren) {
		const openAttr = h.level <= 1 ? " open" : "";
		html += `<details class="toc-details"${openAttr}>`;
		html += `<summary class="toc-summary"><a href="#${h.id}" class="toc-link"><span class="toc-prefix">${prefix}</span>${escapeHtml(h.text)}</a></summary>`;
		html += "<ul class=\"toc-list\">";
		node.children.forEach((child) => {
			html += renderTOCNode(child);
		});
		html += "</ul>";
		html += "</details>";
	} else {
		html += `<a href="#${h.id}" class="toc-link"><span class="toc-prefix">${prefix}</span>${escapeHtml(h.text)}</a>`;
	}

	html += "</li>";
	return html;
}

/**
 * Generates collapsible TOC HTML from headings array
 *
 * Builds a tree structure from flat headings, then renders recursively.
 * Parent headings with children are collapsible (H1 nodes expanded by default).
 * Each entry shows pound-sign prefixes indicating heading depth.
 *
 * @param {Array} headings - Array of heading objects with level, text, id
 * @returns {string} HTML for the nested, collapsible TOC list
 */
function generateTOC(headings) {
	if (headings.length === 0)
		return "<p style=\"font-size: 0.9em; color: var(--vscode-descriptionForeground);\">No headings found</p>";

	const tree = buildTOCTree(headings);
	let tocHtml = "<ul class=\"toc-list\">";
	tree.forEach((node) => {
		tocHtml += renderTOCNode(node);
	});
	tocHtml += "</ul>";
	return tocHtml;
}

/**
 * Detects VS Code color theme kind and returns appropriate sub-theme names
 *
 * Maps VS Code's active color theme to Mermaid diagram theme and
 * highlight.js stylesheet URL for consistent appearance.
 *
 * @returns {{ mermaidTheme: string, hljsTheme: string }} Theme configuration
 */
function resolveTheme() {
	const kind = vscode.window.activeColorTheme.kind;
	const isDark = kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast;
	return {
		mermaidTheme: isDark ? "dark" : "default",
		hljsTheme: `https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@${CDN_VERSIONS.highlightjs}/styles/atom-one-${isDark ? "dark" : "light"}.min.css`,
	};
}

/**
 * Generates the complete HTML content for the webview
 *
 * Loads the HTML template (inlined at build time by webpack) and replaces
 * placeholder tokens with dynamic values in a single pass. A value is never
 * rescanned, so "{{...}}" text in a document or heading cannot trigger a
 * substitution, and "$" sequences in content stay literal.
 *
 * Template placeholders:
 * - {{NONCE}}: CSP nonce token (appears on every inline and CDN script tag)
 * - {{MERMAID_VERSION}}, {{MATHJAX_VERSION}}, {{HLJS_VERSION}}: pinned CDN versions from CDN_VERSIONS
 * - {{HLJS_THEME}}: highlight.js stylesheet URL
 * - {{MERMAID_THEME}}: Mermaid diagram theme name
 * - {{TOC}}: Generated table of contents HTML
 * - {{CONTENT}}: Rendered markdown HTML
 * - {{DOC_KEY}}: Escaped URI of the previewed document, read by the page to scope its saved scroll position
 *
 * @param {string} markdownHtml - Already-rendered HTML from marked
 * @param {string} nonce - Security token for CSP (random string)
 * @param {Array} headings - Array of heading objects for TOC generation
 * @param {{ mermaidTheme: string, hljsTheme: string }} theme - Theme config from resolveTheme()
 * @param {string} documentKey - URI of the previewed document; the page keys its saved scroll position to it
 * @returns {string} Complete HTML page
 */
function getWebviewContent(markdownHtml, nonce, headings = [], theme = {}, documentKey = "") {
	const values = {
		NONCE: nonce,
		MERMAID_VERSION: CDN_VERSIONS.mermaid,
		MATHJAX_VERSION: CDN_VERSIONS.mathjax,
		HLJS_VERSION: CDN_VERSIONS.highlightjs,
		HLJS_THEME: theme.hljsTheme,
		MERMAID_THEME: theme.mermaidTheme,
		DOC_KEY: escapeHtml(documentKey),
		TOC: generateTOC(headings),
		CONTENT: markdownHtml,
	};

	// One pass over the template, so placeholder-like text inside the document or a heading is never substituted
	return webviewTemplate.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => values[key] ?? match);
}

/**
 * Generates a random nonce for Content Security Policy
 *
 * The CSP only runs scripts carrying the nonce of the current render, so the
 * value must be unguessable by markdown content. It comes from the operating
 * system's CSPRNG (`crypto.randomBytes`) because `Math.random` output can be
 * predicted from earlier values.
 *
 * @returns {string} Random 32-character hexadecimal string
 */
function getNonce() {
	return crypto.randomBytes(16).toString("hex");
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
	extractHeadings,
	buildTOCTree,
	generateTOC,
	getNonce,
	escapeHtml,
	renderMarkdown,
	getWebviewContent,
	CDN_VERSIONS,
};
