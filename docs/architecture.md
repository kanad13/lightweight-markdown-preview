# Architecture

This document describes the design decisions and architectural patterns used in the Lightweight Markdown Preview extension.

## Overview

The extension provides a lightweight, secure markdown preview directly within VS Code. It prioritizes simplicity, security, and performance over feature breadth. The implementation consists of `src/extension.js` (logic) and `src/webview.html` (template, inlined at build time by webpack). The only bundled dependency is the `marked` markdown parser. Mermaid, MathJax, and highlight.js load in the webview from jsDelivr at exact, pinned versions; [dependencies.md](dependencies.md) explains how those versions are chosen.

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

**Design principle:** One active webview panel per extension session. The panel follows the active Markdown editor: when another Markdown file becomes the active editor, the panel renders that file. This minimizes resource consumption and simplifies state management.

## Security Model

The security model assumes that any Markdown file could be malicious. The extension layers its defenses, mainly against Cross-Site Scripting (XSS).

### Layer 1: Content Security Policy (CSP) with Nonces

The extension enforces a strict CSP that runs only scripts with a unique, random `nonce` (number used once).

- **How it works:**
  - The extension generates a new nonce for every preview render.
  - The nonce appears in the CSP `meta` tag and in every legitimate `<script>` tag.
- **Effect:**
  - A `<script>` tag injected through Markdown lacks the nonce.
  - The browser blocks that script.

### Layer 2: Escaping of Generated Markup

Raw HTML in a document passes through `marked` unchanged, so the CSP in Layer 1 is the control that stops such markup from running scripts. The extension escapes every fragment it builds itself.

- **Outline entries:**
  - `escapeHtml()` escapes heading text before it enters the sidebar markup.
- **Math and Mermaid source:**
  - The extension escapes preserved blocks, so a diagram or formula cannot close its `<pre>` element or open a new tag.
  - The browser decodes the entities, so MathJax and Mermaid still read the original source.
- **Mermaid security level:**
  - Diagrams render with `securityLevel: 'strict'`.
  - That level disables click handlers and sanitizes HTML labels.

### Layer 3: Trusted External Scripts

Mermaid, MathJax, and highlight.js load from jsDelivr, never from document content.

- **Versions:**
  - The exact versions live in `CDN_VERSIONS`.
  - A new upstream release reaches users only after a maintainer reviews it and changes that constant.
- **User scripts:**
  - The extension never executes JavaScript from a document.

### Layer 4: VS Code Sandbox

VS Code runs the preview in an isolated webview.

- **File access:**
  - The page loads local files only from the folders in `localResourceRoots`.
  - Those folders are the extension folder and the open workspace folders.
- **Extension host:**
  - The page has no direct access to the extension host.

### Layer 5: Workspace Trust (Restricted Mode Support)

The extension declares `"capabilities": { "untrustedWorkspaces": { "supported": true } }` in `package.json`.

- **Safe in untrusted workspaces:**
  - Rendering markdown is a pure in-memory transformation.
  - The extension runs no workspace executables, build scripts, or language servers.
  - The webview runs with strict CSP nonces and restricted local roots.
  - Users can safely preview untrusted folders and cloned repositories without granting workspace trust.

## State Management

The extension's state is managed entirely in memory and is reset every time the extension is reloaded.

### Lifecycle

1. **Initialization:** When the user runs the "Show Preview" command, the extension creates a single webview panel.
2. **State Variables:** Two key variables are set in a closure:
   - `currentPanel`: Holds the reference to the active webview.
   - `currentDocument`: Holds the reference to the text document being previewed.
3. **Event Listening:** An `onDidChangeTextDocument` listener watches for edits, and an `onDidChangeActiveTextEditor` listener switches the preview to the newly active Markdown file. The switch ignores the panel taking focus (no editor), non-Markdown files, and the `git` side of a diff, and it cancels any pending debounced update so the previous file cannot overwrite the new one.
4. **Update Cycle:** When the document changes, the listener triggers an update:
   - A new CSP `nonce` is generated.
   - The markdown content is parsed and rendered into a full HTML document.
   - The webview's HTML is replaced with the new content.
5. **Disposal:** When the user closes the panel, any pending debounced update is cancelled and `currentPanel` and `currentDocument` are reset to `undefined`. The document-change and theme-change listeners stay registered for the life of the extension and do nothing while no panel is open.

## Content Processing Pipeline

