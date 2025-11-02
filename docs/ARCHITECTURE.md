# Architecture & Design Philosophy

This document explains the design decisions and security model.

## Core Philosophy

**One job, done well:** Preview markdown. No themes, no plugins, no bloat.

**Constraints:**
- Minimal package size
- No large dependencies
- Simple enough for AI agent maintenance
- Secure by design

## Design Decisions

### Single Preview Panel (Not Per-Document)

**Decision:** One webview panel per window, not per markdown file.

**Why:**
- **Simpler state:** Only one `currentPanel` and `currentDocument` to manage
- **Lower memory:** No multiple renderer instances
- **VS Code standard:** Matches built-in preview behavior

**Tradeoff:** Can't preview two documents simultaneously. Acceptable for lightweight extension.

### Real-Time Preview (Without Saving)

**Decision:** Update preview on every keystroke, not on file save.

**Why:**
- Immediate feedback improves editing experience
- More useful than delayed updates
- Feasible with ~50ms render time

**Implementation:** `onDidChangeTextDocument` listener triggers `updateWebviewContent()`.

### Mermaid Block Extraction (Pre-Parsing)

**Problem:** `marked` library escapes angle brackets in mermaid syntax:
```
```mermaid
graph LR
    A-->B
```
```
becomes escaped HTML entities, breaking Mermaid rendering.

**Solution:** Extract mermaid blocks before parsing, store in array, parse markdown, then reinject blocks with Mermaid script.

**Why this approach:**
- Preserves mermaid syntax perfectly
- Allows marked to handle everything else correctly
- Simple to implement (~10 lines regex)

## Dependency Strategy

### Why CDN for Mermaid & MathJax?

| Aspect | Mermaid | MathJax | Marked |
|--------|---------|---------|--------|
| **Size** | 100KB+ | 150KB+ | ~20KB |
| **Changes** | Frequently | Frequently | Stable |
| **Used** | Preview only (webview) | Preview only (webview) | Parse time (build) |
| **Update** | User gets latest | User gets latest | Locked to version |

**Decision:** CDN for large rendering libs, NPM for small parsers.

**Result:** ~19 KB package instead of 250KB+

**User experience:**
- First mermaid load: wait for CDN (1-2 sec, cached thereafter)
- Offline users: diagrams won't render (acceptable limitation)
- Package downloads faster: especially important on slow connections

### Cost-Benefit

| Approach | Pro | Con |
|----------|-----|-----|
| **Bundle all (NPM)** | Works offline | 250KB+ package, users pay 10x download cost |
| **CDN for large libs** | 19KB package, always latest libs | Needs internet for diagrams |
| **CDN for everything** | Smallest package | No control over versions, CDN risk |

**We chose:** CDN for large, frequently-updated libs.

## Security Model

### Threat Model

**Assumption:** Users open arbitrary markdown files (potentially malicious).

**Attack vectors:**
1. XSS via embedded `<script>` tags
2. Injection attacks via HTML manipulation
3. Abuse of Mermaid/MathJax rendering
4. Exploiting VS Code webview vulnerabilities

### Defense Strategy

#### Layer 1: Content Security Policy (CSP)

CSP meta tag restricts what can execute:

```html
<meta http-equiv="Content-Security-Policy"
      content="script-src 'nonce-${nonce}';">
```

**Effect:** Only scripts with matching nonce can execute.

**Implementation:**
- Generate random nonce per render: `crypto.randomUUID()`
- Include in CSP header
- Include in every `<script nonce="${nonce}">`
- Regenerate on every update (different each time)

**Result:** Malicious scripts in markdown cannot execute.

#### Layer 2: Safe HTML Parsing

**marked** parser converts markdown to HTML without executing code:
```
Input:  `<script>alert('xss')</script>`
Output: `&lt;script&gt;alert('xss')&lt;/script&gt;` (escaped)
Rendered: Shows as text, not executed
```

**Our code:** Never uses `innerHTML` or `eval()`. All content goes through marked's safe parser.

#### Layer 3: Trusted External Scripts

Mermaid and MathJax are loaded from CDN, not user input:
```html
<script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/mermaid"></script>
```

- CDN is signed/verified
- Not user-controlled
- Can be updated independently

#### Layer 4: VS Code Webview Sandbox

VS Code webviews run in a restricted context:
- No file system access
- No process spawning
- Limited network (CSP enforced)
- No access to extension's file system

### Security Properties

| Threat | Defense |
|--------|---------|
| Script execution | CSP + nonce requirement |
| XSS injection | Marked escapes HTML entities |
| DOM manipulation | No `innerHTML`, no `eval()` |
| Mermaid XSS | CDN only, user markdown can't inject scripts |
| File system access | VS Code webview sandbox |

**Verification:** Test in DevTools - scripts without nonce are blocked (CSP violation).

## State Management

**Approach:** Closure-based, no external storage.

```
Extension loads
    ↓
User runs "Show Preview" command
    ↓
createWebviewPanel()
    ↓
currentPanel = reference to webview
currentDocument = active editor document
    ↓
Register onDidChangeTextDocument listener
    ↓
Document changes → listener → updateWebviewContent()
    ↓
Regenerate nonce
    ↓
Parse markdown → extract mermaid blocks → insert blocks with Mermaid script
    ↓
Generate HTML → Send to webview → Render
    ↓
User closes panel → Unregister listener → currentPanel = null
```

**Key variables:**
- `currentPanel` - Active webview panel (or null)
- `currentDocument` - Document being previewed
- `nonce` - Unique CSP token (regenerated every render)

**No persistence:** All state is in-memory. Lost on extension reload.

## Performance Characteristics

### Baseline Performance

- **Typical render time:** ~50ms for standard markdown files
- **Bottlenecks:**
  - Large files (>10K lines): marked parsing is O(n)
  - Complex Mermaid diagrams: client-side rendering latency
  - CDN latency: first mermaid/MathJax load (cached thereafter)

### Acceptable Limits

- **Current:** Comfortable up to ~5K lines
- **Stretches to:** ~10K lines with noticeable lag
- **Breaks:** >20K lines (render > 500ms)

### Future Optimization (if needed)

1. **Debounce rapid typing:** Don't re-render on every keystroke
2. **Mermaid caching:** Cache parsed diagrams
3. **Lazy rendering:** Render only visible portions
4. **Web Workers:** Offload parsing to separate thread

Currently, performance is acceptable for typical use cases (< 10K lines).

## What Can Be Extended Safely

**Safe to modify:**
- CSS styling (body, code blocks, tables)
- Markdown rendering options (pass options to `marked()`)
- VS Code configuration settings (add new settings in package.json)
- New commands (add to package.json, implement in extension.js)

## What Should NOT Be Modified

**Do NOT change without security review:**
- CSP headers (security boundary)
- Nonce generation (cryptographic token)
- State management (data flow)
- Mermaid preprocessing (delicate syntax handling)

**Why:** These are the security and stability foundations. Changes here could:
- Break security defenses
- Introduce vulnerabilities
- Cause rendering failures
- Create maintenance burden

## Design Constraints (Intentional)

**This extension deliberately does NOT:**
- Support custom themes
- Support plugins/extensions
- Support collaborative editing
- Store user data
- Support offline rendering of diagrams
- Support rendering to multiple documents

**Why:** Each addition increases complexity, security surface, and maintenance burden. A small, focused tool is better than a bloated multi-purpose tool.
