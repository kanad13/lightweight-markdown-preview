const vscode = require("vscode");
const { marked } = require("marked");

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
				currentPanel = vscode.window.createWebviewPanel(
					"markdownPreviewBasic",
					"Markdown Preview",
					vscode.ViewColumn.Beside,
					{
						enableScripts: true, // Required for Mermaid to work
						localResourceRoots: [context.extensionUri],
						retainContextWhenHidden: true,
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

	// Listen for document changes to update preview in real-time
	const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
		(e) => {
			if (
				currentPanel &&
				currentDocument &&
				e.document.uri.toString() === currentDocument.uri.toString()
			) {
				updateWebviewContent(currentPanel, e.document);
			}
		}
	);

	context.subscriptions.push(disposable);
	context.subscriptions.push(changeDocumentSubscription);
}

/**
 * Updates the webview content with rendered markdown
 *
 * This is the core rendering pipeline:
 * 1. Extract mermaid diagram blocks (before markdown parsing)
 * 2. Extract math expressions - both inline ($...$) and block ($$...$$)
 * 3. Convert markdown to HTML using marked library
 * 4. Restore mermaid and math blocks with preservation markers
 * 5. Inject HTML into webview with proper CSP and styling
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
		raw = raw.replace(
			/```mermaid\s*\n([\s\S]*?)```/g,
			(match, code) => {
				preservedBlocks.push({ type: "mermaid", content: `<pre class="mermaid">${code.trim()}</pre>` });
				return `<!--PRESERVED_${preservedBlocks.length - 1}-->`;
			}
		);

		// Render markdown to HTML
		let html = marked(raw);

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

		// Generate nonce for CSP
		const nonce = getNonce();

		panel.webview.html = getWebviewContent(html, nonce);
	} catch (error) {
		vscode.window.showErrorMessage(
			`Failed to render markdown: ${error.message}`
		);
	}
}

/**
 * Generates the complete HTML content for the webview
 *
 * This function creates a sandboxed HTML environment with:
 * - Security: Content Security Policy with nonce-based scripts
 * - Styling: Clean, minimal design that works in light and dark themes
 * - Interactivity: Mermaid diagrams and MathJax equations rendered via CDN
 *
 * CSP (Content Security Policy) breakdown:
 * - default-src 'none': Block everything by default (secure)
 * - img-src https: data: Allow images from HTTPS and data URIs
 * - script-src 'nonce-*': Only allow scripts with matching nonce
 * - style-src 'unsafe-inline': Allow inline styles (needed for rendering)
 * - font-src https: data: Allow fonts from HTTPS and data URIs (for MathJax)
 *
 * Mermaid Configuration:
 * - startOnLoad: false - We call mermaid.run() explicitly
 * - securityLevel: loose - Allows all diagram types
 * - CDN: jsDelivr for reliability and caching
 *
 * MathJax Configuration:
 * - Loads tex-mml-chtml renderer from CDN
 * - Supports inline ($...$) and display ($$...$$) math notation
 *
 * @param {string} markdownHtml - Already-rendered HTML from marked
 * @param {string} nonce - Security token for CSP (random string)
 * @returns {string} Complete HTML page
 */
function getWebviewContent(markdownHtml, nonce) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https: data:;">
	<title>Markdown Preview</title>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/atom-one-light.min.css">
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
			line-height: 1.6;
			padding: 20px;
			max-width: 900px;
			margin: 0 auto;
		}
		pre {
			background-color: #f5f5f5;
			border: 1px solid #e0e0e0;
			border-radius: 4px;
			padding: 12px;
			overflow-x: auto;
		}
		code {
			background-color: #f5f5f5;
			padding: 2px 4px;
			border-radius: 3px;
			font-family: 'Courier New', Courier, monospace;
			font-size: 0.9em;
		}
		pre code {
			background-color: transparent;
			padding: 0;
			font-family: 'Courier New', Courier, monospace;
		}
		blockquote {
			border-left: 4px solid #ddd;
			margin: 0;
			padding-left: 16px;
			color: #666;
		}
		table {
			border-collapse: collapse;
			width: 100%;
			margin: 16px 0;
		}
		th, td {
			border: 1px solid #ddd;
			padding: 8px;
			text-align: left;
		}
		th {
			background-color: #f4f4f4;
		}
		img {
			max-width: 100%;
			height: auto;
		}
		.mermaid {
			background-color: transparent;
			border: none;
			text-align: center;
		}
	</style>
</head>
<body>
	${markdownHtml}
	<script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" nonce="${nonce}"></script>
	<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/highlight.min.js" nonce="${nonce}"></script>
	<script type="module" nonce="${nonce}">
		import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

		// Initialize highlight.js for syntax highlighting
		try {
			// Apply syntax highlighting to all code blocks
			document.querySelectorAll('pre code').forEach((block) => {
				hljs.highlightElement(block);
			});
		} catch (error) {
			console.error('Syntax highlighting failed:', error);
		}

		// Initialize Mermaid with modern API
		mermaid.initialize({
			startOnLoad: false,
			theme: 'default',
			securityLevel: 'loose'
		});

		// Run Mermaid on all diagram elements
		try {
			await mermaid.run({
				querySelector: '.mermaid'
			});
		} catch (error) {
			console.error('Mermaid rendering failed:', error);
		}

		// Trigger MathJax processing if loaded
		if (window.MathJax) {
			try {
				window.MathJax.typesetPromise().catch(err => console.error('MathJax rendering failed:', err));
			} catch (error) {
				console.error('MathJax initialization failed:', error);
			}
		}
	</script>
</body>
</html>`;
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
};
