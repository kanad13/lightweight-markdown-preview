# VSCode Marketplace Publication - Checklist

**Status:** Ready for Pre-Publication Verification  
**Current Version:** 0.2.0  
**Target:** First Marketplace Release  
**Last Updated:** 2025-11-01  

---

## CRITICAL TASKS - COMPLETED ✓

All critical prerequisites completed:

- [x] Azure DevOps & Publisher Setup (vsce login working)
- [x] Git Repository Clean State (all changes committed)
- [x] Example File Corruption (markdown fence removed)
- [x] LICENSE File (copyright holder added)
- [x] README Command Names (corrected)

---

## RECOMMENDED ENHANCEMENTS - COMPLETED ✓

- [x] Development Configuration (.vscode/launch.json, settings.json)
- [x] Package.json Marketplace Fields (galleryBanner, qna, pricing)
- [x] CI Quality Checks (.github/workflows/ci.yml added)
- [x] Package Size Optimization (.vscodeignore updated, 17.41 KB)
- [x] Extension Categories & Keywords (expanded to 11 keywords, 2 categories)

---

## REMAINING RECOMMENDED ITEMS (Optional)

### 7. Screenshots/Visual Assets
- Status: NOT DONE (nice to have)
- Impact: Significantly increases discoverability
- Action: Defer to post-release v0.3.0

### 10. Automated Tests
- Status: SKIPPED (manual testing sufficient)
- Impact: Good for larger projects
- Action: Defer to v1.0.0 if needed

### 11-12. Community Health & README Enhancements
- Status: NOT DONE (nice to have)
- Impact: Better community engagement
- Action: Defer to post-release

### 15. Version Strategy
- Status: 0.2.0 is appropriate for first marketplace release
- Action: Keep as-is

---

## PRE-PUBLICATION VERIFICATION - NEXT STEPS

**Execute these immediately before publishing:**

### 1. Clean Build Test
```bash
rm -rf node_modules package-lock.json
npm install
npm run lint          # must pass with zero errors
npm run package       # must create .vsix file
```

### 2. Manual Testing
- [ ] Install .vsix: `code --install-extension lightweight-markdown-preview-0.2.0.vsix`
- [ ] Open test.md and example.md files
- [ ] Verify Mermaid diagrams render correctly
- [ ] Verify live preview updates on file changes
- [ ] Test command from Command Palette
- [ ] Verify editor title bar icon appears
- [ ] Check Developer Tools - no console errors

### 3. Asset Verification
- [ ] icon.png displays in Extensions view
- [ ] icon-eye.svg displays in editor title bar
- [ ] No broken images in README (GitHub preview)
- [ ] All links in README are valid

### 4. Metadata Verification
- [ ] package.json has all required fields
- [ ] README.md is clear and complete
- [ ] CHANGELOG.md is up to date
- [ ] LICENSE is complete

### 5. Repository State
- [ ] All changes committed: `git status`
- [ ] Tag version: `git tag v0.2.0`
- [ ] Push to GitHub: `git push && git push --tags`

### 6. Publish to Marketplace
```bash
vsce login kanad13                           # login (already done)
vsce publish                                 # publish extension
# Wait for marketplace processing
# Verify on: https://marketplace.visualstudio.com
```

---

## POST-PUBLICATION TASKS

After successful marketplace publication:

- [ ] Update README.md to reference marketplace installation
- [ ] Add marketplace badge to README
- [ ] Update RELEASE_CHECKLIST.md with lessons learned
- [ ] Create GitHub release with .vsix file
- [ ] Monitor marketplace Q&A and reviews

---

## KNOWN LIMITATIONS (Document, Don't Fix)

These are acceptable for v0.x:

1. **Math expressions not supported** - Documented in README
2. **Mermaid requires internet** - CDN-based, documented
3. **Single preview panel** - Design decision
4. **No offline mode** - Related to Mermaid CDN

---

## REFERENCES

- [VSCode Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Manifest Reference](https://code.visualstudio.com/api/references/extension-manifest)
- [VSCode Extension Marketplace](https://marketplace.visualstudio.com/vscode)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

---

## COMPLETION STATUS

| Task | Status | Notes |
|------|--------|-------|
| Critical Prerequisites | ✓ DONE | All 5 critical items completed |
| Development Config | ✓ DONE | launch.json, settings.json created |
| Marketplace Metadata | ✓ DONE | galleryBanner, qna, keywords, categories |
| CI/CD Workflows | ✓ DONE | ci.yml added for PR checks |
| Package Optimization | ✓ DONE | .vscodeignore refined, 17.41 KB |
| Build Test | ✓ DONE | Lint passes, package successful |
| Git Status | ✓ CLEAN | 4 commits ready to push |
| Pre-Publication Checklist | → NEXT | Begin verification |
| Screenshots | ◌ OPTIONAL | Post-release enhancement |
| Automated Tests | ◌ OPTIONAL | Manual testing sufficient |
| Community Files | ◌ OPTIONAL | Post-release enhancement |

---

## NEXT IMMEDIATE ACTIONS

1. **Push changes to GitHub**
   ```bash
   git push
   ```

2. **Monitor CI/CD workflows**
   - Watch for ci.yml execution on push
   - Verify no failures in linting or packaging

3. **Complete Pre-Publication Verification checklist** (above)

4. **Tag and publish**
   ```bash
   git tag v0.2.0
   git push --tags
   vsce publish
   ```

---

*Last verified: 2025-11-01 | Ready for publication pipeline*
