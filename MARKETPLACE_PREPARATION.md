# VSCode Marketplace Publication - Task List

**Status:** Pre-Publication Preparation
**Current Version:** 0.2.0
**Target:** First Marketplace Release
**Last Updated:** 2025-11-01

---

## CRITICAL - Must Fix Before Publication

### 1. Azure DevOps & Publisher Setup

**Issue:** Marketplace publishing requires Azure DevOps account and Personal Access Token
**Action Required:**

- [x] Verify Azure DevOps organization exists (or create one)
- [x] Generate Personal Access Token (PAT) with "Marketplace > Manage" scope
- [x] Set organization scope to "All accessible organizations"
- [x] Verify publisher "KunalPathak" is registered on Visual Studio Marketplace
- [x] Test authentication: `vsce login KunalPathak`
      **Verification:** Can login with `vsce login` without errors ✓ CONFIRMED
      **Priority:** CRITICAL - Cannot publish without this

### 2. Git Repository Clean State

**Issue:** Uncommitted changes exist (package-lock.json, test.md)
**Action Required:**

- [x] Review changes in `package-lock.json` - npm dependencies updated to v0.2.0
- [x] Review changes in `test.md` - removed markdown code fence wrapper
- [x] Commit changes or discard if unintended - COMMITTED
- [x] Ensure git status is clean before packaging final release
      **Verification:** `git status` shows clean working tree ✓ CONFIRMED
      **Priority:** HIGH - Marketplace prefers releases from clean commits

### 3. Example File Corruption

**Issue:** [example.md](example.md:1) wrapped in ````markdown code fence - file is unusable as example
**Action Required:**

- [x] Remove opening ````markdown from line 1
- [x] Remove closing ```` from end of file
- [x] Verify file renders correctly when previewed - FIXED
- [x] Consider if example.md is needed (test.md already exists) - KEEP AS EXAMPLE
      **Verification:** Open example.md and verify preview renders content, not code fence ✓ VERIFIED
      **Priority:** MEDIUM - File included in package but broken

### 4. LICENSE File Incomplete

**Issue:** [LICENSE](LICENSE:3) missing copyright holder name and year is 2025 (should be when first created)
**Action Required:**

- [x] Add author name to "Copyright (c) 2025 [Your Name]" - ADDED: Kunal Pathak
- [x] Verify year is correct (when was extension first created?) - 2025 is correct
- [x] Update if needed - COMPLETED
      **Verification:** LICENSE has complete copyright notice ✓ VERIFIED
      **Priority:** MEDIUM - Legal clarity for users

### 5. README Command Name Mismatch

**Issue:** [README.md:55,64](README.md:55) references "Markdown: Show Markdown Preview" but package.json defines "Show Lightweight Markdown Preview"
**Action Required:**

- [x] Update README.md lines 55 and 64 to use correct command name - UPDATED
- [x] Search entire README for other instances - VERIFIED: All 2 instances fixed
- [x] Verify command palette title matches extension exactly - CONFIRMED: "Show Lightweight Markdown Preview"
      **Verification:** Run command from palette using exact title from README ✓ VERIFIED
      **Priority:** HIGH - User confusion if instructions don't work

---

## RECOMMENDED - Should Fix Before Publication

### 6. Missing Development Configuration

**Issue:** No [.vscode/launch.json](.vscode/launch.json) for debugging extension during development
**Action Required:**

- [ ] Create .vscode/launch.json with standard extension debugging config
- [ ] Test F5 launches Extension Development Host correctly
- [ ] Consider adding .vscode/settings.json for workspace settings
- [ ] Add .vscode to .vscodeignore to exclude from package
      **Verification:** F5 in VS Code launches debugging session
      **Priority:** MEDIUM - Improves developer experience

### 7. Missing Screenshots/Visual Assets

**Issue:** README has no screenshots showing extension in action
**Action Required:**

