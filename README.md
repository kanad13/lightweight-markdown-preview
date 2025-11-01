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

### Development Mode
```bash
git clone https://github.com/kanad13/lightweight-markdown-preview.git
cd lightweight-markdown-preview
npm install
code .
# Press F5 to launch Extension Development Host
```

## Usage

1. Open any Markdown file (`.md`)
2. Run command: `Markdown: Show Lightweight Markdown Preview` (Cmd+Shift+P)
3. Or click the eye icon in the editor title bar
4. Preview updates as you edit

## Test It

Open `examples/test.md` and run the preview command. You should see:
- All Markdown elements rendered correctly
- Mermaid flowchart rendering
- Code block syntax highlighting

## Limitations

- **Offline:** Mermaid diagrams and MathJax require internet (CDN-based)
- **Single Panel:** One preview per window
- **Theming:** Uses default light/dark theme, no custom themes

## Development

This extension is designed for **AI agent maintenance.** See [DEVELOPMENT.md](DEVELOPMENT.md) for:
- Code structure and how to make changes
- Testing procedures
- How to build and release new versions
- What to avoid

## Architecture Notes

For curious developers: [ARCHITECTURE.md](docs/ARCHITECTURE.md) contains design decisions and security model.

## License

MIT
