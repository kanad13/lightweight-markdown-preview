# Architecture

This document describes the design decisions and architectural patterns used in the Lightweight Markdown Preview extension.

## Overview

The extension provides a lightweight, secure markdown preview directly within VS Code. It prioritizes simplicity, security, and performance over feature breadth. It draws Mermaid and math in the page, and D2 as images from a renderer that the user chooses. The implementation consists of `src/extension.js` (logic) and `src/webview.html` (template, inlined at build time by webpack). The only bundled dependency is the `marked` markdown parser. Mermaid, MathJax, and highlight.js load in the webview from jsDelivr at exact, pinned versions; [dependencies.md](dependencies.md) explains how those versions are chosen.

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
and loads D2 diagrams as images from the configured renderer
```

**Design principle:** One active webview panel per extension session. The panel follows the active Markdown editor: when another Markdown file becomes the active editor, the panel renders that file. This minimizes resource consumption and simplifies state management.

## Security Model

The security model assumes that any Markdown file could be malicious. The extension layers its defenses, mainly against Cross-Site Scripting (XSS).

### Layer 1: Content Security Policy (CSP) with Nonces

The extension enforces a strict CSP. A script runs only if it carries the unique, random `nonce` of the current render, or if a script that carries the nonce loads it.

- **How it works:**
  - The extension generates a new nonce for every preview render.
  - The nonce appears in the CSP `meta` tag and in every legitimate `<script>` tag.
  - `script-src` is `'nonce-…' 'strict-dynamic'`. With `'strict-dynamic'` the browser ignores host allowlists for scripts, so MathJax and Mermaid still load from jsDelivr because a nonce-carrying script loads them, while a `<script src>` written in a document does not run.
  - `base-uri 'none'` and `form-action 'none'` close two gaps that `default-src` does not cover. A `<base>` tag cannot redirect relative links, and the browser refuses a `<form>` submit.
  - `default-src 'none'` also closes frames, objects, workers and `connect-src`. `img-src` allows `https:` so that remote images load, and `style-src` allows inline styles and jsDelivr for the highlight.js theme.
- **Effect:**
  - An inline `<script>`, an inline event handler and a `javascript:` link are blocked, and so is a script tag that points at jsDelivr or any other host.
- **Limits:**
  - A document can still make the preview request an image, a stylesheet or a font from any `https:` host, because remote images are a feature. That request exposes the reader's IP address to the host. The page sends no `Referer` (`<meta name="referrer" content="no-referrer">`), so the host does not learn the page address either.
  - Mermaid, MathJax and highlight.js load from jsDelivr at pinned versions, so a machine without network access shows their source text instead of the drawing. [decisions.md](decisions.md#declined) records why they are not bundled.
  - VS Code's webview does not enforce `form-action` (checked in a real window on 2026-10-28), so the page script also cancels every `submit` event.
  - Raw HTML that is not script, such as `<details>`, `<kbd>` and `<img width>`, passes through and works.
  - The page sends no messages to the extension host, and the CSP sets no `connect-src`. [decisions.md](decisions.md#script-policy-and-raw-html) says what to settle before that changes.

### Layer 2: Escaping of Generated Markup

Raw HTML in a document passes through `marked` unchanged, so the CSP in Layer 1 is the control that stops such markup from running scripts. The extension does not filter tags, because a filter misses forms such as an unclosed `<script src>`, and the CSP needs no list of tags to work. The extension escapes every fragment it builds itself.

- **Outline entries:**
  - `escapeHtml()` escapes heading text before it enters the sidebar markup.
- **Math and Mermaid source:**
  - The extension escapes formula and diagram source, so a diagram or formula cannot close its element or open a new tag.
  - The browser decodes the entities, so MathJax and Mermaid still read the original source.
- **Mermaid security level:**
  - Diagrams render with `securityLevel: 'strict'`.
  - That level disables click handlers and sanitizes HTML labels.

### Layer 2b: The D2 Renderer Address

D2 diagrams are `<img>` tags whose address points at a renderer that the user sets. The address is the one place where document text leaves the machine, so it has its own controls.

- **Who chooses the renderer:**
  - The setting `lightweightMarkdownViewer.d2.rendererUrl` has application scope, so only user settings can set it. A cloned repository cannot choose where diagrams go.
- **Validation:**
  - `parseRendererUrl()` accepts only `http:` and `https:` URLs without credentials, query string or fragment, and with a host made of letters, digits, `-`, `_` and `.`, or an IPv6 literal. The host rule keeps `;` and `,` out of the CSP.
  - An invalid value renders a warning box with the source and no image, and adds nothing to the CSP. An empty value renders ordinary code blocks.
- **CSP:**
  - The validated origin is appended to `img-src` through the `{{RENDERER_ORIGIN}}` placeholder. `http:` is never allowed as a whole scheme, and `connect-src` stays unset.
- **Why an image:**
  - An `<img>` cannot run the scripts inside an SVG, and it needs no message from the page to the extension host.
  - The cost is that the page cannot read a renderer's error message. [decisions.md](decisions.md#fetch-d2-diagrams-for-error-messages-and-post) records the fetch alternative.
- **Document text:**
  - The D2 source reaches the page only as the compressed address and, hidden until a failure, as escaped text.

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
   A change to any `lightweightMarkdownViewer.d2` setting redraws the open preview, because it changes every D2 address.
4. **Update Cycle:** When the document changes, the listener triggers an update:
   - A new CSP `nonce` is generated.
   - The markdown content is parsed and rendered into a full HTML document.
   - The webview's HTML is replaced with the new content.
5. **Disposal:** When the user closes the panel, any pending debounced update is cancelled and `currentPanel` and `currentDocument` are reset to `undefined`. The document-change, theme-change and configuration-change listeners stay registered for the life of the extension and do nothing while no panel is open.

## Content Processing Pipeline

1. **Lexing:** `marked.lexer()` turns the source into tokens. Three parser extensions teach it the syntax `marked` lacks, so it knows what is code and never reads math or a diagram inside a code span or fence.
   - Block math: `$$ ... $$`, on one line or several. The body may not contain a blank line.
   - Inline math: `$...$`, and `$$...$$` written inside a sentence. The opening `$` must touch the formula, the closing `$` must not follow a space or precede a digit, so "costs $5 and $10" stays text. This is Pandoc's rule.
   - Mermaid: GitHub-style (` ```mermaid `, also `~~~`) and Azure DevOps-style (`::: mermaid`). The second form becomes an ordinary `code` token with the language `mermaid`, so both render identically and both nest in lists and quotes.
   - D2 needs no extension: a `code` token whose language is `d2` (case-insensitive, with or without text after it) is handled in step 4.
