const vscode = require("vscode");
const { marked } = require("marked");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
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
 * @param {vscode.WebviewPanel} panel
 * @param {vscode.TextDocument} document
 */
function updateWebviewContent(panel, document) {
	try {
		let raw = document.getText();

		// Replace mermaid code blocks with <pre class="mermaid">...</pre>
		// Process this BEFORE marked to avoid markdown escaping issues
		raw = raw.replace(
			/```mermaid\s*\n([\s\S]*?)```/g,
			(match, code) => `<pre class="mermaid">${code.trim()}</pre>`
		);

		// Render markdown to HTML
		const html = marked(raw);

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
 * @param {string} markdownHtml
 * @param {string} nonce
 * @returns {string}
 */
function getWebviewContent(markdownHtml, nonce) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://cdn.jsdelivr.net;">
	<title>Markdown Preview</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
			line-height: 1.6;
			padding: 20px;
			max-width: 900px;
			margin: 0 auto;
		}
		pre {
			background-color: #f4f4f4;
			border: 1px solid #ddd;
			border-radius: 4px;
			padding: 10px;
			overflow-x: auto;
		}
		code {
			background-color: #f4f4f4;
			padding: 2px 4px;
			border-radius: 3px;
			font-family: 'Courier New', Courier, monospace;
		}
		pre code {
			background-color: transparent;
			padding: 0;
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
	<script type="module" nonce="${nonce}">
		import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

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
	</script>
</body>
</html>`;
}

/**
 * Generates a nonce for Content Security Policy
 * @returns {string}
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