1. **Extraction:** `renderMarkdown()` removes Mermaid blocks, then block math, then inline math, before parsing, so `marked` cannot alter their syntax. Mermaid goes first because diagram labels can contain `$`.
   - Mermaid supports dual syntax: GitHub-style (` ```mermaid `) and Azure DevOps-style (`::: mermaid`)
2. **Rendering:** `marked` converts the remaining markdown to HTML
3. **Restoration:** Preserved blocks return in place, HTML-escaped, with original delimiters intact. MathJax is configured to recognize both `$...$` and `\(...\)` as inline delimiters.
4. **Path Resolution:** Image `src` attributes are converted to webview-accessible URIs, handling:
   - Relative paths (`./images/photo.png`)
   - Parent directory paths (`../docs/diagram.png`)
   - Workspace-root paths (`/assets/icon.png`)
   - HTTPS URLs and data URIs (unchanged)

## Scroll Position Retention

Every edit replaces the whole webview page, which resets the browser's scroll position to the top. The page keeps the reading position in three steps.

- **Save:**
  - The page saves `window.scrollY` with the webview state API (`acquireVsCodeApi().setState`) after a 100 ms pause in scrolling.
  - The saved state includes the URI of the previewed document (`data-doc` on the content element).
- **Restore:**
  - The page restores the position after Mermaid and MathJax finish and the layout reaches its final height.
  - The page restores only when the saved URI matches the document on screen, so a different file starts at the top.
- **Timeout:**
  - A 4-second timeout bounds the wait when the CDN is offline or blocked.

## Performance Characteristics

### Current Approach

- **Full re-render on every change:** The entire markdown is re-parsed and HTML regenerated
- **Debounced:** 300ms debounce on `onDidChangeTextDocument` batches rapid edits
- **Why:** Ensures consistency and simplicity. Given typical markdown file sizes (< 10 MB), this is fast enough
- **Cost:** ~10-50ms for typical documents on modern hardware

### Optimization Opportunities

For future enhancements with scroll-position syncing or large file support:

- **Virtual rendering:** Only render visible sections of the preview
- **Incremental updates:** Track which sections changed and re-render only those
- **Web Worker:** Off-load markdown parsing to a background thread

## UI & Navigation Design

### Table of Contents Sidebar (Collapsible Overlay)

The extension provides an optional table of contents sidebar that users can toggle on-demand. Rather than permanently occupy screen space, the sidebar overlays content when open—similar to mobile hamburger menu patterns familiar to most users.

#### Design Philosophy

**Why Overlay Instead of Fixed Layout:**

- **Content-first:** Content width remains constant regardless of sidebar state, providing consistent reading experience
- **Simplicity:** Avoids layout reflow complexity, coordinate system bugs, and animation sync issues
- **Low maintenance:** Fewer CSS rules and interaction states reduce code fragility
- **User control:** Users get full screen width for reading when they don't need the outline

**Why Collapsible at All:**

- Long documents benefit from quick access to structure without scrolling through headings
- Users can reference the outline while reading without losing scroll position
- Keyboard users can navigate via Escape key without reaching for mouse

#### Key Interactions

- **Toggle:** Click hamburger button to open/close sidebar
- **Close:** Click sidebar close button, overlay backdrop, or press Escape key
- **Navigate:** Click any outline link for smooth scroll to heading
- **Track:** Current heading highlighted automatically as user scrolls content
- **Collapse/Expand:** Parent headings with children show a disclosure triangle; H1 sections start expanded and deeper levels start collapsed; clicking the triangle toggles visibility; scrolling to a heading auto-expands its collapsed parent sections
- **Hierarchy indicators:** Pound-sign prefixes (#, ##, ###) indicate heading depth at a glance, styled in muted monospace to avoid visual clutter

#### Collapsible TOC Implementation

The TOC uses native HTML `<details>/<summary>` elements for collapsibility:

- **Zero-JS toggle:** Browser-native toggle mechanism, no custom JavaScript for expand/collapse
- **Collapsed below H1:** Only H1 `<details>` elements carry the `open` attribute, which keeps the outline compact on first open while showing the top level
- **Tree-based generation:** Headings are built into a parent-child tree (via `buildTOCTree()`), then rendered recursively (via `renderTOCNode()`). Parent nodes wrap children in `<details>/<summary>`, leaf nodes render as plain items.
- **Link/toggle separation:** `e.stopPropagation()` on link clicks prevents `<details>` toggle when navigating, so clicking the heading text scrolls without collapsing
- **Auto-expand on scroll:** When IntersectionObserver activates a heading inside a collapsed section, `updateActiveTOC()` walks up ancestor `<details>` elements and opens them

#### Performance & Accessibility

- **Animation:** Uses GPU-accelerated `transform` for smooth, jank-free slide transition
- **No layout shifts:** Overlay pattern means zero reflows during open/close
- **Keyboard-friendly:** Escape key closes sidebar; Enter/Space on `<summary>` toggles sections; semantic HTML enables screen reader navigation
- **Theme-aware:** All CSS uses `var(--vscode-*)` variables; `resolveTheme()` auto-detects light/dark for highlight.js and Mermaid themes; `onDidChangeActiveColorTheme` re-renders on theme switch

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
