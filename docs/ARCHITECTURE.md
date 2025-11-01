# Architecture & Design Decisions

Reference document explaining WHY the extension is designed this way.

## Design Decisions

### Single Webview Panel

**Decision:** One preview panel per window, not per document.

**Why:** Simpler state management, lower memory footprint, matches VS Code's built-in preview behavior.

**Tradeoff:** Can't preview two documents simultaneously (acceptable for a lightweight extension).

### Markdown → HTML → Webview Flow

**Process:** User types → `onDidChangeTextDocument` → `updateWebviewContent()` → Render HTML → Display

**Why:** Provides real-time feedback without requiring file save.

### Mermaid Preprocessing

**Problem:** `marked` library escapes mermaid syntax, breaking diagrams.

**Solution:** Extract mermaid blocks before markdown parsing, store separately, reparse markdown, then reinsert diagrams with Mermaid script.

**Implementation:** Regex finds ` ```mermaid...``` `, stores in array, parses markdown, reinserts blocks with Mermaid script tags.

### CDN for Mermaid, NPM for Markdown

**Mermaid (CDN):**
- 100KB+ uncompressed
- Changes frequently
- Only needed in preview (not at build time)

**Marked (NPM):**
- 20KB, stable
- Used at parse time
- Must be bundled

**Result:** Keeps packaged extension to 16.9 KB.

### Content Security Policy (CSP) with Nonces

**Problem:** Webviews execute arbitrary content from user's markdown files. Risk of injection attacks.

**Solution:** CSP header restricts script execution. Nonces allow only specifically-trusted inline scripts.

**Implementation:**
- Generate random nonce per render
- Include in CSP meta tag: `<meta http-equiv="Content-Security-Policy" content="script-src 'nonce-${nonce}';">`
- Include in all inline scripts: `<script nonce="${nonce}">`
- Regenerate nonce on every update (different each time)

**Security Model:** User's markdown content is rendered as HTML but cannot execute code.

## State Management

```
Extension loads
    ↓
User clicks preview icon or runs command
    ↓
createWebviewPanel() → currentPanel = panel
currentDocument = active editor's document
    ↓
Register onDidChangeTextDocument listener
    ↓
Document changes → updateWebviewContent() → re-render HTML
    ↓
User switches document → updateWebviewContent() updates preview
    ↓
User closes panel → cleanup listener, currentPanel = null
```

**Key Variables:**
- `currentPanel` - Active webview panel or null
- `currentDocument` - Document being previewed
- `nonce` - CSP security token (changes each render)

**No external state:** Everything stored in closure variables.

## Performance Characteristics

- **Render time:** ~50ms for typical markdown files
- **Bottlenecks:**
  - Large files (>10,000 lines) may lag due to marked parsing
  - Mermaid rendering for complex diagrams
  - CDN latency on first mermaid load

- **Optimization opportunities (if needed):**
  1. Debounce `onDidChangeTextDocument` listener
  2. Implement mermaid caching
  3. Profile with DevTools

Currently, performance is acceptable for typical use cases.

## Security Threat Model

**Threat:** Malicious markdown file with embedded scripts or XSS attempts

**Defenses:**

1. **Script Sandboxing:** Webview runs in restricted VS Code context
2. **CSP:** Only allow:
   - Output from `marked` parser (plain HTML)
   - Mermaid CDN script (trusted source)
   - Nonce-verified inline scripts (our own only)
3. **No DOM manipulation:** Never use `innerHTML` or `eval()`
4. **Input handling:** User's markdown is parsed, not executed

**If adding new scripts:**
- Must include nonce: `<script nonce="${nonce}">`
- Test CSP violations in DevTools (they should fail)
- Never evaluate user input

## Files & Organization

| File | Purpose |
|------|---------|
| `src/extension.js` | Core extension logic (222 lines) |
| `package.json` | VS Code manifest & metadata |
| `README.md` | User guide |
| `DEVELOPMENT.md` | For developers/agents working on code |
| `docs/ARCHITECTURE.md` | This file (design decisions) |
| `docs/CHANGELOG.md` | Version history |
| `examples/test.md` | Comprehensive test file |
| `.github/workflows/ci.yml` | CI/CD pipeline |
| `assets/` | Icons and visual assets |
| `.vscodeignore` | Packaging exclusions |

## Extension Points

**What CAN be extended safely:**
- CSS styling (modify body, code, table CSS)
- Markdown rendering options (pass options to `marked()`)
- VS Code configuration settings
- Commands

**What should NOT be extended:**
- Core state management (currentPanel/currentDocument)
- CSP headers (without security review)
- Mermaid preprocessing logic
- Nonce generation

This is intentional: the extension does one thing well. Don't add features.

---

**Last Updated:** November 1, 2025 (v0.2.0)
