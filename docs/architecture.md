# Architecture

This document describes the design decisions and architectural patterns used in the Lightweight Markdown Preview extension.

## Overview

The extension provides a lightweight, secure markdown preview directly within VS Code. It prioritizes simplicity, security, and performance over feature breadth. The entire implementation is contained in a single extension file (~677 lines) with no external dependencies beyond the `marked` markdown parser.

## High-Level Architecture

```
User opens markdown file
         ↓
Command: "Show Lightweight Markdown Preview"
         ↓
Extension creates/reuses single webview panel
         ↓
User edits markdown → onDidChangeTextDocument fires
         ↓
updateWebviewContent() renders markdown to HTML
         ↓
Webview displays rendered content with Mermaid/MathJax
```

**Design principle:** One active webview panel per extension session, reused across different markdown files. This minimizes resource consumption and simplifies state management.

## Security Model

Our security model assumes that any markdown file could be malicious. We use a defense-in-depth strategy to mitigate risks, primarily Cross-Site Scripting (XSS).

### Layer 1: Content Security Policy (CSP) with Nonces

We enforce a strict CSP that only allows scripts with a unique, randomly-generated `nonce` (number used once) to run.

- **How it works:** A new cryptographic nonce is generated for every preview render. This nonce is included in the CSP `meta` tag and in every legitimate `<script>` tag.
- **Effect:** Any malicious `<script>` tag injected within the markdown will not have the correct nonce and will be blocked by the browser from executing.

### Layer 2: Safe HTML Parsing

The `marked` parser sanitizes input by escaping HTML, turning potentially executable code into inert text.

- **Example:** `<script>alert('xss')</script>` becomes `&lt;script&gt;alert('xss')&lt;/script&gt;`

### Layer 3: Trusted External Scripts

Mermaid and MathJax are loaded from trusted CDNs (jsDelivr), not from user-controlled content. The extension never executes user-provided JavaScript.

### Layer 4: VS Code Sandbox

The entire preview is sandboxed by VS Code, preventing access to the file system or other sensitive resources.

## State Management

The extension's state is managed entirely in memory and is reset every time the extension is reloaded.

### Lifecycle

1. **Initialization:** When the user runs the "Show Preview" command, the extension creates a single webview panel.
2. **State Variables:** Two key variables are set in a closure:
   - `currentPanel`: Holds the reference to the active webview.
   - `currentDocument`: Holds the reference to the text document being previewed.
3. **Event Listening:** An `onDidChangeTextDocument` listener is registered to watch for edits.
4. **Update Cycle:** When the document changes, the listener triggers an update:
   - A new CSP `nonce` is generated.
   - The markdown content is parsed and rendered into a full HTML document.
   - The webview's HTML is replaced with the new content.
5. **Disposal:** When the user closes the panel, the listener is removed and the `currentPanel` variable is set to `null`, releasing its resources.

## Content Processing Pipeline

1. **Extraction:** Mermaid and math blocks are extracted and preserved before markdown parsing (prevents escaping of special syntax)
2. **Rendering:** `marked` converts markdown to HTML
3. **Restoration:** Preserved blocks are restored with original delimiters intact
4. **Path Resolution:** Image `src` attributes are converted to webview-accessible URIs, handling:
   - Relative paths (`./images/photo.png`)
   - Parent directory paths (`../docs/diagram.png`)
   - Workspace-root paths (`/assets/icon.png`)
   - HTTPS URLs and data URIs (unchanged)

## Performance Characteristics

### Current Approach
- **Full re-render on every change:** The entire markdown is re-parsed and HTML regenerated
- **Why:** Ensures consistency and simplicity. Given typical markdown file sizes (< 10 MB), this is fast enough
- **Cost:** ~10-50ms for typical documents on modern hardware

### Optimization Opportunities
For future enhancements with scroll-position syncing or large file support:
- **Virtual rendering:** Only render visible sections of the preview
- **Incremental updates:** Track which sections changed and re-render only those
- **Debouncing:** Batch rapid edits to reduce render frequency
- **Web Worker:** Off-load markdown parsing to a background thread

## UI & Navigation Design

### Table of Contents Sidebar (Collapsible Overlay Pattern)

