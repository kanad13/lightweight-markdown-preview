# Architecture & Design Document

## Overview

This is a lightweight VS Code extension that provides real-time Markdown preview with built-in support for Mermaid diagrams. The extension is designed to be simple, fast, and focused on core functionality without unnecessary dependencies.

## Key Design Decisions

### 1. **Single Webview Panel Approach**
- **Decision:** Keep only one preview panel open at a time (tracked in `currentPanel`)
- **Why:** 
  - Prevents resource exhaustion from multiple webview instances
  - Simplifies state management
  - Aligns with VS Code's standard preview behavior (similar to built-in previews)
- **Trade-off:** Users can only preview one file at a time. This is acceptable for the use case.

### 2. **Document Tracking via `currentDocument`**
- **Decision:** Track which document is currently being previewed
- **Why:**
  - Enables efficient updates via document change listeners
  - Only updates preview for the document being viewed (not all open files)
  - Prevents unnecessary rendering of non-visible documents
- **Implementation:** When user switches documents, the preview updates to show the new file's content

### 3. **Pre-processing Mermaid Blocks Before Markdown Rendering**
- **Decision:** Extract and convert mermaid code blocks BEFORE running them through the `marked` parser
- **Why:**
  - Prevents `marked` from escaping/modifying mermaid syntax
  - Mermaid blocks use triple backticks (`) but need special handling
  - Regex replacement happens before HTML generation to preserve diagram code integrity
- **Implementation:** `/```mermaid\s*\n([\s\S]*?)```/g` regex finds blocks and wraps them in `<pre class="mermaid">`
- **Known Issue:** If someone uses literal mermaid syntax in code blocks with exact backticks, it may be processed as a diagram

### 4. **Content Security Policy (CSP) with Nonce-based Scripts**
- **Decision:** Implement CSP headers and nonce-based script loading
- **Why:**
  - VS Code webviews require this for security
  - Prevents injection attacks
  - Allows external scripts (Mermaid CDN) in a controlled way
- **Implementation:** 
  - Generate unique nonce on each render
  - Include nonce in script tags
  - Allow CDN sources in CSP header
- **Security Level:** Set to `loose` for Mermaid to allow all diagram types

### 5. **Live Update on Document Change**
- **Decision:** Use `onDidChangeTextDocument` listener to update preview in real-time
- **Why:**
  - Provides immediate feedback as user types
  - Better UX than static previews
  - VS Code provides this event for free
- **Implementation:** Listener checks if changed document matches `currentDocument` before updating
- **Performance:** Rendering is debounced by user's typing speed (not explicitly throttled)

### 6. **Marked Library for Markdown Rendering**
- **Decision:** Use the `marked` library instead of implementing parsing ourselves
- **Why:**
  - Battle-tested, fast, and standards-compliant
  - Actively maintained
  - Smaller than bundling a full parser
  - Supports extensions for custom rendering
- **Trade-off:** External dependency, but it's the standard choice for JS markdown

### 7. **Mermaid via CDN**
- **Decision:** Load Mermaid from CDN (jsDeliver) instead of bundling it
- **Why:**
  - Mermaid is large (~180KB+) - CDN keeps package size small
  - CDN is cached across VS Code installations
  - Easier to update independently
- **Trade-off:** Requires internet connection for diagrams. Users on air-gapped systems cannot use diagrams.
- **Future Improvement:** Could bundle Mermaid locally and use a setting to toggle

## Architecture Layers

```
┌─────────────────────────────────────────┐
│    VS Code UI (Editor + Commands)       │
│  (Command palette, editor title icon)   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   Extension Host (extension.js)         │
│  - Command registration                 │
│  - Event listeners                      │
│  - State management                     │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│    Webview Rendering Layer              │
│  - Markdown rendering (marked lib)      │
│  - Mermaid diagram rendering (CDN)      │
│  - Styling & layout                     │
└─────────────────────────────────────────┘
```

## State Management

The extension maintains minimal state:

```javascript
let currentPanel = undefined;      // Currently open webview panel
let currentDocument = undefined;   // Document being previewed
```

**State Flow:**
1. User clicks command → Create/reveal panel, set `currentDocument`
2. User edits markdown → Document change event → Update same panel
3. User closes panel → `onDidDispose` → Reset both to `undefined`
4. User opens different markdown → Command fired → Update `currentDocument`, re-render panel

**Why minimal state?** Simpler = fewer bugs, easier to maintain and extend

## Extension Points (Future Enhancements)

### 1. Custom Themes
- **How:** Add configuration settings for theme colors
- **Where:** Modify the CSS in `getWebviewContent()`
- **Impact:** Low - purely visual

### 2. Additional Diagram Support
- **How:** Detect code block language and route to appropriate renderer
- **Where:** Extend the mermaid block detection logic in `updateWebviewContent()`
- **Impact:** Medium - requires new CDN or bundled library

### 3. Math Expression Support
- **How:** Similar to Mermaid - preprocess `$$..$$` or `$...$` blocks
- **Where:** Add another regex pass before markdown rendering
- **Impact:** Medium - adds KaTeX or MathJax dependency

### 4. Markdown Extensions (tables, strikethrough, etc)
- **How:** Configure `marked` parser with extensions
- **Where:** Pass options object to `marked()` call
- **Impact:** Low - `marked` already supports these

### 5. Multiple Panel Preview
- **How:** Track panels by document URI instead of single `currentPanel`
- **Where:** Refactor to use `Map<documentUri, panel>`
- **Impact:** High - requires state management redesign

## Performance Considerations

### Current Approach
- Rendering: On every document change (no debouncing)
- State: Minimal, only tracking current panel and document
- Dependencies: One npm dependency (`marked`), Mermaid via CDN

### Potential Bottlenecks
- Large files: Very large markdown files might cause lag on every keystroke
- Mermaid rendering: Complex diagrams might take time to render (CDN latency + JS execution)
- Regex parsing: The mermaid block extraction uses a global regex that processes entire document

### Future Optimizations (if needed)
- Add debouncing for document changes
- Implement virtual scrolling for preview
- Cache rendered HTML and only update changed sections
- Preprocess on worker thread

## Dependencies

### Runtime
- **marked** (^9.0.0): Markdown parser
  - Why: Standard choice, actively maintained, good performance
  - Size: ~35KB minified
  - Used for: Converting markdown to HTML

### Dev Dependencies
- **@types/vscode**, **@types/node**: TypeScript type definitions
- **@vscode/test-electron**: Test runner for VS Code extensions
- **eslint**: Code linting
- **@vscode/vsce**: Packaging tool

### External (CDN)
- **Mermaid v11** (jsDelivr CDN): Diagram rendering
  - Why: Large library, better to load on demand
  - Trade-off: Requires internet connection

## Testing Strategy

Currently minimal test setup. For future:
- Unit tests: Regex patterns for mermaid extraction
- Integration tests: Markdown rendering with various inputs
- Visual tests: Mermaid diagram rendering

See `test/` directory for current test structure.

## Known Limitations

1. **No Math Support:** LaTeX/MathJax expressions not rendered (display as plain text)
2. **No Offline Diagram Support:** Mermaid diagrams require internet (CDN-based)
3. **Single Preview Panel:** Can only preview one file at a time
4. **No Markdown Extensions:** Doesn't support GitHub-flavored markdown extensions by default (but easily extensible)
5. **Performance:** Large files (10MB+) may cause lag on every keystroke
6. **Regex Fragility:** Mermaid block detection could fail with nested backticks

## Maintenance Notes

- **Security Updates:** Keep `marked` and other dependencies up to date
- **VS Code Updates:** May need CSP adjustments for future VS Code versions
- **Mermaid Updates:** CDN source should be monitored for breaking changes
- **Test Coverage:** Currently low - consider adding tests before major refactors

## Future Roadmap

1. **Priority: High**
   - Add test coverage (unit tests for core functions)
   - Support GitHub-flavored markdown by default
   - Add custom theme settings

2. **Priority: Medium**
   - Math expression support (KaTeX)
   - Multiple preview panels support
   - Export rendered preview as HTML

3. **Priority: Low**
   - Bundle Mermaid locally for offline support
   - Support other diagram types (PlantUML, D2, etc.)
   - Dark mode theme optimization
   - Performance optimizations (debouncing, virtual scroll)

---

**Last Updated:** October 24, 2025
**For AI Agents:** This document explains the WHY behind each design decision. Before modifying architecture, read this to understand trade-offs.
