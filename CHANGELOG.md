# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Workspace Trust support (`capabilities.untrustedWorkspaces.supported = true`), allowing Markdown previews to function in Restricted Mode on untrusted workspaces

## [1.4.0] - 2026-10-24

### Added

- Preview follows the active Markdown editor; switching to another Markdown file updates the preview, and each file starts at the top
- Inline math (`$...$`) now renders; before, only block math (`$$...$$`) did
- Preview keeps its scroll position while you type

### Changed

- Mermaid, MathJax, and highlight.js load at exact versions (Mermaid 12.1.0, MathJax 4.1.3, highlight.js 11.12.0) instead of floating major tags
- Mermaid 12 draws diagrams with its new default look (orthogonal edges, flat styling), so existing diagrams look different
- Minimum VS Code version is 1.105 (was 1.85)
- Mermaid diagrams use the `strict` security level
- Markdown parser updated to `marked` 18.1.0
- Minimum Node version for development is 20

### Fixed

- Math and Mermaid source containing `<`, `>`, or `&` no longer breaks the page; heading text in the outline is escaped
- A `$` inside a Mermaid diagram label no longer corrupts the diagram
- Text such as `{{CONTENT}}` in a heading can no longer displace the page content
- The outline sidebar and syntax highlighting keep working when the Mermaid library cannot be loaded
- Closing the preview while an update is pending no longer raises an error notification
- Security: build-tool dependency advisories resolved (`npm audit` reports 0)

## [1.3.1] - 2026-03-13

### Fixed

- Replace custom SVG command icon with built-in `$(eye)` codicon for correct rendering in dark and high-contrast VS Code themes
- Remove redundant `activationEvents` entry (VS Code auto-generates from contribution declarations)

## [1.3.0] - 2026-02-15

### Added

- Dark theme support: preview now adapts to VS Code light, dark, and high-contrast themes automatically
- Mermaid diagrams and syntax highlighting themes switch with the VS Code theme
- Preview re-renders automatically when you change your VS Code color theme

### Changed

- All CSS uses VS Code theme variables for consistent appearance across themes

## [1.2.0] - 2026-02-07

### Added

- Heading hierarchy indicators: pound-sign prefixes (#, ##, ###) show heading level at a glance in the TOC sidebar
- Collapsible TOC sections: headings with children can be expanded/collapsed via disclosure triangles, collapsed by default for a clean outline view
- Auto-expand: scrolling to a heading inside a collapsed section automatically reveals it in the TOC

### Changed

- TOC generation rewritten from iterative level-tracking to recursive tree-based algorithm for proper parent-child relationships

## [1.1.0] - 2026-02-02

### Added

- Azure DevOps compatibility: Mermaid diagrams now render with both triple-colon (:::) and backtick (```) syntax
- This makes the extension the only VS Code markdown previewer that natively supports both GitHub-style and Azure DevOps-style Mermaid notation, enabling portable documentation across platforms

### Changed

- Enhanced documentation with Azure DevOps compatibility details

## [1.0.5] - 2025-11-09

### Added

- Collapsible table of contents sidebar for document outline navigation
- Hamburger button (☰) at top-right to toggle sidebar visibility

### Changed

- Sidebar now slides in from right side (improved UX consistency)
- Simplified TOC link styling (uniform font size, left-border active indicator)
- Improved button styling for better light/dark theme compatibility

### Fixed

- Fixed heading extraction to ignore code block comments (# symbols in bash code)
- Fixed active state conflict when clicking outline items during scroll

## [1.0.4] - 2025-11-07

### Changed

- Version bump and marketplace release

## [1.0.3] - 2025-11-07

### Fixed

- Synced package-lock.json version with package.json (was outdated at v0.4.0)
- Removed duplicate files with case sensitivity issues (ARCHITECTURE.md/architecture.md)
- Fixed documentation references and link formats across all markdown files

### Changed

- Updated documentation metrics to reflect actual code size (~51 KB, ~677 lines)
- Renamed ARCHITECTURE.md to architecture.md for consistency
- Enhanced development.md with comprehensive code standards, JSDoc guidelines, and common pitfalls section
- Standardized all documentation links to use lowercase filenames
- Updated dependencies (marked@16.4.2, eslint@9.39.1, @types/node@24.10.0)

## [1.0.2] - 2025-11-04

### Added

- Document outline with interactive TOC sidebar for easy navigation
- Auto-scrolling TOC that keeps the current section visible as you read
- Click-to-scroll navigation in TOC for quick jumping between sections
- Proper heading hierarchy display in the table of contents

### Changed

- Improved preview layout with fixed sidebar navigation
- Enhanced user experience with smooth scroll tracking

### Fixed

- Fixed heading anchor link generation

## [1.0.1] - 2025-11-02

### Added

- Lightweight Markdown preview (single runtime dependency: `marked`)
- Full Mermaid diagram support (flowcharts, sequences, state diagrams, etc.)
- MathJax equation support (inline and display math)
- Live preview updates as you type
- Real-time syntax highlighting for code blocks
- Privacy-friendly (no tracking, no data collection)
- Content Security Policy for secure script execution
- Support for all standard Markdown elements (headings, lists, tables, blockquotes)
- Image path resolution for both relative and absolute paths
