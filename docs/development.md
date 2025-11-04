# Development Guide

A comprehensive guide to develop, test, and release the Lightweight Markdown Preview extension.

## 1. Local Setup & Verification

Get your environment running with these commands.

```bash
# Clone the repository
git clone https://github.com/kanad13/lightweight-markdown-preview.git
cd lightweight-markdown-preview

# Install dependencies
npm install

# Run linters to check for code quality
npm run lint

# Create a distributable .vsix file
npm run package
```

### Troubleshooting Setup

If you encounter issues, a clean reinstall often helps.

```bash
rm -rf node_modules
npm install
```

## 2. Feature Development Workflow

### Step 1: Create a Feature Branch

Always create a new branch for features. Never commit directly to `main`.

```bash
# Create and switch to a feature branch
git checkout -b feat/your-feature-name
```

Branch naming convention:
- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring

### Step 2: Make Changes

1. **Edit Code:** Make changes to `src/extension.js` or other source files.
2. **Launch Dev Host:** Press `F5` in VS Code to open a dev window with the extension loaded.
3. **Test Locally:** Open `examples/test.md` and run `Markdown: Show Lightweight Markdown Preview` from the Command Palette (`Ctrl+Shift+P`). Changes apply in real-time.
4. **Lint Before Committing:** Run `npm run lint` to catch style issues early.

### Step 3: Commit Changes

```bash
# Stage your changes
git add src/extension.js

# Commit with a descriptive message
git commit -m "feat: add descriptive title

- Bullet point details
- More details"
```

Keep commits atomic and logical. Write commit messages that explain _why_ the change was made.

### Code Style

- 2-space indentation
- `const`/`let` only (no `var`)
- Keep functions simple with clear JSDoc comments
- No console logs in production code

### Dependencies

**Avoid adding new NPM dependencies.** This keeps the extension lightweight. If absolutely necessary:
1. Justify the need
2. Check bundle size impact (`npm run package` and review dist/)
3. Consider using a CDN instead
4. See `docs/ARCHITECTURE.md` for security considerations

### Step 4: Test Thoroughly

```bash
# Run linting
npm run lint

# Build package to verify no errors
npm run package
```

Open the dev host and verify:
- All elements render correctly (headings, lists, tables, code blocks, images)
- Mermaid diagrams render properly
- MathJax equations display correctly
- Live updates work when typing
- No errors in Developer Tools (`Help > Toggle Developer Tools`)

### Step 5: Merge to Main

```bash
# Switch to main branch
git checkout main

# Ensure main is up to date
git pull origin main

# Merge your feature branch (use --no-ff for clarity)
git merge --no-ff feat/your-feature-name

# Push to remote
git push origin main
```

After pushing, verify that:
1. GitHub Actions builds pass (check the Actions tab)
2. The build produces valid .vsix files
3. No new warnings or errors in the CI logs

## 3. Release to Marketplace

**Only release from `main` branch after all features are merged and tested.**

### Pre-Release Checklist

- [ ] All features merged to `main`
- [ ] GitHub Actions build passes
- [ ] No uncommitted changes (`git status` shows clean)
- [ ] Version bump planned
- [ ] CHANGELOG.md prepared

### Step 1: Update Version & Changelog

```bash
# Edit package.json - increment version (e.g., 1.0.1 -> 1.0.2)
# Follow semantic versioning: MAJOR.MINOR.PATCH

# Edit CHANGELOG.md with new version entry
# Format:
# ## [1.0.2] - YYYY-MM-DD
#
# ### Added
# - Feature description
#
# ### Changed
# - Enhancement description
#
# ### Fixed
# - Bug fix description
```

### Step 2: Build and Verify

```bash
# Ensure clean build
npm run lint
npm run package

# Verify the .vsix file was created
ls -lh *.vsix
```

### Step 3: Commit Version Update

```bash
# Stage version and changelog
git add package.json CHANGELOG.md

# Commit (don't include build artifacts)
git commit -m "docs: update documentation and changelog for v1.0.2 release"

# Push to main
git push origin main
```

### Step 4: Create Git Tag and Release

```bash
# Create annotated tag
git tag -a v1.0.2 -m "Add feature X, fix Y, and improve Z"

# Push tag to GitHub
git push origin v1.0.2

# Create GitHub Release
gh release create v1.0.2 --title "v1.0.2" --notes "Describe the release here"
```

### Step 5: Publish to VS Code Marketplace

```bash
# Log in (one-time setup, stores token)
vsce login KunalPathak

# Publish the version
npm run publish
```

This command:
1. Runs `npm run build` to bundle the extension
2. Runs `vsce publish` to push to the marketplace

The update appears on the [Marketplace](https://marketplace.visualstudio.com/items?itemName=KunalPathak.lightweight-markdown-preview) within ~1 hour.

### Step 6: Verify Release

- Check VS Code Marketplace to confirm version appears
- Check GitHub Releases page to confirm release is published
- Verify CHANGELOG.md and package.json are correct on main branch

## 4. Common Issues & Troubleshooting

### Build Fails with "same case insensitive path"

This means duplicate files with different casing exist (e.g., `README.md` and `readme.md`). Git tracks them separately.

**Fix:**
```bash
# Remove duplicates (keep lowercase version)
git rm -f README.md
git commit -m "fix: remove duplicate file with wrong case"
```

### VSIX Package Already Exists on Marketplace

If you try to publish an already-published version, vsce will fail. Always:
1. Increment version in `package.json` first
2. Create a new git tag for the new version

### GitHub Actions Build Fails

Check the Actions tab on GitHub:
1. Click the failed workflow
2. Review the build logs
3. Common causes:
   - Lint errors: run `npm run lint` locally and fix
   - Missing files: ensure all required files are tracked in git
   - Case sensitivity issues: check for duplicate files

## 5. Release Checklist Summary

Use this before every release:

```
BEFORE RELEASE:
- [ ] Create feature branch for changes
- [ ] Test all features locally (F5 dev host)
- [ ] Run `npm run lint` with no errors
- [ ] Run `npm run package` with no errors
- [ ] Merge to main via git merge
- [ ] Push to origin/main
- [ ] Wait for GitHub Actions to pass
- [ ] Verify no uncommitted changes

RELEASE:
- [ ] Increment version in package.json
- [ ] Update CHANGELOG.md with new entry
- [ ] Commit version update
- [ ] Create git tag (v1.0.2)
- [ ] Push tag to GitHub
- [ ] Create GitHub Release
- [ ] Run `npm run publish`
- [ ] Verify marketplace shows new version
- [ ] Verify GitHub releases page shows new release

AFTER RELEASE:
- [ ] Announce release if applicable
- [ ] Monitor marketplace for issues
- [ ] Keep documentation up to date
```
