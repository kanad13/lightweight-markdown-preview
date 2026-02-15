const vscode = require("vscode");
const { marked } = require("marked");
const webviewTemplate = require("./webview.html");

/**
 * Activation function - called when the extension loads
 *
 * This extension provides a lightweight Markdown preview with Mermaid diagram and MathJax support.
 * It maintains a single webview panel that reuses across different markdown files.
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
	console.log("lightweightMarkdownViewer extension activated");
	// Keep track of current panel to avoid duplicates and enable updates
	let currentPanel = undefined;
	let currentDocument = undefined;
	let updateTimer = undefined;

	const disposable = vscode.commands.registerCommand(
		"lightweightMarkdownViewer.showPreview",
		function () {
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
					localResourceRoots.push(...workspaceFolders.map(folder => folder.uri));
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
						currentPanel = undefined;
						currentDocument = undefined;
					},
					null,
					context.subscriptions
				);
			}
		}
	);

	// Listen for document changes to update preview with debounce
	const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
		(e) => {
			if (
				currentPanel &&
				currentDocument &&
				e.document.uri.toString() === currentDocument.uri.toString()
			) {
				clearTimeout(updateTimer);
				updateTimer = setTimeout(() => {
					updateWebviewContent(currentPanel, e.document);
				}, 300);
			}
		}
	);

	// Re-render when VS Code color theme changes (light ↔ dark)
	const themeChangeSubscription = vscode.window.onDidChangeActiveColorTheme(() => {
		if (currentPanel && currentDocument) {
			updateWebviewContent(currentPanel, currentDocument);
		}
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(changeDocumentSubscription);
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
				const id = `heading-${text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")}-${index}`;

				headings.push({ level, text, id, lineIndex: index });
			}
		}
	});

	return headings;
}

/**
 * Updates the webview content with rendered markdown
 *
 * This is the core rendering pipeline:
 * 1. Extract mermaid diagram blocks (before markdown parsing)
 * 2. Extract math expressions - both inline ($...$) and block ($$...$$)
 * 3. Convert markdown to HTML using marked library
 * 4. Restore mermaid and math blocks with preservation markers
 * 5. Process image paths to resolve relative paths to webview URIs
 * 6. Inject HTML into webview with proper CSP and styling
 *
 * Why extraction happens first:
 * - marked parser would escape backticks/delimiters in mermaid & math syntax
 * - Pre-processing preserves code and math integrity
 * - Mermaid v11 renders elements with class="mermaid"
 * - MathJax processes restored math delimiters correctly
 *
 * @param {vscode.WebviewPanel} panel - The webview to update
 * @param {vscode.TextDocument} document - The markdown document to render
 */
