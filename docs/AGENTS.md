# Guide for AI Agents

Quick guide for extending and maintaining this codebase.

## Quick Context

- **Project:** VS Code markdown preview with Mermaid support
- **Main file:** `src/extension.js` (222 lines)
- **Tech:** VS Code API, marked (v9.0.0), Mermaid v11 (CDN)
- **Package size:** ~17.4KB optimized (node_modules, dev files excluded per .vscodeignore)

## Start Here

1. Read ARCHITECTURE.md (design decisions)
2. Read README.md (user-facing features)
3. Review extension.js (implementation)

## Making Changes

### Add a Feature

1. Understand the flow in extension.js
2. Make code changes
3. Test: `npm run lint` then `F5` in VS Code
4. Update README.md if user-facing
5. Update CHANGELOG.md with entry
6. Commit with clear message

### Fix a Bug

1. Locate issue in extension.js
2. Debug: Open Extension Development Host (F5), check Output panel
3. Fix with minimal changes
4. Test thoroughly
5. Update CHANGELOG.md
6. Commit with reference to issue

### Add a Dependency

⚠️ **Keep minimal.** Current: `marked` only.

Before adding:

- Is it necessary?
- Can we use CDN instead (like Mermaid)?
- What's the size impact?

If needed: `npm install package --save` then `npm run package`

## Code Organization

```
src/extension.js:
- activate(context)         - Entry point, registers commands
- updateWebviewContent()    - Renders markdown + processes mermaid
- getWebviewContent()       - Generates HTML/CSS/JS
- getNonce()                - Generates CSP nonce
- deactivate()              - Cleanup (handles panel disposal)
```

## Testing

```bash
# Development mode
npm install
code .           # Open in VS Code
# Press F5 in VS Code to launch Extension Development Host

# Linting
npm run lint

# Manual testing
- [ ] Open markdown file
- [ ] Click preview icon
- [ ] Preview updates as you type
- [ ] Mermaid diagrams render
- [ ] Test with example.md
```

## Common Tasks

### Change CSS Styling

Find `body { ... }` in getWebviewContent() and modify

### Change Markdown Rendering

Modify the `marked()` call in updateWebviewContent()

### Add Configuration Setting

Add to package.json in `contributes.configuration`:

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

### Debug

In Extension Development Host:

- Press `Ctrl+Shift+J` for DevTools
- Go to Output tab
- Select "Lightweight Markdown Preview"
- Look for errors

## Release Checklist

See [RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md) for complete pre-publication verification and release procedures.

Quick summary:
1. **Update version** in package.json (semantic versioning: major.minor.patch)
2. **Update CHANGELOG.md** with changes
3. **Test locally:** `npm run lint` and `npm run package`
4. **Commit and tag:** `git add . && git commit -m "Release v0.x.x" && git tag v0.x.x`
5. **Push:** `git push origin main --tags`
6. **Verify build** passes CI checks at https://github.com/kanad13/lightweight-markdown-preview

## Files

| File                 | Purpose                      | Edit Frequency |
| -------------------- | ---------------------------- | -------------- |
| src/extension.js     | Main code                    | Often          |
| package.json         | Metadata, dependencies       | Rarely         |
| README.md            | User docs                    | Sometimes      |
| docs/ARCHITECTURE.md | Design decisions             | Sometimes      |
| docs/CHANGELOG.md    | Release history              | Every release  |
| docs/AGENTS.md       | Development guide            | Sometimes      |
| examples/example.md  | Example markdown file        | Sometimes      |
| examples/test.md     | Test file with all features  | Sometimes      |
| .vscodeignore        | Packaging exclusions         | Rarely         |
| .github/workflows/   | CI/CD pipeline               | Rarely         |

## Standards

**Code Style:**

- Use semicolons, `const`/`let`, explain WHY not WHAT
- Max ~100 char lines

**JSDoc:**

```javascript
/**
 * Description
 * @param {type} name - Description
 * @returns {type} Description
 */
```

**Variables:**

- `currentPanel` - active webview
- `currentDocument` - document being previewed
- `nonce` - CSP security token

**Do's:**

- ✅ Keep dependencies minimal
- ✅ Test before committing
- ✅ Update docs when changing behavior
- ✅ Use meaningful commit messages

**Don'ts:**

- ❌ Modify state management carelessly
- ❌ Add large dependencies without justification
- ❌ Change CSP without security review
- ❌ Skip testing
- ❌ Commit .vsix files

## Resources

- VS Code API: https://code.visualstudio.com/api
- Marked: https://marked.js.org/
- Mermaid: https://mermaid.js.org/
- CSP: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP

---

**Last Updated:** November 1, 2025 (v0.2.0)
**For:** AI Agents & Contributors
