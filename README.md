# Lightweight Markdown Preview

A minimal VS Code extension for previewing Markdown with Mermaid diagrams and MathJax support. **No bloat. No configuration. Just markdown.**

## Why This Extension?

- **Lightweight:** ~19 KB packaged (no massive dependencies)
- **Privacy-Friendly:** No tracking, no analytics, no data collection. Your markdown stays on your machine
- **Simple:** ~260 lines of code, easy to understand and maintain
- **Fast:** Live preview updates as you type
- **Secure:** Content Security Policy, nonce-based script execution
- **One Job:** Previews Markdown. That's it. No themes, no plugins, no bloat.

## Features

- Real-time Markdown preview in a side panel
- Full Mermaid diagram support (flowcharts, sequences, state diagrams, etc.)
- MathJax support for LaTeX equations (inline and display)
- All standard Markdown elements (headings, lists, tables, code blocks, images, etc.)
- Syntax highlighting in code blocks
- Keyboard shortcut: `Cmd+Shift+M` (macOS) or `Ctrl+Shift+M` (Windows/Linux)

## Install

### From Marketplace (Recommended)

1. Open VS Code
2. Go to Extensions (`Cmd+Shift+X` / `Ctrl+Shift+X`)
3. Search for "Lightweight Markdown Preview"
4. Click Install

### From .vsix File

1. Download `.vsix` from [Releases](https://github.com/kanad13/lightweight-markdown-preview/releases)
2. In VS Code: Extensions → ... menu → Install from VSIX
3. Select the file

## Usage

1. Open any Markdown file (`.md`)
2. Run command: `Markdown: Show Lightweight Markdown Preview` (Cmd+Shift+P)
3. Or click the eye icon in the editor title bar
4. Preview updates as you edit

## Test It

Open `examples/test.md` and run the preview command to verify all Markdown elements, Mermaid diagrams, and code highlighting render correctly.

## For Developers

See [DEVELOPMENT.md](docs/development.md) for:

- How to develop, test, and release
- Architecture and design decisions

## License

MIT