2. **Headings:** `collectHeadings()` walks the tokens, builds each outline entry from the visible text, and gives it a GitHub-style ID (`intro`, `intro-1` for duplicates). The ID is written onto the token and the heading renderer reads it from there, so the outline and the page cannot disagree. Each entry also records `lineIndex`, the source line of its top-level block.
3. **Images:** When `renderMarkdown` receives `resolveImage`, it rewrites Markdown image addresses on the tokens, and the `src` of raw `<img>` tags inside HTML tokens. Code and prose are never touched.
4. **D2:** `renderMarkdown` turns each `d2` code token into a finished `html` token. `renderD2Block()` builds the address `<renderer>/d2/svg/<payload>?theme=..` where the payload is the source deflated at level 9 and encoded as URL-safe Base64 (`encodeD2Payload()`, Node's `zlib`). The source is sent as written, and the only option added is the theme, which follows the editor (light 0, dark and high contrast 200). An empty block, an invalid renderer URL, and an address over 8,000 characters each render a notice instead of an image. With no renderer URL set, the token is left as an ordinary code block and the first one gets a one-line hint, so a document renders as it did before D2 support.
5. **Rendering:** `marked.parser()` renders the tokens. Math is emitted as `\(...\)` and `\[...\]` and Mermaid as `<pre class="mermaid">`, with the source HTML-escaped. The page configures MathJax with only those delimiters, so a stray dollar sign in the text is never paired.
6. **Path Resolution:** `resolveImagePath()` decodes percent escapes (`%20`), then converts the address to a webview-accessible URI, handling:
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
- **Debounced:** 300ms debounce on `onDidChangeTextDocument` batches rapid edits. A document with a D2 fence waits 800ms once a renderer is set, so the renderer is not asked after every keystroke
- **D2 requests:** A full page replacement reloads every image. An unchanged block keeps its address, so the browser reuses the picture when the renderer sends cache headers. The d2-renderer image does (`immutable`). In real VS Code, editing one D2 block produced one request and editing prose produced none
- **Why:** Ensures consistency and simplicity. Rendering on the host is fast enough that the cost is not worth an incremental design
- **Cost:** Measured on 2026-10-26 under Node: about 0.1 ms for `examples/test.md` and about 15 ms for a 79 KB document. Host rendering is not the bottleneck. The visible delay comes from the webview reloading and from Mermaid and MathJax typesetting, which are not included in these numbers

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
- **Theme-aware:** All CSS uses `var(--vscode-*)` variables; `resolveTheme()` auto-detects light/dark for highlight.js, Mermaid and D2 themes; `onDidChangeActiveColorTheme` re-renders on theme switch

## Guidelines for Future Changes

To maintain the extension's stability and security, follow these guidelines.

### Safe to Modify

The following areas are generally safe for modification and extension:

- **Styling:** Adjusting CSS for elements like the body, code blocks, and tables
- **Markdown Options:** Passing new configuration options to the `marked()` parser
- **VS Code Settings:** Adding new user-configurable settings in `package.json`. Keep the surface small: the only setting is `d2.rendererUrl`, and a setting that decides where data goes needs application scope. D2 style options belong in the diagram's `d2-config`
- **New Commands:** Adding new commands in `package.json` and implementing them in `extension.js`
- **Sidebar Styling:** Adjusting colors, spacing, or hover effects in `.toc-sidebar` or `.toc-link` classes

### Requires Security Review

Changes to the following areas are high-risk and **must undergo a security review**. They form the core of the extension's security and stability:

- **Content Security Policy (CSP):** Modifying the CSP header can instantly create security vulnerabilities
- **The D2 renderer URL:** `parseRendererUrl()`, the `{{RENDERER_ORIGIN}}` placeholder and the setting's scope decide where diagram text goes
- **Nonce Generation:** The cryptographic token logic is critical for preventing XSS
- **Math, Mermaid, D2, heading and image handling:** The parser extensions and token passes in `renderMarkdown()` handle untrusted input
- **State Management:** Altering the data flow could introduce bugs or race conditions
- **Script Execution:** Any addition of user script execution or dynamic eval operations
