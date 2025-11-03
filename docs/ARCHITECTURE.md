# Architecture

This document describes the design decisions and architectural patterns used in the Lightweight Markdown Preview extension.

## Overview

The extension provides a lightweight, secure markdown preview directly within VS Code. It prioritizes simplicity, security, and performance over feature breadth. The entire implementation is contained in a single extension file (~370 lines) with no external dependencies beyond the `marked` markdown parser.

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

## Guidelines for Future Changes

To maintain the extension's stability and security, follow these guidelines.

### Safe to Modify

The following areas are generally safe for modification and extension:
- **Styling:** Adjusting CSS for elements like the body, code blocks, and tables
- **Markdown Options:** Passing new configuration options to the `marked()` parser
- **VS Code Settings:** Adding new user-configurable settings in `package.json`
- **New Commands:** Adding new commands in `package.json` and implementing them in `extension.js`

### Requires Security Review

Changes to the following areas are high-risk and **must undergo a security review**. They form the core of the extension's security and stability:
- **Content Security Policy (CSP):** Modifying the CSP header can instantly create security vulnerabilities
- **Nonce Generation:** The cryptographic token logic is critical for preventing XSS
- **Mermaid/Math Preprocessing:** The regex logic is delicate and handles untrusted input
- **State Management:** Altering the data flow could introduce bugs or race conditions
- **Script Execution:** Any addition of user script execution or dynamic eval operations
