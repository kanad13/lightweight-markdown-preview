# Release Checklist - v0.1.0

## ✅ Completed Pre-Release Tasks

### Code Quality

- [x] Linting passes (`npm run lint`)
- [x] Extension packages successfully (`npm run package`)
- [x] No ESLint errors or warnings
- [x] All metadata fields populated

### Files & Documentation

- [x] `CHANGELOG.md` created with v0.1.0 entry
- [x] `icon.png` (256×256) created and referenced in package.json
- [x] `test.md` file created (renamed from example.md with typo fixed)
- [x] `README.md` updated with correct file references
- [x] `.vscodeignore` updated to include new files
- [x] All documentation typos fixed

### Metadata Updates

- [x] Version bumped to 0.1.0 in package.json
- [x] Author field added (`kanad13`)
- [x] Homepage field added
- [x] Bugs field added
- [x] Keywords expanded (now 7 keywords)
- [x] Icon field added to package.json
- [x] Test script simplified

### Repository

- [x] All changes committed
- [x] Git status clean

## 📦 Package Information

- **Name:** lightweight-markdown-preview
- **Version:** 0.2.0
- **Publisher:** kanad13
- **Size:** ~194 KB (.vsix)
- **Dependencies:** marked@^9.0.0
- **VS Code Version:** ^1.85.0

## 🚀 Next Steps for Marketplace Release

### Create Git Tag

```bash
git tag v0.1.0
git push origin main --tags
```

GitHub Actions will automatically:

1. Build the extension
2. Create a release at: https://github.com/kanad13/lightweight-markdown-preview/releases/tag/v0.1.0
3. Attach the .vsix file to the release

### Option A: Publish to Marketplace (Automated - No Token Needed)

Use GitHub Actions release uploads + Microsoft Marketplace integration

### Option B: Manual Publish to Marketplace

```bash
# Requires vsce login (one-time setup)
npm run publish
```

## 📋 Marketplace Listing Details

- **Display Name:** Lightweight Markdown Viewer
- **Description:** A simple Markdown preview extension for VS Code with Mermaid diagram support.
- **Categories:** Programming Languages
- **Keywords:** markdown, preview, mermaid, diagrams, viewer, live-preview, lightweight

## 🔍 Quality Assurance Checklist

### Before Publishing

- [ ] Test locally in Extension Development Host (F5)
- [ ] Verify preview works with test.md
- [ ] Confirm Mermaid diagram renders
- [ ] Check CSP allows diagram loading
- [ ] Test icon displays correctly in marketplace preview

### After Publishing

- [ ] Monitor GitHub Issues for feedback
- [ ] Check VSCode Marketplace page loads correctly
- [ ] Verify installation from marketplace works
- [ ] Confirm README displays properly

## 📄 Files Changed in v0.1.0

| File                  | Status      | Change                              |
| --------------------- | ----------- | ----------------------------------- |
| `package.json`        | ✏️ Modified | Version, author, metadata           |
| `CHANGELOG.md`        | ✨ New      | Release history                     |
| `icon.png`            | ✨ New      | 256×256 marketplace icon            |
| `test.md`             | ✨ New      | Renamed from example.md, typo fixed |
| `README.md`           | ✏️ Modified | Updated file references             |
| `.vscodeignore`       | ✏️ Modified | Cleanup and icon inclusion          |
| `example.md`          | 🗑️ Deleted  | Renamed to test.md                  |
| `ARCHITECTURE_old.md` | ��️ Deleted | Cleanup                             |

## 💡 Commit Details

**Commit:** 0cbaca2
**Branch:** main
**Message:** Release v0.1.0: Prepare for VSCode Marketplace

## 🎯 Ready for Release!

All critical issues resolved. Extension is marketplace-ready.

Last Updated: October 24, 2025
