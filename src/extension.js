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

	lines.forEach((line, index) => {
		// Track if we're entering or exiting a code block
		if (line.match(/^```/)) {
			insideCodeBlock = !insideCodeBlock;
			return; // Don't process code fence lines
		}

		// Only extract headings if we're NOT inside a code block
		if (!insideCodeBlock) {
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
		raw = raw.replace(
			/```mermaid\s*\n([\s\S]*?)```/g,
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

		panel.webview.html = getWebviewContent(html, nonce, headings);
	} catch (error) {
		vscode.window.showErrorMessage(
			`Failed to render markdown: ${error.message}`
		);
	}
}

/**
 * Generates nested TOC HTML from headings array
 *
 * @param {Array} headings - Array of heading objects with level, text, id
 * @returns {string} HTML for the nested TOC list
 */
function generateTOC(headings) {
	if (headings.length === 0) return "<p style=\"font-size: 0.9em; color: #888;\">No headings found</p>";

	let tocHtml = "<ul class=\"toc-list\">";
	let currentLevel = 0;

	headings.forEach((heading) => {
		// Close deeper levels
		while (currentLevel >= heading.level) {
			tocHtml += "</ul>";
			currentLevel--;
		}

		// Open new levels
		while (currentLevel < heading.level - 1) {
			tocHtml += "<ul class=\"toc-list\">";
			currentLevel++;
		}

		if (currentLevel < heading.level) {
			tocHtml += "<ul class=\"toc-list\">";
			currentLevel++;
		}

		tocHtml += `<li class="toc-item toc-level-${heading.level}"><a href="#${heading.id}" class="toc-link">${heading.text}</a></li>`;
	});

	// Close all open levels
	while (currentLevel > 0) {
		tocHtml += "</ul>";
		currentLevel--;
	}

	return tocHtml;
}

/**
 * Generates the complete HTML content for the webview
 *
 * This function creates a sandboxed HTML environment with:
 * - Security: Content Security Policy with nonce-based scripts
 * - Styling: Clean, minimal design that works in light and dark themes
 * - Interactivity: Mermaid diagrams and MathJax equations rendered via CDN
 * - Navigation: Collapsible overlay TOC sidebar for document outline (Option 3 pattern)
 *
 * CSP (Content Security Policy) breakdown:
 * - default-src 'none': Block everything by default (secure)
 * - img-src https: data: vscode-resource: Allow images from HTTPS, data URIs, and local files
 * - script-src 'nonce-*': Only allow scripts with matching nonce
 * - style-src 'unsafe-inline': Allow inline styles (needed for rendering)
 * - font-src https: data: Allow fonts from HTTPS and data URIs (for MathJax)
 *
 * Sidebar Pattern (Overlay - Option 3):
 * - Sidebar is hidden by default, slides in from left when opened
 * - Clicking overlay or close button closes the sidebar
 * - Escape key also closes the sidebar
 * - Content width remains consistent (no reflow)
 * - Uses transform: translateX() for smooth, GPU-accelerated animation
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
 * @param {Array} headings - Array of heading objects for TOC generation
 * @returns {string} Complete HTML page
 */
function getWebviewContent(markdownHtml, nonce, headings = []) {
	const tocHtml = generateTOC(headings);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: vscode-resource:; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https: data:;">
	<title>Markdown Preview</title>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/atom-one-light.min.css">
	<style>
		* {
			box-sizing: border-box;
		}

		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
			line-height: 1.6;
			margin: 0;
			padding: 0;
			background: #fff;
		}

		/* Hamburger toggle button */
		.sidebar-toggle {
			position: fixed;
			top: 10px;
			right: 10px;
			z-index: 1001;
			background: #f5f5f5;
			border: 1px solid #e0e0e0;
			padding: 8px 12px;
			cursor: pointer;
			border-radius: 4px;
			font-size: 1.2em;
			transition: background 0.2s ease;
		}

		.sidebar-toggle:hover {
			background: #e8f0ff;
		}

		/* Overlay backdrop */
		.sidebar-overlay {
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.5);
			opacity: 0;
			pointer-events: none;
			transition: opacity 0.3s ease;
			z-index: 1000;
		}

		body.sidebar-open .sidebar-overlay {
			opacity: 1;
			pointer-events: auto;
		}

		/* TOC Sidebar - Overlay pattern */
		.toc-sidebar {
			position: fixed;
			left: 0;
			top: 0;
			height: 100vh;
			width: 280px;
			background: #f9f9f9;
			border-right: 1px solid #e0e0e0;
			overflow-y: auto;
			padding: 20px;
			font-size: 0.9em;
			z-index: 1001;
			transform: translateX(-100%);
			transition: transform 0.3s ease;
		}

		body.sidebar-open .toc-sidebar {
			transform: translateX(0);
		}

		/* Close button in sidebar header */
		.toc-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			font-size: 0.85em;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: #666;
			margin-bottom: 12px;
			padding-bottom: 8px;
			border-bottom: 1px solid #e0e0e0;
		}

		.toc-close {
			background: none;
			border: none;
			font-size: 1.5em;
			color: #666;
			cursor: pointer;
			padding: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			width: 28px;
			height: 28px;
			border-radius: 3px;
			transition: background 0.2s ease;
		}

		.toc-close:hover {
			background: #e8f0ff;
			color: #0066cc;
		}

		.toc-list {
			list-style: none;
			margin: 0;
			padding: 0;
		}

		.toc-list ul {
			list-style: none;
			margin: 0;
			padding-left: 12px;
			margin-top: 2px;
		}

		.toc-item {
			margin: 2px 0;
		}

		/* Simplified toc-link styling - uniform font/color */
		.toc-link {
			display: block;
			padding: 8px 12px;
			text-decoration: none;
			color: #0066cc;
			border-radius: 3px;
			border-left: 3px solid transparent;
			transition: all 0.15s ease;
		}

		.toc-link:hover {
			background: rgba(0, 102, 204, 0.08);
			color: #0052a3;
		}

		.toc-link.active {
			border-left-color: #0066cc;
			background: rgba(0, 102, 204, 0.1);
			color: #0052a3;
			font-weight: 500;
		}

		/* Indentation shows hierarchy, no font-size variations */
		.toc-level-2 .toc-link,
		.toc-level-3 .toc-link,
		.toc-level-4 .toc-link,
		.toc-level-5 .toc-link,
		.toc-level-6 .toc-link {
			font-size: 0.9em;
			color: #0066cc;
		}

		.toc-level-2 .toc-link:hover,
		.toc-level-3 .toc-link:hover,
		.toc-level-4 .toc-link:hover,
		.toc-level-5 .toc-link:hover,
		.toc-level-6 .toc-link:hover {
			background: rgba(0, 102, 204, 0.08);
			color: #0052a3;
		}

		.toc-level-2 .toc-link.active,
		.toc-level-3 .toc-link.active,
		.toc-level-4 .toc-link.active,
		.toc-level-5 .toc-link.active,
		.toc-level-6 .toc-link.active {
			border-left-color: #0066cc;
			background: rgba(0, 102, 204, 0.1);
		}

		/* Content area - no margin offset needed (sidebar is overlay) */
		.content {
			flex: 1;
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

		h1, h2, h3, h4, h5, h6 {
			scroll-margin-top: 20px;
		}

		/* Mobile responsiveness */
		@media (max-width: 768px) {
			.content {
				padding: 15px;
			}

			.sidebar-toggle {
				top: 8px;
				right: 8px;
				padding: 6px 10px;
				font-size: 1em;
			}
		}
	</style>
</head>
<body>
	<button class="sidebar-toggle" aria-label="Toggle outline sidebar" title="Show outline (ESC to close)">☰</button>
	<div class="sidebar-overlay" aria-hidden="true"></div>
	<aside class="toc-sidebar" role="navigation" aria-label="Document outline">
		<div class="toc-header">
			<span>Contents</span>
			<button class="toc-close" aria-label="Close sidebar">✕</button>
		</div>
		${tocHtml}
	</aside>
	<main class="content">
		${markdownHtml}
	</main>
	<script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" nonce="${nonce}"></script>
	<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/highlight.min.js" nonce="${nonce}"></script>
	<script type="module" nonce="${nonce}">
		import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

		// Initialize highlight.js for syntax highlighting
		try {
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

		// Sidebar toggle functionality
		const toggleBtn = document.querySelector('.sidebar-toggle');
		const closeBtn = document.querySelector('.toc-close');
		const overlay = document.querySelector('.sidebar-overlay');
		const tocLinks = document.querySelectorAll('.toc-link');
		const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

		// Open sidebar when toggle button clicked
		toggleBtn.addEventListener('click', () => {
			document.body.classList.add('sidebar-open');
		});

		// Close sidebar when close button clicked
		closeBtn.addEventListener('click', () => {
			document.body.classList.remove('sidebar-open');
		});

		// Close sidebar when overlay clicked
		overlay.addEventListener('click', () => {
			document.body.classList.remove('sidebar-open');
		});

		// Close sidebar on Escape key
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				document.body.classList.remove('sidebar-open');
			}
		});

		// Handle TOC link clicks for smooth scrolling
		tocLinks.forEach(link => {
			link.addEventListener('click', (e) => {
				e.preventDefault();
				const id = link.getAttribute('href').substring(1);
				const target = document.getElementById(id);
				if (target) {
					target.scrollIntoView({ behavior: 'smooth' });
					updateActiveTOC(id);
				}
			});
		});

		// Update active TOC link based on scroll position and scroll TOC to show it
		function updateActiveTOC(activeId) {
			const sidebar = document.querySelector('.toc-sidebar');
			tocLinks.forEach(link => {
				link.classList.remove('active');
				if (link.getAttribute('href') === '#' + activeId) {
					link.classList.add('active');
					// Only auto-scroll sidebar if it's open
					if (document.body.classList.contains('sidebar-open')) {
						// Scroll the TOC sidebar to make the active link visible
						const activeLink = link;
						const linkTop = activeLink.offsetTop;
						const linkBottom = linkTop + activeLink.offsetHeight;
						const sidebarScrollTop = sidebar.scrollTop;
						const sidebarHeight = sidebar.clientHeight;
						const sidebarBottom = sidebarScrollTop + sidebarHeight;

						// If link is above visible area, scroll up
						if (linkTop < sidebarScrollTop) {
							sidebar.scrollTop = linkTop - 50;
						}
						// If link is below visible area, scroll down
						else if (linkBottom > sidebarBottom) {
							sidebar.scrollTop = linkBottom - sidebarHeight + 50;
						}
					}
				}
			});
		}

		// Track which heading is in view as user scrolls
		const observerOptions = {
			root: null,
			rootMargin: '-50% 0px -50% 0px',
			threshold: 0
		};

		const observer = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting && entry.target.id) {
					updateActiveTOC(entry.target.id);
				}
			});
		}, observerOptions);

		headings.forEach(heading => {
			if (heading.id) {
				observer.observe(heading);
			}
		});
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