- [ ] Capture screenshot of markdown file with preview panel side-by-side
- [ ] Capture screenshot showing Mermaid diagram rendering
- [ ] Add screenshots to repository (create screenshots/ directory)
- [ ] Update README.md with image references
- [ ] Ensure images use HTTPS URLs or relative paths
- [ ] Verify images display in GitHub and marketplace preview
      **Verification:** README preview shows images correctly
      **Priority:** HIGH - Visual demos significantly increase downloads

### 8. Missing Package.json Marketplace Fields

**Issue:** Optional but recommended marketplace metadata missing
**Action Required:**

- [ ] Add `galleryBanner` with `color` field for branded marketplace appearance
- [ ] Add `qna` field: "marketplace" (enables Q&A) or URL to discussion forum
- [ ] Consider `badges` array with build status, version, downloads (after publishing)
- [ ] Verify `pricing` field not needed (defaults to "Free")
      **Verification:** Check package.json has new fields
      **Priority:** LOW - Improves marketplace presence but not required

### 9. Missing CI Quality Checks

**Issue:** [.github/workflows/release.yml](.github/workflows/release.yml) only packages on release, doesn't test
**Action Required:**

- [ ] Add CI workflow that runs on pull requests
- [ ] Include `npm run lint` in CI pipeline
- [ ] Consider adding `npm run test` when tests exist
- [ ] Add status badge to README
      **Verification:** Open PR triggers CI checks
      **Priority:** MEDIUM - Quality assurance before releases

### 10. No Automated Tests

**Issue:** No unit tests, integration tests, or test framework configured
**Action Required:**

- [ ] Evaluate need for automated testing (extension is simple, might not need)
- [ ] If adding tests: create test/ directory structure
- [ ] Add tests for core functions (updateWebviewContent, getNonce, etc.)
- [ ] Update CI to run tests
- [ ] Update npm test script to actually run tests
      **Verification:** `npm test` runs test suite successfully
      **Priority:** LOW - Manual testing may suffice for this simple extension

---

## OPTIONAL - Nice to Have

### 11. Missing Community Health Files

**Issue:** No issue templates, contributing guidelines, code of conduct
**Action Required:**

- [ ] Create .github/ISSUE_TEMPLATE/ with bug report and feature request templates
- [ ] Create CONTRIBUTING.md with guidelines for contributors
- [ ] Add CODE_OF_CONDUCT.md if project grows
- [ ] Create SECURITY.md with security policy and reporting instructions
      **Verification:** Files exist in .github/ directory
      **Priority:** LOW - Good for larger projects, optional for small extension

### 12. README Enhancements

**Issue:** README missing usage tips, troubleshooting, FAQ section
**Action Required:**

- [ ] Add "Usage Tips" section with keyboard shortcuts or best practices
- [ ] Add "Troubleshooting" section for common issues (CDN blocked, etc.)
- [ ] Add FAQ section addressing common questions
- [ ] Add animated GIF showing extension in action
- [ ] Add comparison table vs. built-in preview (why use this?)
      **Verification:** README is comprehensive and user-friendly
      **Priority:** LOW - Current README is functional

### 13. Package Size Optimization

**Issue:** Package includes documentation files that users don't need at runtime
**Action Required:**

- [ ] Review files included in package (check `vsce package` output)
- [ ] Consider excluding AGENTS.md, ARCHITECTURE.md, RELEASE_CHECKLIST.md from package
- [ ] Update .vscodeignore to exclude development-only files
- [ ] Verify exclusions don't break functionality
- [ ] Check package size reduction
      **Verification:** Package size decreases without breaking extension
      **Priority:** LOW - Current 197KB is already small

### 14. Extension Categories & Keywords

**Issue:** Current category "Programming Languages" might not be optimal
**Action Required:**

- [ ] Review available VSCode extension categories
- [ ] Consider adding "Formatters", "Other", or "Snippets" categories
- [ ] Review keywords for discoverability (current: 7 keywords, max 30)
- [ ] Add keywords like: "md", "render", "documentation", "diagram", "chart"
      **Verification:** Extension appears in appropriate category searches
      **Priority:** LOW - Current categorization is acceptable

### 15. Version Strategy Alignment

**Issue:** Pre-release strategy not documented, version 0.2.0 suggests beta
**Action Required:**

