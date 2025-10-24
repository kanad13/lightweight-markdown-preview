# Guide for AI Agents

This document is written specifically for AI agents (LLMs, code assistants) working on this codebase. It provides the context and instructions needed to extend, maintain, and modify the extension effectively.

## Quick Context

**Project:** Lightweight Markdown Viewer - A VS Code extension for real-time markdown preview with Mermaid diagram support.

**Tech Stack:**
- VS Code API (JavaScript)
- Marked (markdown parser)
- Mermaid v11 (diagram rendering)

**Key File:** `extension.js` (222 lines) - contains all logic

**Size:** ~180KB packaged (includes node_modules)

## Before You Start

1. **Read ARCHITECTURE.md** - Explains all design decisions
2. **Read README.md** - Explains what the extension does
3. **Look at package.json** - Understand dependencies
4. **Review extension.js** - Main code (well-commented)

## How to Make Changes

### Adding a New Feature

**Example: Add inline code rendering customization**

1. **Understand Current Flow:**
   - Look at `getWebviewContent()` function
   - Find where CSS is defined for `code` elements
   - Understand where to add new styling

2. **Make Your Changes:**
   - Modify the CSS in `getWebviewContent()`
   - Or add new preprocessing in `updateWebviewContent()`
   - Test locally: `npm run lint` then `F5` in VS Code

3. **Update Documentation:**
   - Add to README.md under "Features"
   - Update ARCHITECTURE.md if design changed
   - Add comments to extension.js if logic is complex

4. **Test Thoroughly:**
   - Test with various markdown files
   - Test with mermaid diagrams
   - Test with edge cases

5. **Commit with Clear Message:**
   ```
   feat: Add inline code rendering customization
   
   - Modified CSS for code elements in getWebviewContent()
   - Tested with various markdown files
   - See ARCHITECTURE.md for styling extension points
   ```

### Fixing a Bug

**Example: Mermaid diagrams not rendering in some cases**

1. **Locate the Issue:**
   - Check `updateWebviewContent()` - handles mermaid extraction
   - Check `getWebviewContent()` - handles rendering setup
   - Check the regex pattern for mermaid blocks in the code

2. **Debug:**
   - Add error logging: `console.error()` for visibility
   - Test with the included `test.md`
   - Use VS Code's debug console (F5 to open Extension Development Host)

3. **Fix and Test:**
   - Make minimal change
   - Verify fix doesn't break other features
   - Run `npm run lint` to check code quality

4. **Document the Fix:**
   - If it's a known limitation, update ARCHITECTURE.md
   - Add inline comments explaining the fix
   - Commit with reference to the issue

### Extending with New Dependencies

⚠️ **Important:** Keep dependencies minimal!

**Current approach:**
- `marked` for markdown (required)
- Everything else loads from CDN or is built-in

**Before adding a dependency:**
1. Check if it's absolutely necessary
2. Consider CDN alternative (like we do with Mermaid)
3. Estimate size impact
4. Document in package.json WHY it's needed

**If you must add:**
```bash
npm install your-package --save
npm run package  # rebuild
```

Update ARCHITECTURE.md with dependency rationale.

## Code Organization

### extension.js Structure

```javascript
// Imports
const vscode = require("vscode");
const { marked } = require("marked");

// Main activation function
function activate(context) {
  // Command registration
  // Event listeners
  // State management
}

// Helper: Update preview content
function updateWebviewContent(panel, document) {
  // Pre-process mermaid blocks
  // Render markdown
  // Generate HTML
}

// Helper: Generate HTML template
function getWebviewContent(markdownHtml, nonce) {
  // Return complete HTML with CSS and scripts
}

// Helper: Generate nonce for CSP
function getNonce() {
  // Generate random string
}

// Deactivation
function deactivate() {}

module.exports = { activate, deactivate };
```

### Key Functions to Understand

| Function | Purpose | Modifiable? |
|----------|---------|------------|
| `activate()` | Called when extension loads. Registers commands and listeners | Yes, but carefully |
| `updateWebviewContent()` | Core logic: processes markdown and updates preview | Yes, good place to extend |
| `getWebviewContent()` | Generates the HTML + CSS + JavaScript for preview | Yes, for styling changes |
| `getNonce()` | Security: generates random string for CSP | No, working as intended |

## Testing Locally

### Development Mode

```bash
cd /Users/kanad/Data/repo/personal/vscode-markdown-preview

# Install dependencies
npm install

# Open in VS Code
code .

# Press F5 to open Extension Development Host
# (new VS Code window with extension loaded)
```

In the Extension Development Host:
- Open `test.md` to see example content
- Changes to code auto-reload
- Check "Output" panel for errors (select extension name from dropdown)

### Manual Testing Checklist

