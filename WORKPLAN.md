# Code Quality Improvements — Workplan

## File-Touch Matrix

| File | Ph1 | Ph2 | Ph3 | Ph4 | Ph5 |
|------|-----|-----|-----|-----|-----|
| `eslint.config.js` | sourceType + globals | | | | |
| `.gitignore` | add `dist/` | | | | |
| `.vscodeignore` | fix dead ref | | | | |
| `webpack.config.js` | remove babel | | | | |
| `package.json` | drop devDeps | | | | update test script |
| `src/extension.js` | | retainContext, debounce | CSS vars, theme detect | extract template | export pure fns |
| `src/webview.html` | | | | new file | |
| `test/extension.test.js` | | | | | new file |

## Phases

### Phase 1: Config & Build Cleanup
No functional changes. Fix misconfigurations and remove dead weight.

- [ ] `eslint.config.js`: `sourceType: "module"` → `"commonjs"`, add `setTimeout`/`clearTimeout` globals
- [ ] `.gitignore`: add `dist/`
- [ ] git: `git rm -r --cached dist/`
- [ ] `.vscodeignore`: `.eslintrc.json` → `eslint.config.js`
- [ ] `webpack.config.js`: remove babel-loader rule
- [ ] `package.json`: remove `@babel/core`, `@babel/preset-env`, `babel-loader`, `@vscode/test-electron` from devDeps

Gate: `npm run lint` passes, `npm run build` passes.

### Phase 2: Quick Extension Fixes
Small targeted changes in `src/extension.js`.

- [ ] Remove `retainContextWhenHidden: true`
- [ ] Add 300ms debounce to `onDidChangeTextDocument` handler

Gate: `npm test` passes, F5 preview still works.

### Phase 3: Dark Theme Support
Replace hardcoded light-theme CSS with VS Code theme variables.

- [ ] Replace all hardcoded colors with `var(--vscode-*)` CSS variables
- [ ] Add `resolveTheme()` to auto-detect Mermaid theme from VS Code color theme
- [ ] Add `onDidChangeActiveColorTheme` listener to re-render on theme switch
- [ ] Switch highlight.js theme conditionally (light/dark)

Gate: `npm test` passes, preview renders correctly in both light and dark themes.

### Phase 4: HTML Template Extraction
Extract the ~460-line HTML template from `getWebviewContent()` to a separate file.

- [ ] Create `src/webview.html` with placeholder tokens (`{{NONCE}}`, `{{TOC}}`, `{{CONTENT}}`, etc.)
- [ ] Refactor `getWebviewContent()` to read template + do string replacement

Gate: `npm test` passes, preview renders identically to before.

### Phase 5: Automated Tests
Add unit tests for pure functions using Node.js built-in test runner.

- [ ] Export `extractHeadings` (and other pure functions) from `src/extension.js`
- [ ] Create `test/extension.test.js` with edge cases
- [ ] Update `package.json` `scripts.test` to run `node --test` + lint

Gate: `npm test` runs tests and lint, all pass.
