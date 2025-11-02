# Development Guide

How to develop, test, and release the Lightweight Markdown Preview extension.

## Codebase Overview

```
lightweight-markdown-preview/
├── src/
│   └── extension.js              # Main extension code (~260 lines)
├── assets/
│   ├── icon.png                  # Marketplace icon (128x128)
│   └── icon-eye.svg              # Editor title bar icon
├── examples/
│   └── test.md                   # Test file with all markdown features
├── docs/
│   ├── ARCHITECTURE.md           # Design decisions & security model
│   ├── CHANGELOG.md              # Version history
│   └── MARKETPLACE_PREPARATION.md # v0.2.0 release archive
├── package.json                  # VS Code manifest & npm metadata
├── .vscode/
│   ├── launch.json               # Debug configuration
│   └── settings.json             # Development settings
└── .github/
    └── workflows/
        └── ci.yml                # GitHub Actions CI/CD
```

**Key file:** `src/extension.js` contains all logic.
**Key dependencies:** Only `marked` (NPM). Mermaid & MathJax via CDN.

## Local Setup

```bash
# Clone and install
git clone https://github.com/kanad13/lightweight-markdown-preview.git
cd lightweight-markdown-preview
npm install

# Verify setup
npm run lint              # Should show zero errors
npm run package           # Should create .vsix file
```

## Making Changes

### Edit the Code

Edit `src/extension.js`. Changes are reflected immediately in Extension Development Host.

### Code Style

- Use 2-space indentation (ESLint enforces)
- Include JSDoc comments explaining WHY (not WHAT)
- Use const/let (no var)
- No complex nesting (keep functions < 50 lines if possible)

### Add a Dependency

**Do NOT add dependencies without justification.**

Before adding:
1. Is it absolutely necessary?
2. What's the package size?
3. Can we use a CDN instead?
4. Will it require security review?

To add a justified dependency:
```bash
npm install --save package-name
npm run lint
npm run package
# Verify .vsix size hasn't grown excessively
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#dependency-strategy) for why Mermaid/MathJax use CDN.

## Testing

### Local Manual Test (5 minutes)

1. **Launch Extension Development Host:**
   ```bash
   # Press F5 in VS Code, or:
   npm run dev
   ```

2. **Open test file:**
   - In the Dev Host window, open `examples/test.md`

3. **Run preview command:**
   - Command Palette: `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows/Linux)
   - Search: `Markdown: Show Lightweight Markdown Preview`
   - Or press: `Cmd+Shift+M` / `Ctrl+Shift+M`

4. **Verify rendering:**
   - [ ] Headings render correctly
   - [ ] Lists (ordered/unordered) display properly
   - [ ] Tables render with borders
   - [ ] Code blocks show syntax highlighting
   - [ ] Images display
   - [ ] Links are clickable
   - [ ] **Mermaid flowchart diagram** renders as diagram
   - [ ] **MathJax equations** render (both inline and display)
   - [ ] Live updates: type in editor, preview updates in real-time

5. **Check console for errors:**
   - Dev Host menu: Help → Toggle Developer Tools
   - Console tab - should show no red errors

### Automated Testing

Linting (required before every commit):
```bash
npm run lint              # Must pass with zero errors
```

This runs ESLint, which checks for:
- Syntax errors
- Unused variables
- Code style violations
../architecture.md
### Continuous Integration

GitHub Actions runs on every push/PR:
```bash../architecture.md
# GitHub runs this automatically:
npm install
npm run lint
npm run package
# Checks that .vsix builds successfully
```

View results: https://github.com/kanad13/lightweight-markdown-preview/actions

## Building for Distribution

### Create a Packaged Extension (.vsix)

```bash
npm run package
```

This creates: `lightweight-markdown-preview-X.X.X.vsix`

**What it does:**
1. Bundles `src/extension.js`
2. Includes assets, docs, examples
3. Excludes node_modules, .git, test files (via .vscodeignore)
4. Final size: ~19 KB

**Verify the build:**
- File exists: `ls -lh lightweight-markdown-preview-*.vsix`
- Size is reasonable: should be < 25 KB

### Test the Packaged Extension

```bash
# Install the .vsix into VS Code
code --install-extension lightweight-markdown-preview-X.X.X.vsix

# Test in regular VS Code (not Dev Host)
# Open a .md file
# Command Palette: Markdown: Show Lightweight Markdown Preview
# Verify same behavior as in dev mode
```

