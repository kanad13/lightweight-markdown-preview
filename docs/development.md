# Development Guide

This guide covers setup, the daily workflow, and the release procedure. [workflows.md](workflows.md) says which procedure fits a request, and [testing.md](testing.md) says how a change is verified.

## Setup

### Install the tools

Local development needs only Node and `npm ci`. Use the version in `.nvmrc` or newer. CI runs on exactly that version, which is the `engines.node` floor. Publishing to the Marketplace needs two command-line tools. Open VSX publishing runs in CI and needs no local tool:

```bash
npm install -g @vscode/vsce   # Visual Studio Marketplace
brew install gh               # GitHub CLI
```

### Authenticate for publishing

Local development needs no credentials.

- **Marketplace (`vsce`):**
  - Create a Personal Access Token with the scope `Marketplace > Manage`.
  - Run `vsce login KunalPathak`, then check with `vsce ls-publishers`.
  - If the token expires, run `vsce login KunalPathak` again with a new one.
- **Open VSX (CI):**
  - The release workflow publishes to Open VSX. It signs in with a short-lived OIDC token that Open VSX issues to the registered trusted publisher (repository `kanad13/lightweight-markdown-preview`, workflow `release.yml`). No stored token is needed.
  - The repository secret `OVSX_PAT` is a fallback. When it is set, the workflow uses it instead of OIDC. Delete it once a release has published through OIDC.
  - To publish by hand, export a token from https://open-vsx.org under **Settings > Access Tokens** as `OVSX_PAT`, check it with `npx ovsx verify-pat KunalPathak`, then run `npx ovsx publish <file>.vsix`.
- **GitHub (`gh`):**
  - Run `gh auth login`, then check with `gh auth status`.

> **Deadline:** Microsoft retires global Azure DevOps Personal Access Tokens on 2026-12-01. After that date, authenticate with Microsoft Entra ID and publish with `vsce publish --azure-credential`. Follow the [VS Code publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) and update this section when the new credential is in place.

### Set up the repository

```bash
git clone https://github.com/kanad13/lightweight-markdown-preview.git
cd lightweight-markdown-preview
npm ci
npm test
```

- **`npm ci`, not `npm install`:**
  - `npm ci` installs the exact versions in `package-lock.json`, so builds are reproducible. Use it for setup and for fixing a broken `node_modules`.
  - Use `npm install` only to add or upgrade a dependency on purpose, and commit the updated lockfile.

## Daily Workflow

1. **Branch:**
   - Work on a feature branch and never commit to `main`: `git checkout -b feat/<name>`.
   - Use the prefixes `feat/`, `fix/`, `docs/`, and `refactor/`.