- [ ] Decide if initial marketplace release should be 0.2.0 or 1.0.0
- [ ] Consider 1.0.0 for first marketplace release (indicates production-ready)
- [ ] Document versioning strategy in RELEASE_CHECKLIST.md
- [ ] Update CHANGELOG if version changes
      **Verification:** Version number reflects maturity level
      **Priority:** LOW - 0.2.0 is fine for initial release

---

## PRE-PUBLICATION VERIFICATION

### Final Checks Before Publishing

**Must complete these immediately before `vsce publish`:**

- [ ] **Clean Build Test**

  - Delete node_modules and reinstall: `rm -rf node_modules && npm install`
  - Run linter: `npm run lint` (must pass with zero errors)
  - Package extension: `npm run package`
  - Verify .vsix file created successfully

- [ ] **Manual Testing**

  - Install .vsix in clean VSCode instance: `code --install-extension *.vsix`
  - Test with sample markdown files (test.md, example.md)
  - Verify Mermaid diagrams render correctly
  - Verify live preview updates on file changes
  - Test command palette command
  - Test editor title bar icon appears
  - Verify no console errors in Developer Tools

- [ ] **Asset Verification**

  - Icon displays correctly in Extensions view (256x256 PNG)
  - Icon-eye.svg displays in editor title bar
  - No broken images in README when viewed on GitHub
  - All links in README are valid (test with link checker)

- [ ] **Metadata Verification**

  - package.json has all required fields (publisher, version, engines)
  - README.md is clear and accurate
  - CHANGELOG.md is up to date with current version
  - LICENSE is complete and correct

- [ ] **Repository State**

  - All changes committed to git
  - Version tagged: `git tag v0.2.0` (or appropriate version)
  - Changes pushed to GitHub: `git push && git push --tags`
  - GitHub release created (optional but recommended)

- [ ] **First Publish**
  - Login to marketplace: `vsce login kanad13`
  - Publish extension: `vsce publish`
  - Verify no errors during upload
  - Check marketplace page appears correctly
  - Wait for marketplace review/approval (if applicable)
  - Test installation from marketplace: `code --install-extension kanad13.lightweight-markdown-preview`

---

## POST-PUBLICATION TASKS

### After successful marketplace publication:

- [ ] Update README.md to reference marketplace installation
- [ ] Add marketplace badge to README
- [ ] Update RELEASE_CHECKLIST.md with any lessons learned
- [ ] Create GitHub release with .vsix file attached
- [ ] Announce release (Twitter, Reddit, personal blog, etc.)
- [ ] Monitor marketplace Q&A and reviews
- [ ] Set up marketplace analytics monitoring

---

## KNOWN LIMITATIONS (Document but Don't Fix)

These are documented limitations, not bugs to fix:

1. **Math expressions not supported** - Documented in README, acceptable limitation
2. **Mermaid requires internet** - CDN-based, documented, acceptable for v0.x
3. **Single preview panel** - Design decision, documented in CHANGELOG
4. **No offline mode** - Related to Mermaid CDN, acceptable for v0.x

---

## REFERENCES

- [VSCode Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Manifest Reference](https://code.visualstudio.com/api/references/extension-manifest)
- [VSCode Extension Marketplace](https://marketplace.visualstudio.com/vscode)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

---

## NOTES

- Extension is already functional and well-documented
- Codebase is clean and follows best practices
- No major refactoring needed
- Focus on marketplace-specific requirements and polish
- Most tasks are documentation, metadata, and testing
- Actual code quality is production-ready

**Estimated Time to Complete Critical Tasks:** 2-3 hours
**Estimated Time to Complete All Recommended Tasks:** 1-2 days
**Estimated Time for Full Polish (including optional):** 3-5 days

---

## PROGRESS TRACKING

**Last Updated:** 2025-11-01 (UPDATED)
**Tasks Completed:** 5 / 5 CRITICAL TASKS COMPLETED ✓
**Git Status:** Clean working tree - all changes committed
**Next Step:** Pre-publication verification checklist before publishing