The extension features a collapsible table of contents sidebar implemented as an overlay (Option 3 pattern) for maximum simplicity and reliability.

#### Design Decisions

1. **Overlay Pattern (Not Fixed Layout):**
   - Sidebar starts hidden and slides in from the left when user clicks the hamburger button (☰)
   - Content area maintains consistent width (no reflow when sidebar opens/closes)
   - Reduces code complexity and eliminates edge cases from layout adjustments

2. **Interactions:**
   - **Open:** Click hamburger button (fixed at top-left)
   - **Close:** Click close button (✕), overlay backdrop, or press Escape key
   - **Navigate:** Click any outline link for smooth scroll to heading
   - **Track:** Active heading is highlighted as user scrolls content

3. **Styling Simplification:**
   - Uniform font-size for all heading levels (0.9em)
   - Uniform color for all links (#0066cc)
   - Indentation alone shows hierarchy (12px per level)
   - Active state uses left border instead of full background fill
   - Reduces CSS maintenance burden and visual complexity

4. **Animation Performance:**
   - Uses GPU-accelerated `transform: translateX()` for sidebar movement
   - Zero layout shifts during animation (only composite repaints)
   - Smooth 0.3s transition for visual feedback

5. **Accessibility:**
   - Semantic HTML5 (`<aside role="navigation">`, `<button>` elements)
   - ARIA labels for screen readers (`aria-label`, `aria-hidden`)
   - Keyboard navigation (Escape to close)
   - High contrast colors meet WCAG AA standards

#### Implementation Details

**HTML Structure:**
- `<button class="sidebar-toggle">☰</button>` - Always visible, fixed positioning
- `<div class="sidebar-overlay">` - Transparent backdrop, clickable to close
- `<aside class="toc-sidebar">` - Sidebar containing table of contents
- `<button class="toc-close">✕</button>` - Close button in sidebar header

**CSS State Management:**
- Default state: `.sidebar-overlay` opacity: 0, pointer-events: none (hidden)
- Default state: `.toc-sidebar` transform: translateX(-100%) (off-screen)
- Open state (body.sidebar-open): overlay visible, sidebar visible
- Smooth 0.3s transitions on all state changes

**JavaScript Event Handlers:**
- Toggle button: Adds `sidebar-open` class to body
- Close button: Removes `sidebar-open` class from body
- Overlay click: Removes `sidebar-open` class from body
- Escape key: Removes `sidebar-open` class from body (document-wide listener)
- TOC link click: Updates active link, auto-scrolls sidebar only if visible
- Scroll observer: Tracks visible heading, updates active link (regardless of sidebar state)

#### Rationale for This Design

- **Simplicity:** Fewer CSS rules, fewer interaction states, lower maintenance burden
- **Reliability:** No layout shift bugs, no coordinate system conflicts, no animation sync issues
- **Performance:** GPU-accelerated animations, zero reflows, consistent 60 FPS
- **UX:** Familiar pattern (mobile hamburger menu), user controls screen space
- **Consistency:** Content width never changes, reading experience unchanged

## Guidelines for Future Changes

To maintain the extension's stability and security, follow these guidelines.

### Safe to Modify

The following areas are generally safe for modification and extension:
- **Styling:** Adjusting CSS for elements like the body, code blocks, and tables
- **Markdown Options:** Passing new configuration options to the `marked()` parser
- **VS Code Settings:** Adding new user-configurable settings in `package.json`
- **New Commands:** Adding new commands in `package.json` and implementing them in `extension.js`
- **Sidebar Styling:** Adjusting colors, spacing, or hover effects in `.toc-sidebar` or `.toc-link` classes

### Requires Security Review

Changes to the following areas are high-risk and **must undergo a security review**. They form the core of the extension's security and stability:
- **Content Security Policy (CSP):** Modifying the CSP header can instantly create security vulnerabilities
- **Nonce Generation:** The cryptographic token logic is critical for preventing XSS
- **Mermaid/Math Preprocessing:** The regex logic is delicate and handles untrusted input
- **State Management:** Altering the data flow could introduce bugs or race conditions
- **Script Execution:** Any addition of user script execution or dynamic eval operations