2. **Change:**
   - Press `F5` to start the Extension Development Host, open `examples/test.md`, and run **Markdown: Show Lightweight Markdown Preview**.
   - Follow the [architecture rules](../AGENTS.md#architecture-rules) and the style rules below.
3. **Check:**
   - Run `npm test`. It builds the bundle, runs every automated test, and lints. [testing.md](testing.md) explains the suites and the manual smoke check.
   - Run `npm run package` to confirm that the `.vsix` builds.
4. **Commit:**
   - Keep commits atomic. Write a concise, imperative subject that says what changed, and add the reason in the body.
   - Add no attribution trailers.
5. **Merge:**
   - Merge into `main` with `git merge --no-ff` after the maintainer approves, then push. Confirm that the CI run on `main` passes.

### Style

- **Enforced by ESLint** (`eslint.config.js`): tab indentation, double quotes, semicolons, `const` and `let` only.
- **`.prettierrc`:** it matches the ESLint rules for editors that format on save. The repository has no formatter script.
- **JSDoc:** every exported function states its purpose, parameters with types, return value, and side effects.
- **Comments:** explain why. Leave no `TODO` comments and no debugging output in shipped code.
- **Readme images:**
  - Link each image by an absolute `https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/<file>` URL.
  - The package leaves `assets/` out, so a relative link breaks on the Marketplace and Open VSX pages. A `github.com/.../blob/...` link returns an HTML page, not the image.
  - Use PNG or JPEG, because the Marketplace rejects SVG. Give every image alt text that names what it shows.
  - Add the file to `assets/` on the same branch. The image URL works for readers only after the branch merges to `main`.
  - `examples/showcase.md` is the document behind the screenshots. Open it in VS Code to retake them.

### Dependencies

Avoid new npm dependencies, because the extension stays small and has one runtime dependency. When a new one is unavoidable:

1. Justify the need in the change description.
2. Compare the bundle size before and after (`npm run package`, then inspect `dist/`).
3. Consider loading it from a CDN instead, and read the security notes in [architecture.md](architecture.md).
4. Choose the version with the rules in [dependencies.md](dependencies.md) and add the package to its inventory.

CDN library versions live in `CDN_VERSIONS` in `src/extension.js`, always as an exact `x.y.z`.

### High-risk areas

[architecture.md](architecture.md#requires-security-review) lists the areas that need a security review: the CSP, nonce generation, Mermaid and math preprocessing, state management, and script execution. Three mistakes recur there:

- **Nonce:**
  - Generate a new nonce with `crypto.randomBytes` on every render. A fixed or reused nonce defeats the CSP.
- **Panel state:**
  - Check that `currentPanel` exists before you use it. When the panel closes, cancel the pending update and reset `currentPanel` and `currentDocument`.
- **Images:**
  - Convert image paths with `webview.asWebviewUri`. A raw file path does not load in a webview.

## Release to Marketplace

Release only from `main`, only when the maintainer asks, and only after CI passes there. Replace `X.Y.Z` with the new version.

1. **Decide the version:**
   - Use semantic versioning: patch for fixes, minor for backward-compatible features, major for breaking changes.
   - Check that the icon is a PNG between 128 and 1024 pixels square, and that `git status` is clean.
2. **Bump the manifest:**
   - Run `npm version X.Y.Z --no-git-tag-version`. It updates `package.json` and `package-lock.json`, and the flag stops it from creating a tag.
3. **Update `CHANGELOG.md`:**
   - Add a section at the top with the header `## [X.Y.Z] - YYYY-MM-DD`.
   - Use the sections `Added`, `Changed`, and `Fixed`, and list user-facing changes only. Leave out refactors, tests, and build changes. Mention a dependency update only when it fixes a security problem.
4. **Verify from a clean state:**

   ```bash
   rm -rf node_modules
   npm ci
   npm test
   npm audit --omit=dev
   npm run package
   ```

   - `npm audit` does not cover the CDN libraries. Follow the [review procedure](dependencies.md#review-procedure) before each release.

5. **Commit and tag:**

   ```bash
   git add package.json package-lock.json CHANGELOG.md
   git commit -m "chore: bump version to X.Y.Z"
   git tag -a vX.Y.Z -m "Release version X.Y.Z"
   ```

   - Use an annotated tag. It must point at the version commit.

6. **Push:**

   ```bash
   git push origin main
   git push origin vX.Y.Z
   ```

   - The tag push starts `.github/workflows/release.yml`. It runs the tests, checks that the tag matches `package.json` and `CHANGELOG.md`, builds the `.vsix`, creates the GitHub release, and publishes to Open VSX.
   - If the run fails after the tag exists, fix the cause and start the workflow again from the Actions tab (**Release > Run workflow**, from `main`, with the tag). Open VSX ignores a version it already has, so repeating a run is safe.

7. **Publish to the Marketplace:**
   - Run `npm run publish`. The command builds first.
8. **Verify:**
   - The [Marketplace page](https://marketplace.visualstudio.com/items?itemName=KunalPathak.lightweight-markdown-preview) shows the new version (allow 5 to 10 minutes).
   - The release workflow ends green, and its last step confirms the version on Open VSX. `npx ovsx show KunalPathak.lightweight-markdown-preview` shows it too.
   - The GitHub release exists with the `.vsix` attached, and CI is green.

## Troubleshooting

| Symptom                                                  | Cause and fix                                                                                                                       |
| :------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `npm test` fails after a pull                            | Run `rm -rf node_modules && npm ci`                                                                                                 |
| CI fails                                                 | Open the failed run on the Actions tab. Reproduce lint errors with `npm run lint`, and check that every required file is tracked    |
| Build fails with "same case insensitive path"            | Two tracked files differ only in letter case, such as `README.md` and `readme.md`. Remove the one with the wrong case with `git rm` |
| Packaging fails with ".env files should not be packaged" | A local `.env` is present. List `.env` and `.env*` in `.vscodeignore`                                                               |
| Publish fails with "authorization failed"                | Run `vsce login KunalPathak` with a new token, then publish again                                                                   |
| Publish fails because the version exists                 | The version in `package.json` was not bumped. Bump it, commit, tag the new commit, and publish again                                |
| The tag already exists or points at the wrong commit     | Check with `git show vX.Y.Z --quiet`. Ask the maintainer before you delete or move a pushed tag                                     |
| `gh` reports no authentication                           | Run `gh auth login`                                                                                                                 |
