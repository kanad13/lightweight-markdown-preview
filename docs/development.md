# Development Guide

A streamlined guide to develop, test, and release the Lightweight Markdown Preview extension.

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

If you encounter issues, a clean reinstall often helps. This command removes all downloaded packages, allowing you to start fresh.

```bash
# Delete the node_modules folder
rm -rf node_modules

# Reinstall all packages
npm install
```

## 2. Making Changes

1.  **Edit Code:** Make changes to `src/extension.js`.
2.  **Launch Dev Host:** Press `F5` in VS Code to open a new window with the extension loaded.
3.  **Test:** Open `examples/test.md` and run `Markdown: Show Lightweight Markdown Preview` from the Command Palette (`Ctrl+Shift+P`). Changes you make to the code will apply in real-time.

### Code Style

- 2-space indentation.
- `const`/`let` only.
- Keep functions simple and add JSDoc comments explaining _why_ the code is needed.

### Dependencies

**Avoid adding new NPM dependencies.** If one is absolutely necessary, justify its need, check its size, and consider using a CDN instead. See `docs/ARCHITECTURE.md` for more details.

## 3. Testing

### Manual Testing (In Dev Host)

1.  Launch the preview for `examples/test.md`.
2.  **Verify all elements render correctly:**
    - Headings, lists, tables, code blocks, images, and links.
    - Mermaid diagrams and MathJax equations.
    - Live updates when you type in the editor.
3.  **Check for errors:** Open the developer console (`Help > Toggle Developer Tools`) and ensure there are no errors.

### Automated Testing

Linting is required before every commit.

```bash
# Run ESLint to check for syntax and style errors
npm run lint
```

_Continuous Integration (CI) via GitHub Actions automatically runs `npm install`, `lint`, and `package` on every push._

## 4. Releasing to Marketplace

### Step 1: Update Version & Changelog

1.  Increment the `version` in `package.json` (e.g., `0.3.0` -> `0.4.0`).
2.  Add a new entry in `docs/CHANGELOG.md` detailing the changes.

### Step 2: Build and Commit

```bash
# Ensure the package builds successfully
npm run package

# Commit the version update
git add package.json docs/CHANGELOG.md
git commit -m "Release v0.4.0: [Brief description of changes]"
```

### Step 3: Tag and Push

Creating and pushing a tag triggers the release action.

```bash
# Create a tag that matches the package version
git tag v0.4.0

# Push the commit and the new tag
git push origin main --tags
```

### Step 4: Publish

```bash
# Log in to the marketplace (one-time setup)
vsce login KunalPathak

# Publish the extension
vsce publish
```

The update should appear on the [Marketplace Listing](https://marketplace.visualstudio.com/items?itemName=KunalPathak.lightweight-markdown-preview) within an hour.
