# Architecture

## Design Decisions

### Single Webview Panel

**Decision:** One preview panel per window, not per document.

**Why:** Simpler state management, lower memory footprint, consistent behavior with VS Code's built-in preview.

**Tradeoff:** Can't preview two documents simultaneously.

### Markdown → HTML → Webview

**Flow:** User types → `onDidChangeTextDocument` → `updateWebviewContent()` → Render HTML → Display

**Why:** Real-time preview feedback. No file save required.

### Mermaid Pre-processing

**Approach:** Extract mermaid blocks before markdown parsing.

**Why:** `marked` would escape mermaid syntax, breaking diagrams. Pre-extraction preserves syntax.

**Pattern:** Regex finds ` ```mermaid...``` `, stores separately, parses markdown, reinserts with Mermaid script.

### CDN for Mermaid, NPM for Markdown

**Why:** Mermaid is large (100KB+), changes frequently, only needed in previews. `marked` is small, stable, used at parse time.

**Benefit:** Keep package size minimal (~180KB with marked), avoid build complexity.

### Content Security Policy (CSP) with Nonces

**How:** CSP header restricts script execution. Nonces allow only trusted inline scripts.

**Why:** Webviews can execute arbitrary content. Nonce prevents injection attacks.

**Implementation:** Generate random nonce per render, include in CSP header and script tags.

## State Management

```
Extension Activation
    ↓
commands.registerCommand() registers "markdown.preview" command
    ↓
User clicks preview icon
    ↓
currentPanel = createWebviewPanel()
currentDocument = activeTextEditor.document
    ↓
onDidChangeTextDocument listener
    ↓
updateWebviewContent() if document matches currentDocument
    ↓
Panel disposed → cleanup listeners
```

**Key Variables:**

- `currentPanel`: Active webview or null
- `currentDocument`: Document being previewed
- `nonce`: CSP security token (changes each render)

**No external state:** Everything stored in closure variables.

## Guardrails

### Do's ✅

- Keep dependencies minimal (only essential)
- Test with `npm run lint` before committing
- Update README.md for user-facing changes
- Include JSDoc comments explaining WHY
- Use CSP nonces for all inline scripts
- Test mermaid diagrams at mermaid.live
- Update CHANGELOG.md for each release
- Use semantic versioning (major.minor.patch)

### Don'ts ❌

- Add large dependencies without justification
- Modify CSP headers without security review
- Change state management carelessly
- Skip testing before committing
- Store user data without explicit consent
- Commit .vsix files to git
- Change nonce generation logic without review

## Security Model

**Threat Model:** Untrusted markdown content in VS Code

**Mitigations:**

1. **Script Sandboxing:** Webview runs in restricted context
2. **CSP:** Only allow marked output + Mermaid CDN + nonce scripts
3. **No Access to:** User files, extension data, VS Code API (blocked by default)
4. **Input:** No user input exposed to HTML (only rendered markdown)

**If adding new scripts:**

- Include nonce: `<script nonce="${nonce}">`
- Never use `eval()` or `innerHTML` with user content
- Test CSP violations in DevTools

## Performance

**Current:** Real-time updates with ~50ms render time

**Bottlenecks:**

- Large files (>10,000 lines) may lag
- Mermaid rendering for complex diagrams
- CDN latency on first load

**If optimization needed:**

1. Debounce `onDidChangeTextDocument` listener
2. Implement render cache
3. Profile with DevTools (F12 in Extension Dev Host)

## Extension Points

**What can be extended:**

- CSS styling (modify body, code, table CSS in `getWebviewContent()`)
- Markdown rendering options (pass options to `marked()`)
- Configuration settings (add to `package.json` contribution points)
- Commands (register new commands in `activate()`)

**What should NOT be extended:**

- Core state management (currentPanel/currentDocument)
- CSP headers (without security review)
- Mermaid preprocessing logic
- Nonce generation

## Files

| File | Lines | Purpose |
|------|-------|---------|
| extension.js | 222 | Core logic |
| package.json | 30 | Metadata, dependencies |
| README.md | 60 | User guide |
| ARCHITECTURE.md | 150 | Design decisions |
| AGENTS.md | 250 | Development guide |
| .github/workflows/release.yml | 40 | CI/CD pipeline |

## Distribution Model

- **Method:** GitHub Releases with .vsix files
- **Trigger:** Git tag `v*.*.*` (e.g., v0.0.2)
- **Build:** GitHub Actions runs `npm run package`
- **Result:** .vsix file attached to release
- **Install:** User downloads .vsix and installs in VS Code

---

**Last Updated:** October 24, 2025