- [ ] Open any markdown file
- [ ] Click preview icon (eye icon in editor title)
- [ ] Verify preview panel opens on right
- [ ] Type in markdown - preview updates
- [ ] Check formatting: headings, bold, lists, tables
- [ ] Open `test.md` - verify Mermaid diagram renders
- [ ] Try edge cases: very long file, special characters, etc.

### Linting

```bash
npm run lint  # Check code quality
```

## Debugging Tips

### Check Errors in Extension

1. In Extension Development Host, press `Ctrl+Shift+J` to open DevTools
2. Go to "Output" tab
3. Select "Lightweight Markdown Viewer" from dropdown
4. Look for error messages

### Log Information

Add to extension.js:
```javascript
console.log("Debug message:", variable);
```

This appears in the Output panel.

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Command not found | Extension didn't activate | Open a markdown file to trigger activation |
| Preview blank | Rendering failed | Check Output tab for error message |
| Mermaid not rendering | Diagram syntax error | Test diagram at mermaid.live |
| Package won't install | Missing dependency | Run `npm install` |

## Making a Release

When ready to release:

```bash
# 1. Update version in package.json
# 2. Commit changes
git add .
git commit -m "Release v0.0.2"

# 3. Create tag (triggers GitHub Actions build)
git tag v0.0.2
git push origin main --tags

# GitHub Actions automatically builds and creates release
# Check: https://github.com/kanad13/vscode-markdown-preview/actions
```

**Important:** Tag format MUST be `v*.*.*` (e.g., v0.0.2, v1.2.3)

## File Guide

| File | Purpose | Edit Frequency |
|------|---------|-----------------|
| `extension.js` | Main extension code | Often |
| `package.json` | Metadata & dependencies | Rarely |
| `README.md` | User documentation | Sometimes |
| `ARCHITECTURE.md` | Design decisions (this repo) | Sometimes |
| `.vscodeignore` | Packaging config | Rarely |
| `.github/workflows/release.yml` | Build automation | Rarely |
| `test.md` | Example markdown for testing | Sometimes |

## Common Modifications

### Add a Configuration Setting

1. Add to package.json:
```json
"configuration": {
  "title": "Lightweight Markdown Viewer",
  "properties": {
    "lightweightMarkdownViewer.theme": {
      "type": "string",
      "default": "default",
      "description": "Preview theme"
    }
  }
}
```

2. Read in extension.js:
```javascript
const theme = vscode.workspace.getConfiguration('lightweightMarkdownViewer').get('theme');
```

3. Use in rendering logic

### Change CSS Styling

Find this in `getWebviewContent()`:
```javascript
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...;
  // Modify here
}
```

### Add New Markdown Feature

1. Check if `marked` supports it (most markdown does)
2. If not, preprocess in `updateWebviewContent()` like we do for Mermaid
3. Add test cases to `test.md`

## Performance Considerations

**Current bottlenecks:**
- Large files might lag on each keystroke
- Mermaid rendering adds latency (especially complex diagrams)
- CDN latency for Mermaid on first render

**If performance becomes an issue:**
1. Add debouncing to `onDidChangeTextDocument` listener
2. Implement rendering cache
3. Profile with Chrome DevTools (F12 in Extension Development Host)

## Standards & Conventions

### Code Style
- Use semicolons (required by eslint)
- Use `const` for constants, `let` for variables
- Comments explain WHY, not WHAT
- Max line length: ~100 characters

### Comments
```javascript
// Good: explains design decision
// Pre-process mermaid before marked to avoid escaping issues

// Bad: explains obvious code
const foo = bar; // Set foo to bar
```

### Variable Naming
- `currentPanel` - the active webview
- `currentDocument` - the document being previewed
- `nonce` - security token for CSP
- `disposable` - cleanup functions registered with VS Code

### JSDoc Format
```javascript
/**
 * Short description
 * @param {type} paramName - Description
 * @returns {type} Description
 */
function myFunction(paramName) { ... }
```

## Useful Resources

- **VS Code API:** https://code.visualstudio.com/api
- **Marked Documentation:** https://marked.js.org/
- **Mermaid Documentation:** https://mermaid.js.org/
- **CSP Documentation:** https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
- **VS Code Extension Best Practices:** https://code.visualstudio.com/api/references/extension-guidelines

## What NOT to Do

❌ Don't modify core state management without understanding implications
❌ Don't add large dependencies without justification
❌ Don't skip testing before committing
❌ Don't modify the CSP without security review
❌ Don't change `package.json` version manually (handled in release process)
❌ Don't commit the `.vsix` file to git (it's built automatically)

## Emergency Contacts / Resources

- **Bug Reports:** Open GitHub issues with error messages
- **Questions:** Check existing issues and ARCHITECTURE.md
- **Contributing:** Follow the guidelines in README.md

---

**Last Updated:** October 24, 2025
**Audience:** AI Agents, Contributors, Maintainers

**If you follow this guide, you will successfully extend this codebase!**