function updateWebviewContent(panel, document) {
	try {
		let raw = document.getText();
		const preservedBlocks = [];

		// Extract headings for TOC
		const headings = extractHeadings(raw);

		// Extract block math ($$...$$) - must come before inline math
		raw = raw.replace(/\$\$\s*\n([\s\S]*?)\$\$/g, (_, code) => {
			preservedBlocks.push({ type: "math-block", content: `$$\n${code}$$` });
			return `<!--PRESERVED_${preservedBlocks.length - 1}-->`;
		});

		// Extract inline math ($...$) - protect from marked escaping
		raw = raw.replace(/\$([^$\n]+)\$/g, (_, code) => {
			preservedBlocks.push({ type: "math-inline", content: `$${code}$` });
			return `<!--PRESERVED_${preservedBlocks.length - 1}-->`;
		});

		// Replace mermaid code blocks with <pre class="mermaid">...</pre>
		// Process this BEFORE marked to avoid markdown escaping issues
		// Supports both backtick (```) and triple-colon (:::) syntax for GitHub and Azure DevOps compatibility
		raw = raw.replace(
			/```mermaid\s*\n([\s\S]*?)```/g,
			(match, code) => {
				preservedBlocks.push({ type: "mermaid", content: `<pre class="mermaid">${code.trim()}</pre>` });
				return `<!--PRESERVED_${preservedBlocks.length - 1}-->`;
			}
		);

		// Triple-colon syntax (Azure DevOps / Fenced Div style)
		raw = raw.replace(
			/:::\s*mermaid\s*\n([\s\S]*?):::/g,
			(match, code) => {
				preservedBlocks.push({ type: "mermaid", content: `<pre class="mermaid">${code.trim()}</pre>` });
				return `<!--PRESERVED_${preservedBlocks.length - 1}-->`;
			}
		);

		// Render markdown to HTML
		let html = marked(raw);

		// Add IDs to headings for anchor linking
		headings.forEach(heading => {
			const headingTag = `<h${heading.level}>`;
			const headingTagWithId = `<h${heading.level} id="${heading.id}">`;
			html = html.replace(headingTag, headingTagWithId);
		});

		// Restore preserved blocks
		html = html.replace(/<!--PRESERVED_(\d+)-->/g, (match, index) => {
			const block = preservedBlocks[parseInt(index)];
			if (block.type === "mermaid") {
				return block.content;
			} else if (block.type === "math-block") {
				return block.content;
			} else if (block.type === "math-inline") {
				return block.content;
			}
			return match;
		});

		// Process image paths to resolve relative paths
		html = html.replace(/<img\s+src="([^"]+)"/g, (match, imagePath) => {
			const resolvedPath = resolveImagePath(imagePath, document, panel);
			return `<img src="${resolvedPath}"`;
		});

		// Generate nonce for CSP
		const nonce = getNonce();
		const theme = resolveTheme();

		panel.webview.html = getWebviewContent(html, nonce, headings, theme);
	} catch (error) {
		vscode.window.showErrorMessage(
			`Failed to render markdown: ${error.message}`
		);
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

	headings.forEach(heading => {
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
		html += `<summary class="toc-summary"><a href="#${h.id}" class="toc-link"><span class="toc-prefix">${prefix}</span>${h.text}</a></summary>`;
		html += "<ul class=\"toc-list\">";
		node.children.forEach(child => {
			html += renderTOCNode(child);
		});
		html += "</ul>";
		html += "</details>";
	} else {
		html += `<a href="#${h.id}" class="toc-link"><span class="toc-prefix">${prefix}</span>${h.text}</a>`;
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
	if (headings.length === 0) return "<p style=\"font-size: 0.9em; color: var(--vscode-descriptionForeground);\">No headings found</p>";

	const tree = buildTOCTree(headings);
	let tocHtml = "<ul class=\"toc-list\">";
	tree.forEach(node => {
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
		hljsTheme: isDark
			? "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/atom-one-dark.min.css"
			: "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/atom-one-light.min.css",
	};
}

/**
 * Generates the complete HTML content for the webview
 *
 * Loads the HTML template (inlined at build time by webpack) and replaces
 * placeholder tokens with dynamic values. Uses function-form replacements
 * to avoid issues with special $ patterns in user-generated content.
 *
 * Template placeholders:
 * - {{NONCE}}: CSP nonce token (appears 4 times)
 * - {{HLJS_THEME}}: highlight.js stylesheet URL
 * - {{MERMAID_THEME}}: Mermaid diagram theme name
 * - {{TOC}}: Generated table of contents HTML
 * - {{CONTENT}}: Rendered markdown HTML
 *
 * @param {string} markdownHtml - Already-rendered HTML from marked
 * @param {string} nonce - Security token for CSP (random string)
 * @param {Array} headings - Array of heading objects for TOC generation
 * @param {{ mermaidTheme: string, hljsTheme: string }} theme - Theme config from resolveTheme()
 * @returns {string} Complete HTML page
 */
function getWebviewContent(markdownHtml, nonce, headings = [], theme = {}) {
	const tocHtml = generateTOC(headings);

	return webviewTemplate
		.replace(/\{\{NONCE\}\}/g, () => nonce)
		.replace("{{HLJS_THEME}}", () => theme.hljsTheme)
		.replace("{{MERMAID_THEME}}", () => theme.mermaidTheme)
		.replace("{{TOC}}", () => tocHtml)
		.replace("{{CONTENT}}", () => markdownHtml);
}

/**
 * Generates a random nonce for Content Security Policy
 *
 * A nonce (number used once) is a random token that:
 * - Makes each rendered page unique
 * - Prevents inline script injection attacks
 * - Is required by VS Code's webview security model
 *
 * The nonce is included in the CSP header and must match
 * all inline scripts for them to execute. This prevents
 * malicious scripts from running even if CSP is bypassed.
 *
 * Length: 32 characters of alphanumeric (sufficient for security)
 *
 * @returns {string} Random 32-character alphanumeric string
 */
function getNonce() {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
	extractHeadings,
	buildTOCTree,
	generateTOC,
	getNonce,
};
