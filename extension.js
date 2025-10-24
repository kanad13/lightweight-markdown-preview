const vscode = require("vscode");
const { marked } = require("marked");

// No MathJax code present. If you want to add MathJax support, you would include its CDN and rendering logic here. This extension currently only supports Mermaid diagrams and Markdown rendering.
function activate(context) {
	let disposable = vscode.commands.registerCommand(
		"markdownPreviewBasic.showPreview",
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
			const panel = vscode.window.createWebviewPanel(
				"markdownPreviewBasic",
				"Markdown Preview",
				vscode.ViewColumn.Beside,
				{}
			);
			let raw = doc.getText();
			// Replace mermaid code blocks with <div class="mermaid">...</div>
			raw = raw.replace(
				/```mermaid\n([\s\S]*?)```/g,
				(match, code) => `<div class="mermaid">${code}</div>`
			);
			const html = marked(raw);
			panel.webview.html = `
						<!DOCTYPE html>
						<html lang="en">
						<head>
								<meta charset="UTF-8">
								<meta name="viewport" content="width=device-width, initial-scale=1.0">
								<title>Markdown Preview</title>
								<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
								<script>
									mermaid.initialize({ startOnLoad: true });
									// For future compatibility, consider switching to ESM module loading:
									// <script type="module"> import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs'; mermaid.initialize({ startOnLoad: true }); </script>
								</script>
						</head>
						<body>
								${html}
				<script>
					// Wait for DOM to load, then run Mermaid diagrams (mermaid.init is deprecated)
					document.addEventListener('DOMContentLoaded', function() {
						if (window.mermaid && typeof mermaid.run === 'function') {
							mermaid.run({ nodes: document.querySelectorAll('.mermaid') });
						}
					});
				</script>
						</body>
						</html>
						`;
		}
	);
	context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
};
