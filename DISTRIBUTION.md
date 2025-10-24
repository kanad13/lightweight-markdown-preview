# Extension Distribution Guide

Your extension is now ready for distribution! Here's how to use it.

## Quick Start

### For Users: Install the Extension

**Option 1: Download from GitHub Releases (Easiest)**
1. Go to your repository Releases page
2. Download the `.vsix` file from the latest release
3. In VS Code: `Cmd+Shift+X` → Click "..." menu → "Install from VSIX..."
4. Select the downloaded file → Done!

**Option 2: Build from Source**
```bash
git clone https://github.com/kanad13/vscode-markdown-preview.git
cd vscode-markdown-preview
npm install
npm run package
```
Then use "Install from VSIX..." with the generated `.vsix` file.

---

## For You: Publishing Workflow

### 1. **Making a Release**

After making updates to your extension:

```bash
# Update version in package.json
# For example: 0.0.1 → 0.0.2

# Commit your changes
git add .
git commit -m "Bump version to 0.0.2"

# Create a tag (this triggers the GitHub Actions workflow)
git tag v0.0.2
git push origin main --tags
```

GitHub Actions will automatically:
- Build the `.vsix` file
- Create a GitHub Release
- Upload the `.vsix` as a downloadable asset

### 2. **Manual Packaging**

If you don't want to use GitHub Actions:

```bash
npm run package
```

This creates `lightweight-markdown-viewer-0.0.1.vsix` in your project root.

---

## File Changes Made

### Added Files:
- **`.vscodeignore`** - Tells vsce what files to exclude from the package
- **`.github/workflows/release.yml`** - GitHub Actions workflow for automatic releases

### Modified Files:
- **`package.json`** - Added vsce dev dependency and package/publish scripts
- **`README.md`** - Added installation instructions
- **`.gitignore`** - Added `*.vsix` to ignore packaged files

---

## Installation Methods for Your Users

### ✅ Recommended: From GitHub Releases
- No build tools needed
- User-friendly
- One-click install

### ✅ Alternative: Build from Source
- For developers who want to modify the extension
- Requires Node.js and npm

### ✅ Development Mode
- For contributing developers
- Press F5 in VS Code to test

---

## Next Steps

1. **Push your changes:**
   ```bash
   git add .
   git commit -m "Set up extension packaging"
   git push origin main
   ```

2. **Create your first release:**
   ```bash
   git tag v0.0.1
   git push origin main --tags
   ```

3. **Share the Release Link:**
   - GitHub Releases: `https://github.com/kanad13/vscode-markdown-preview/releases`
   - Users can download the `.vsix` and install it directly

---

## Troubleshooting

**Q: The `.vsix` file won't install**
- Make sure you're using "Install from VSIX..." not drag-and-drop
- Check that the file ends with `.vsix`

**Q: GitHub Actions workflow didn't run**
- Make sure you pushed the tag: `git push origin main --tags`
- Check the Actions tab on GitHub for errors

**Q: Want to unpublish/remove a release?**
- Go to GitHub Releases → Click on the release → "Delete"
- The `.vsix` will no longer be available

---

## More Information

- VS Code Extensions Guide: https://code.visualstudio.com/api
- vsce Documentation: https://github.com/microsoft/vscode-vsce
- Extension Distribution: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
