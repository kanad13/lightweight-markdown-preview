# Dependency Management Policy

This page sets the rules for choosing, configuring, and reviewing dependencies. It contains policies only. The files named below record which versions are in use, and [CHANGELOG.md](../CHANGELOG.md) and Git record the history of changes.

## Where Versions Are Defined

Version numbers live only in the files in this table. Documentation refers to the files and never repeats the numbers.

| Kind                           | Examples                                       | Defined in                                                                   |
| :----------------------------- | :--------------------------------------------- | :--------------------------------------------------------------------------- |
| Bundled runtime package        | `marked`                                       | `dependencies` in `package.json`; resolved version in `package-lock.json`    |
| CDN library loaded by webview  | Mermaid, MathJax, highlight.js                 | `CDN_VERSIONS` in [`src/extension.js`](../src/extension.js)                  |
| Build, test, and release tools | webpack, ESLint, `@vscode/vsce`, type packages | `devDependencies` in `package.json`; resolved version in `package-lock.json` |

The kinds differ in consequence:

- **Bundled package:**
  - Runs in the extension host.
  - Parses untrusted text.
- **CDN library:**
  - Runs in the webview under the Content Security Policy.
- **Tool:**
  - Runs only on a developer machine or in CI.

## Version Selection Policy

A version qualifies only if it meets every rule below. Apply the rules the same way to every dependency.

- **Stable channel:**
  - Alpha, beta, rc, canary, `next`, and nightly releases do not qualify.
- **Supported line:**
  - Use the newest major line that still receives fixes.
  - Treat a line with no release for 12 months as abandoned, unless the project declares it feature-complete.
- **Soak time:**
  - A new major version qualifies 30 days after its `.0` release.
  - A minor or patch version qualifies 14 days after its release.
- **No known advisories:**
  - `npm audit --omit=dev` reports 0 for the shipped tree.
  - For CDN libraries, read the project's GitHub Security Advisories page.
- **Support policy:**
  - The version runs on the current stable VS Code, on the floor in the Editor Support Policy, and on the Node release in `engines.node`.
  - Confirm by rendering `examples/test.md` and by reading the release notes for browser-baseline changes.
- **Exact pins without a lockfile:**
  - CDN URLs name a full `x.y.z` version, because no lockfile protects them.
  - npm packages use a caret range, and `package-lock.json` fixes the resolved version.
- **Stable tool majors:**
  - Build tools stay on their current major version.
  - An advisory or an engine requirement is the only reason to change a tool's major version.

## Editor Support Policy

The extension targets the current stable release of VS Code and carries no compatibility code for older editors.

- **Test target:**
  - The current stable VS Code release.
  - Insiders builds are not a target.
- **Floor:**
  - `engines.vscode` names the newest VS Code release that is at least 12 months old.
  - A floor that follows the calendar keeps the extension from depending on legacy editors.
  - A 12-month window still reaches editors that update slowly.
- **Forks:**
  - Cursor, Windsurf, and other forks run an older VS Code base than upstream.
  - A fork refuses to install an extension whose `engines.vscode` is above its base.
  - Check the fork's base version in its About dialog before you raise the floor.
- **Moving the floor:**
  - At each quarterly review, raise `engines.vscode` and the exact `@types/vscode` pin together.
  - Move both to the newest release that is at least 12 months old.
- **Release dates:**
  - Run `npm view @types/vscode time` to list VS Code release dates.

## Configuration Policy

- **Library defaults:**
  - Configure a library with its defaults.
  - Override a setting only for security (for example Mermaid `securityLevel`), for matching the VS Code theme, or for aligning a syntax with the extraction code (for example MathJax delimiters).
  - Never override visual defaults such as diagram layout and look.
- **Browser baseline:**
  - A CDN library qualifies only when its documented browser baseline is met by the Chromium in the floor VS Code release.
  - Read the release notes for baseline changes at every major upgrade.
- **Type package:**
  - Pin `@types/vscode` to the exact version of `engines.vscode`, so the types cannot suggest an API the floor lacks.
  - `vsce` refuses a type version above the engine.
- **Overrides:**
  - Add an `overrides` entry in `package.json` only when no upgrade path clears an advisory.
  - At each review, remove each override, run `npm install` and `npm audit`, and keep the entry only if the audit then reports advisories.
- **Content Security Policy:**
  - Keep the CSP strict.
  - Do not add a directive to silence a library's console message.

## Review Procedure

Run the review before every release and at least once per quarter.

```bash
npm audit --omit=dev    # shipped dependencies; must report 0 vulnerabilities
npm audit               # whole tree, including build tools
npm outdated            # candidates to compare against the selection policy
```

1. Run `npm update` for in-range tool updates, then `npm audit fix` for remaining advisories.
2. For each CDN library, run `npm view <package> time` to read recent versions and dates, then apply the selection policy.
3. Change `CDN_VERSIONS` for a qualifying version. Open the F5 dev host and render `examples/test.md` in a light and a dark theme. Check Mermaid diagrams, block and inline math, and highlighted code.
4. Read the release notes before you cross a major version.
5. Apply the Editor Support Policy and check whether the floor moves.
6. Run `npm test`, which includes lint and the template tests that verify the pinned versions.

## Adding a Dependency

- **Justify it:**
  - [development.md](development.md) requires a justification for any new npm dependency.
- **Choose the version:**
  - Apply the selection policy.
  - Check the bundle size in `dist/` after `npm run build`.
- **Place CDN libraries:**
  - Add a library the webview needs to `CDN_VERSIONS` with an exact version.
  - Do not use a major-only tag such as `@12`.

## Security Controls and Their Limits

- **Exact pins:**
  - The version pin is the control against a changed upstream release.
  - The pin still trusts jsDelivr to serve the pinned file unmodified.
- **Integrity hashes:**
  - A dynamic ES module import cannot carry a Subresource Integrity hash, so Mermaid loads without one.
  - Libraries loaded through a `<script>` tag can carry a hash.
- **Network dependence:**
  - Diagrams, math, and syntax highlighting load from the CDN on each preview.
  - The Markdown, the outline sidebar, and the scroll position keep working when the CDN is unreachable.
  - Do not bundle a large library to remove the network dependence.
