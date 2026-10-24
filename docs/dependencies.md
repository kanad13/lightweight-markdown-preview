# Dependency Management

This extension has three kinds of dependency, and each kind has one place where its version is defined. This page gives the rules for choosing a version, the constraints that currently limit upgrades, and the procedure for reviewing dependencies.

## Where Versions Are Defined

Version numbers live only in the files below. Documentation refers to these files and does not repeat the numbers.

| Kind                           | Examples                                       | Defined in                                                                   |
| :----------------------------- | :--------------------------------------------- | :--------------------------------------------------------------------------- |
| Bundled runtime package        | `marked`                                       | `dependencies` in `package.json`; resolved version in `package-lock.json`    |
| CDN library loaded by webview  | Mermaid, MathJax, highlight.js                 | `CDN_VERSIONS` in [`src/extension.js`](../src/extension.js)                  |
| Build, test, and release tools | webpack, ESLint, `@vscode/vsce`, type packages | `devDependencies` in `package.json`; resolved version in `package-lock.json` |

The kinds differ in consequence. A bundled package runs in the extension host and parses untrusted text. A CDN library runs in the webview under the Content Security Policy. A tool runs only on a developer machine or in CI.

## Version Selection Criteria

A version qualifies only if it meets all of these rules. Apply them the same way to every dependency.

1. **Stable channel.** Alpha, beta, rc, canary, `next`, and nightly releases do not qualify.
2. **Supported line.** Use the newest major line that still receives fixes. Treat a line with no release for 12 months as abandoned, unless the project declares it feature-complete.
3. **Soak time.** A new major version qualifies 30 days after its `.0` release. A minor or patch version qualifies 14 days after its release.
4. **No known advisories.** `npm audit --omit=dev` reports 0 for the shipped tree. For CDN libraries, read the project's GitHub Security Advisories page.
5. **Support floor.** The version runs on the oldest VS Code release in `engines.vscode` and the Node release in `engines.node`. Confirm by rendering `examples/test.md` and reading the release notes for raised browser baselines.
6. **Exact pins without a lockfile.** CDN URLs name a full `x.y.z` version, because no lockfile protects them. npm packages use a caret range, and `package-lock.json` fixes the resolved version.
7. **Stable tool majors.** Build tools stay on their current major version unless an advisory or an engine requirement forces a change.

## Standing Constraints

These constraints limit upgrades until their release condition is met.

- **Mermaid stays on the 11.x line** while `engines.vscode` is `^1.85.0`. Mermaid 12 sets its baseline to ES2024 and Safari 17.4. VS Code 1.85 embeds an older Chromium, so a diagram could fail to render for users on that release. Mermaid 12 also changes the default layout (ELK) and theme, which alters how every existing diagram looks. Release condition: raise `engines.vscode` to a version whose Chromium meets the Mermaid 12 baseline, then review `examples/test.md` diagrams visually.
- **`@types/vscode` is pinned to the exact minimum in `engines.vscode`.** The type package then cannot suggest an API that the minimum supported VS Code lacks, and `vsce` refuses a type version above the engine. Release condition: change both together.
- **`overrides.uuid` in `package.json`** replaces the `uuid` version that `@azure/identity` (a `vsce` dependency used only for `vsce publish` with Azure credentials) resolves, because the unpatched range has an advisory. The newest `@azure/identity` depends on an `@azure/msal-node` range that has its own advisory, so a plain upgrade does not clear it. Release condition: remove the override when `npm audit` reports 0 without it.

## Review Procedure

Run the review before every release and at least once per quarter.

```bash
npm audit --omit=dev    # shipped dependencies; must report 0 vulnerabilities
npm audit               # whole tree, including build tools
npm outdated            # candidates to compare against the criteria
```

1. Apply `npm update` for in-range tool updates, then `npm audit fix` for remaining advisories. Add an override only when no upgrade path exists, and record it under Standing Constraints.
2. For each CDN library, run `npm view <package> time` to read recent versions and dates, then apply the selection criteria.
3. Change `CDN_VERSIONS` for a qualifying CDN version. Open the F5 dev host and render `examples/test.md`: check Mermaid diagrams, block and inline math, and highlighted code.
4. Read the release notes before crossing a major version, and record any new limit under Standing Constraints.
5. Run `npm test`, which includes lint and the template tests that verify the pinned versions.

## Adding a Dependency

[development.md](development.md) requires a justification for any new npm dependency. Once approved, choose its version with the criteria above and check the bundle size in `dist/` after `npm run build`. A library the webview needs goes into `CDN_VERSIONS` with an exact version, never a floating tag such as `@11`.

## Known Limits

- **No integrity hashes for Mermaid.** The page loads Mermaid with a dynamic ES module import, which cannot carry a Subresource Integrity hash. The exact version pin limits exposure to a changed release but still trusts jsDelivr to serve the pinned file unmodified.
- **Network required for rich rendering.** Diagrams, math, and syntax highlighting load from the CDN on each preview, and they fail to render offline. The outline sidebar and the Markdown itself still work. Bundling the libraries would add several megabytes, mostly Mermaid.
- **MathJax 4 worker message.** MathJax 4 tries to start a Web Worker from a `blob:` URL and the CSP blocks it. MathJax continues without the worker. Allowing `worker-src blob:` would weaken the CSP with no visible benefit, so the console message remains.