## Releasing to Marketplace

### Complete Release Workflow

**Step 1: Prepare code**
```bash
npm run lint                    # Must pass with zero errors
git status                      # Must be clean
```

**Step 2: Update version**
- Edit `package.json`: increment version (e.g., 0.2.0 → 0.3.0)
  - Major.Minor.Patch (semantic versioning)
  - See https://semver.org/
- Edit `docs/CHANGELOG.md`: add entry for new version
  ```markdown
  ## [0.3.0] - YYYY-MM-DD
  ### Added
  - Feature description
  ### Fixed
  - Bug fix description
  ```

**Step 3: Verify build**
```bash
npm run package                # Must create .vsix with no errors
```

**Step 4: Commit version changes**
```bash
git add package.json docs/CHANGELOG.md
git commit -m "Release v0.3.0: [description]"
```

**Step 5: Create git tag**
```bash
git tag v0.3.0
git push origin main --tags
```

This triggers:
- GitHub Actions CI/CD (linting + packaging)
- .vsix available in [GitHub Releases](https://github.com/kanad13/lightweight-markdown-preview/releases)

**Step 6: Publish to VS Code Marketplace**
```bash
# Login (one-time, already configured)
vsce login kanad13

# Publish
vsce publish

# Wait for marketplace processing (~1 hour)
```

**Step 7: Verify marketplace listing**
- https://marketplace.visualstudio.com/items?itemName=kanad13.lightweight-markdown-preview
- Check icon, description, version number are correct

### Rollback (if something goes wrong)

```bash
# Unpublish from marketplace
vsce unpublish kanad13.lightweight-markdown-preview --version 0.3.0

# Delete local tag
git tag -d v0.3.0
git push origin :refs/tags/v0.3.0

# Reset code to previous version
git reset --soft HEAD~1
git checkout package.json docs/CHANGELOG.md
```

## Common Development Tasks

### Update README.md

Only update README for **user-facing changes**:
- New features
- Installation changes
- Usage changes
- Bug fixes that affect behavior

Do NOT update for:
- Internal code refactoring
- Developer-only changes
- Dependency updates

### Add a New Command

1. Edit `src/extension.js`: add command registration
2. Add command description in `package.json` (commands section)
3. Test with `npm run lint` and F5 launch
4. Update README.md if user-facing

### Modify Security (CSP, Nonces, etc.)

⚠️ **Requires review.** Do not make CSP changes without understanding security implications.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#security-threat-model) for security model first.

### Profile Performance

If rendering is slow:

1. **In Extension Dev Host:**
   - Press `Ctrl+Shift+P` → `Show Performance`
   - Open large markdown file
   - Observe timing

2. **Use DevTools:**
   - Press `Ctrl+Shift+J` for DevTools
   - Performance tab → record while typing
   - Look for bottlenecks

Current baseline: ~50ms render time for typical files. Acceptable up to ~5K lines.

## Quick Reference

```bash
# Development
npm install                     # One-time setup
npm run lint                    # Check code quality (required before commit)
npm run package                 # Build .vsix file

# Testing
# Press F5                       # Launch Extension Dev Host
# Cmd+Shift+M / Ctrl+Shift+M    # Open preview in dev mode

# Release
npm run package                 # Build
git add .
git commit -m "Release vX.X.X: [description]"
git tag vX.X.X
git push origin main --tags
vsce login kanad13
vsce publish                    # Wait ~1 hour for processing
```

## Troubleshooting

### Extension doesn't load in Dev Host
- Check: `npm run lint` passes
- Check: `src/extension.js` has no syntax errors
- Try: Close Dev Host window, press F5 again

### Preview not updating on file changes
- Check: File is saved (Cmd+S / Ctrl+S)
- Check: Preview command ran successfully
- Try: Close and reopen preview

### Linting errors prevent release
```bash
npm run lint                    # See error details
# Fix errors in src/extension.js
npm run lint                    # Verify fixed
```

### Build (.vsix) fails
```bash
npm run package                 # See error details
# Usually: missing dependency or syntax error
# Fix error, then retry
```

### Marketplace listing doesn't update
- Marketplace processes in ~1 hour
- Hard refresh browser: Cmd+Shift+R / Ctrl+Shift+R
- Check version number in listing matches package.json

---

For design decisions and architecture, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
