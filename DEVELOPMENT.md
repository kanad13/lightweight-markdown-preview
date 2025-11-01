# Development Guide

For AI agents and developers maintaining this extension.

## Codebase Overview

- **Main code:** `src/extension.js` (~260 lines)
- **Tech:** VS Code API, marked (v9.0.0), Mermaid v11 (CDN), MathJax v3 (CDN)
- **Package size:** ~19 KB
- **Dependencies:** marked only

## Code Structure

```
src/extension.js:
├── activate(context)         - Entry point, registers commands
├── showPreview()             - Creates/shows preview panel
├── updateWebviewContent()    - Renders markdown + processes mermaid
├── getWebviewContent()       - Generates HTML/CSS/JS for webview
├── getNonce()                - Generates CSP nonce
└── deactivate()              - Cleanup on extension deactivate
```

## Making Changes

### Add a Feature

1. Make code changes in `src/extension.js`
2. Test: `npm run lint` then press F5 in VS Code
3. If user-facing: update README.md and examples/test.md
4. Update docs/CHANGELOG.md
5. Commit with clear message

### Fix a Bug

1. Locate issue in `src/extension.js`
2. Debug: Press F5, check Output panel ("Lightweight Markdown Preview")
3. Fix with minimal changes
4. Test thoroughly with `npm run lint`
5. Update docs/CHANGELOG.md
6. Commit with reference to issue

### Add a Dependency

⚠️ **Keep dependencies minimal.** Only `marked` is used (Mermaid is CDN-based).

Before adding a dependency:
- Is it absolutely necessary?
- What's the size impact?
- Can we use a CDN instead?

If justified: `npm install package --save` then `npm run package`

## Testing

### Manual Testing

```bash
npm install
npm run lint           # must pass with zero errors
npm run package        # must create .vsix file
```

Then test in VS Code:
1. Press F5 to launch Extension Development Host
2. Open `examples/test.md`
3. Run: `Markdown: Show Lightweight Markdown Preview`
4. Verify:
   - All text formatting renders correctly
   - Tables render properly
   - Code blocks show syntax highlighting
   - Images display
   - Mermaid diagram renders as flowchart
   - MathJax equations render (inline and display math)
   - Live preview updates as you type

### CI/CD

GitHub Actions runs automatically on push/PR:
- Install dependencies
- Run linter
- Package extension
- Verify .vsix created

Check results at: https://github.com/kanad13/lightweight-markdown-preview/actions

## Common Tasks

### Change CSS Styling

Edit `body { ... }` section in `getWebviewContent()` function.

### Change Markdown Rendering Options

Modify the `marked()` call in `updateWebviewContent()`.

### Add VS Code Settings

Add to `package.json` in `contributes.configuration`:

```json
"configuration": {
  "properties": {
    "lightweightMarkdownPreview.setting": {
      "type": "string",
      "default": "value"
    }
  }
}
```

Read in extension.js: `vscode.workspace.getConfiguration('lightweightMarkdownPreview').get('setting')`

### Debug in Extension Development Host

1. Press F5 to launch extension
2. Press Ctrl+Shift+J for DevTools
3. Go to Output tab
4. Select "Lightweight Markdown Preview"
5. Look for errors

## Building & Releasing

### Pre-Release Checklist

1. **Code ready:**
   - `npm run lint` passes
   - All changes committed
   - `git status` is clean

2. **Update version:**
   - Edit `package.json`: increment version (semantic versioning: major.minor.patch)
   - Edit `docs/CHANGELOG.md`: add entry for version

3. **Test build:**
   ```bash
   npm run package
   ```
   Must create .vsix file with no errors.

4. **Commit:**
   ```bash
   git add .
   git commit -m "Release v0.x.x: [description]"
   ```

### Release to GitHub

```bash
git tag v0.x.x
git push origin main
git push origin --tags
```

This triggers:
- CI/CD linting and packaging
- GitHub Actions completes successfully
- .vsix available at: https://github.com/kanad13/lightweight-markdown-preview/releases

### Publish to Marketplace

```bash
vsce login kanad13    # one-time setup, credentials already configured
vsce publish
```

Wait for marketplace processing (usually < 1 hour).
Verify at: https://marketplace.visualstudio.com/items?itemName=kanad13.lightweight-markdown-preview

## Critical Guardrails

### DO ✅

- Keep dependencies minimal (only essential)
- Test with `npm run lint` before committing
- Update README.md for user-facing changes
- Include JSDoc comments explaining WHY
- Use CSP nonces for all inline scripts
- Update CHANGELOG.md for each release
- Use semantic versioning

### DO NOT ❌

- Add large dependencies without justification
- Modify CSP headers without security review
- Change state management carelessly
- Skip linting before commit
- Store user data without explicit consent
- Commit .vsix files to git
- Commit node_modules

## Design Decisions

**Why CDN for Mermaid and MathJax, NPM for Markdown?**
- Mermaid is 100KB+, changes frequently, only used in webview
- MathJax is 150KB+, changes frequently, only used in webview
- `marked` is small and stable, used at parse time
- Keeps package tiny (~19 KB)

**Why one preview panel per window?**
- Simpler state management
- Lower memory footprint
- Consistent with VS Code's built-in preview

**Why CSP with nonces?**
- Webviews execute arbitrary content (user's markdown)
- Nonces prevent injection attacks
- Regenerate on each render for security

**Why extract Mermaid blocks pre-parsing?**
- `marked` would escape mermaid syntax
- Pre-extraction preserves diagram syntax
- Reinsert after markdown parsing

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full security model.

## File Structure

```
lightweight-markdown-preview/
├── src/extension.js              # Main code (~260 lines)
├── assets/                       # Icons
├── examples/                     # Test files
├── docs/                         # Documentation
├── package.json                  # Manifest & metadata
├── README.md                      # User guide
└── DEVELOPMENT.md                # This file
```

## Useful Links

- VS Code API: https://code.visualstudio.com/api
- Extension Publishing: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- Marked: https://marked.js.org/
- Mermaid: https://mermaid.js.org/
- CSP: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP

## Quick Reference

```bash
# Development
npm install                  # Install dependencies
npm run lint                 # Check code quality
npm run package             # Build .vsix
npm run publish             # Publish to marketplace (requires login)

# Release workflow
git add .
git commit -m "Release vX.X.X: [description]"
git tag vX.X.X
git push origin main --tags
vsce publish
```

---

**Last Updated:** November 1, 2025 (v0.2.0)
**Maintained by:** AI agents
