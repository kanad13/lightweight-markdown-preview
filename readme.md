# Lightweight Markdown Preview

A minimal VS Code extension for previewing Markdown with Mermaid diagrams and MathJax support. **No bloat. No configuration. Just markdown.**

## Why This Extension?

- **Lightweight:** ~53 KB packaged (no massive dependencies)
- **Privacy-Friendly:** No tracking, no analytics, no data collection. Your markdown stays on your machine
- **Simple:** ~748 lines of code, easy to understand and maintain
- **Fast:** Live preview updates as you type
- **Secure:** Content Security Policy, nonce-based script execution
- **One Job:** Previews Markdown. That's it. No themes, no plugins, no bloat.

![Lightweight Markdown Preview Screenshot](./docs/markdown-preview.png)

## Features

- Real-time Markdown preview in a side panel
- Interactive table of contents sidebar with collapsible sections for easy document navigation
- Collapsible/expandable TOC headings to manage large documents efficiently
- Auto-scrolling outline that highlights your current section as you read
- Click-to-scroll navigation in the TOC for quick jumping between sections
- All standard Markdown elements (headings, lists, tables, code blocks, images, etc.)
- Full Mermaid diagram support (flowcharts, sequences, state diagrams, etc.)
- MathJax support for LaTeX equations

## Install

1. Open VS Code (Insiders, Cursor, Windsurf or any other VS Code-based editor)
2. Go to Extensions
3. Search for "Lightweight Markdown Preview" or explicitly for `KunalPathak.lightweight-markdown-preview`
4. Click Install
5. Start previewing your Markdown file by clicking the "Eye" icon in the top-right corner or using the Command Palette (`Ctrl+Shift+P` > `Markdown: Show Lightweight Markdown Preview`)

## Documentation Guide

### For Users
This README is all you need to install and use the extension.

### For Developers

**Before making any code changes:**
1. Read [architecture.md](docs/architecture.md) - understand design decisions, security model, and why things are structured as they are
2. This ensures changes align with the existing design and don't introduce security issues

**While developing and releasing:**
1. Follow [development.md](docs/development.md) for the complete workflow:
   - **Section 1:** Local setup and verification
   - **Section 2:** Feature development workflow (creating branches, making changes, testing, merging)
   - **Section 3:** Release to marketplace (version bumps, tagging, publishing)
   - **Section 4 & 5:** Code quality checklist and common pitfalls to avoid

**At a glance:**
- `architecture.md` - WHY design decisions were made
- `development.md` - HOW to develop and release code
- `CHANGELOG.md` - WHAT changed in each version
