# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-10-24

### Added
- Initial release with Markdown preview support
- Full Mermaid diagram support (v11) via CDN
- Real-time preview updates as you type
- Content Security Policy for safe rendering
- Support for all standard Markdown elements (headings, lists, links, images, tables, code blocks, blockquotes)
- Command palette integration for easy preview toggle
- Automatic preview updates when switching between documents

### Security
- Implements Content Security Policy (CSP) with nonce-based script execution
- Sandbox restriction on webview to prevent access to extension data
- No user data collection or transmission

### Known Limitations
- Mathematical expressions (LaTeX/MathJax) are not supported and display as plain text
- Mermaid diagrams require an internet connection (CDN-based rendering)
- Preview panel is shared across all documents (single panel per window)
