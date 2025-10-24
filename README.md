# VSCode Markdown Preview Extension

This is a simple Visual Studio Code extension for previewing Markdown files. It provides a live preview of Markdown content in a side panel using a custom webview.

## Features

- **Preview Markdown:** Shows a rendered preview of the currently open Markdown file in a side panel.
- **Mermaid Block Detection:** Mermaid code blocks are detected and wrapped in `<div class="mermaid">...</div>` for future compatibility.
- **Error Handling:** Displays error messages if no editor is open or if the file is not Markdown.

## Limitations

- **Mermaid Diagrams:** Mermaid preview is currently **not working**. The extension wraps mermaid code blocks, but the diagrams do not render in the preview panel. This is due to compatibility issues with the latest Mermaid library and VS Code webview restrictions. Future updates may restore this functionality.
- **Normal Markdown:** All standard Markdown elements (headings, lists, code, tables, etc.) are previewed as expected.

## Usage

1. Open any Markdown (`.md`) file in VS Code.
2. Run the command `Markdown Preview Basic: Show Preview` from the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`).
3. A side panel will open with the rendered Markdown preview.

## Development

- The extension uses the [`marked`](https://www.npmjs.com/package/marked) library for Markdown rendering.
- Mermaid support is planned for future releases. Currently, the code prepares for Mermaid rendering but does not display diagrams.

## Security & Best Practices

- Only the official `marked` package is used (not the malicious `marked-as`).
- No MathJax or other external script is loaded.
- Mermaid is loaded via CDN, but rendering is disabled until compatibility is restored.

## Contributing

Pull requests are welcome! If you have ideas for improving Mermaid support or other features, feel free to open an issue or PR.

## License

MIT
