# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Collapsible/expandable sections in table of contents sidebar using HTML5 `<details>` elements
- Native browser-based collapsibility with built-in keyboard navigation and screen reader support
- Smart hierarchical display: headings with sub-headings are collapsible, leaf headings remain simple links
- Recursive tree-building algorithm for proper nesting of TOC sections

### Fixed
- Click event conflicts between TOC links and collapsible sections (chevron now collapses, text navigates)
- Layout issue where sidebar would overlap content area when toggling sections
- Active state highlighting now consistent across all TOC heading levels (1-6)

### Changed
- Simplified TOC styling to use consistent blue color for all heading levels (removed grey color for deeper levels)
- Improved CSS specificity for active states to ensure proper visual feedback
- Updated documentation to reflect collapsible TOC feature and implementation details
- Code size increased from ~677 to ~748 lines (+71 lines for collapsibility feature)

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

### Initial Release
- Lightweight Markdown preview (~38 KB, no dependencies)
- Full Mermaid diagram support (flowcharts, sequences, state diagrams, etc.)
- MathJax equation support (inline and display math)
- Live preview updates as you type
- Real-time syntax highlighting for code blocks
- Privacy-friendly (no tracking, no data collection)
- Content Security Policy for secure script execution
- Support for all standard Markdown elements (headings, lists, tables, blockquotes)
- Image path resolution for both relative and absolute paths
