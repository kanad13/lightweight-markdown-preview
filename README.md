# VSCode Markdown Preview Extension

A modern Visual Studio Code extension for previewing Markdown files with full support for Mermaid diagrams. It provides a live preview of Markdown content in a side panel using a secure webview.

## Features

- **Live Preview:** Real-time rendered preview of Markdown files that updates as you type
- **Mermaid Diagrams:** Full support for Mermaid diagrams with modern Mermaid v11
- **Standard Markdown:** Complete support for all standard Markdown elements:
  - Headings, lists, links, images
  - Code blocks with syntax highlighting
  - Tables, blockquotes
  - Bold, italic, strikethrough text
- **Security:** Implements Content Security Policy (CSP) for safe rendering
- **Error Handling:** Displays clear error messages for invalid content

## Installation

### Option 1: Install from Release (Recommended)

1. Go to [Releases](https://github.com/kanad13/lightweight-markdown-preview/releases) on GitHub
2. Download the latest `.vsix` file
3. In VS Code, open the Extensions view (`Cmd+Shift+X`)
4. Click the "..." menu in the top-right and select **"Install from VSIX..."**
5. Select the downloaded `.vsix` file

### Option 2: Install from Source

```bash
# Clone the repository
git clone https://github.com/kanad13/lightweight-markdown-preview.git
cd lightweight-markdown-preview

# Install dependencies
npm install

# Package the extension
npm run package
```

This creates a `.vsix` file that you can install as described above.

### Option 3: Development Mode

```bash
# Clone and install
git clone https://github.com/kanad13/lightweight-markdown-preview.git
cd lightweight-markdown-preview
npm install

# Open in VS Code and press F5 to launch Extension Development Host
```

1. Open any Markdown (`.md`) file in VS Code
2. Run the command **"Markdown: Show Lightweight Markdown Preview"** from the Command Palette (`Cmd+Shift+P` on macOS or `Ctrl+Shift+P` on Windows/Linux)
3. A side panel will open with the rendered preview
4. The preview updates automatically as you edit the file

### Testing the Extension

To test all features including Mermaid diagrams:

1. Open the included `examples/test.md` file in VS Code (or any Markdown file)
2. Run the command **"Markdown: Show Lightweight Markdown Preview"** from the Command Palette
3. Verify that:
   - All text formatting appears correctly (headings, bold, italic, lists)
   - Tables render properly
   - Code blocks are formatted with syntax highlighting
   - Images display correctly
   - **Mermaid diagram** renders as a flowchart (graph TD with A→B, A→C, B→D, C→D)
   - Math expressions display as plain text (MathJax not currently supported)

## Development

- Built with the [`marked`](https://www.npmjs.com/package/marked) library for fast Markdown rendering
- Uses Mermaid v11 with modern ESM module loading
- Implements VS Code webview best practices:
  - Content Security Policy with nonces
  - Proper script enablement
  - Document change listeners for live updates
  - Panel disposal handling

### Development Documentation

For detailed development information, see:
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Design decisions and security model
- [AGENTS.md](docs/AGENTS.md) - Guide for AI agents and contributors
- [CHANGELOG.md](docs/CHANGELOG.md) - Version history and features
- [RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) - Publication procedures

### Development Setup

```bash
# Install dependencies
npm install

# Run linting
npm run lint

# Open in VS Code and press F5 to launch Extension Development Host
```

## Security & Best Practices

- ✅ Uses official `marked` package for Markdown parsing
- ✅ Implements Content Security Policy (CSP) for webview security
- ✅ Uses nonce-based script loading
- ✅ Restricts external resource loading
- ✅ Mermaid loaded from trusted CDN (jsdelivr.net)
- ✅ Follows VS Code extension best practices (2024)

## Limitations

- **Math Support:** Mathematical expressions (LaTeX/MathJax) are not currently supported and will display as plain text
- **Offline Mode:** Mermaid diagrams require internet connection (CDN-based)

## Project Structure

```
lightweight-markdown-preview/
├── src/
│   └── extension.js              # Main extension code
├── assets/
│   ├── icon.png                  # Extension icon (displayed in VS Code)
│   └── icon-eye.svg              # Editor command icon
├── examples/
│   ├── test.md                   # Comprehensive test file with all features
│   └── example.md                # Example markdown file
├── docs/
│   ├── ARCHITECTURE.md           # Design decisions and security model
│   ├── AGENTS.md                 # Development guide for contributors
│   ├── CHANGELOG.md              # Version history
│   ├── RELEASE_CHECKLIST.md      # Pre-publication verification steps
│   └── MARKETPLACE_PREPARATION.md # Marketplace submission checklist
├── .github/
│   └── workflows/
│       └── ci.yml                # CI/CD pipeline for PR checks
├── .vscode/
│   ├── launch.json               # Extension debugging configuration
│   └── settings.json             # ESLint configuration
├── package.json                  # Extension manifest and dependencies
├── README.md                      # This file
├── LICENSE                        # MIT License
└── .vscodeignore                 # Files excluded from package
```

## Contributing

Pull requests are welcome! Areas for improvement:

- Add MathJax/KaTeX support for mathematical expressions
- Bundle Mermaid locally for offline support
- Add custom themes for preview
- Support for other diagram types

Before contributing, read [ARCHITECTURE.md](docs/ARCHITECTURE.md) and [AGENTS.md](docs/AGENTS.md) for development guidelines.

## License

MIT
