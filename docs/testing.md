# Testing Strategy

This page is the canonical testing guide. It maps each user workflow to the check that proves it, lists the commands, and says when to run each check. Update it whenever a workflow, contract, or tool changes.

## Overview

The extension has two halves, and each half has its own kind of check.

- **Extension host code** (`src/extension.js`):
  - Pure functions and event handling run under Node with a fake `vscode` module.
  - Automated tests cover this half.
- **Webview page** (`src/webview.html`):
  - Browser scripts render diagrams, math, the outline sidebar, and scroll restore from CDN libraries.
  - A manual smoke check covers this half, because it needs a real browser, a real webview, and network access.
- **Packaged artifact** (`dist/extension.js`, `.vsix`):
  - An automated smoke test loads the webpack bundle.
  - A manual install of the `.vsix` confirms the artifact in a real editor.

## Commands

| Command                              | What it does                                                                                                                                                | When to run                  |
| :----------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------- |
| `npm test`                           | Builds the bundle, runs every automated test, then lints. The runner takes the `test/` directory, not a glob, because Node 20 does not expand glob patterns | Before every commit          |
| `node --test test/lifecycle.test.js` | Runs one suite without a build (the bundle suite needs `dist/` to exist)                                                                                    | While developing a handler   |
| `npm audit --omit=dev`               | Checks shipped dependencies for advisories                                                                                                                  | Before every release, and CI |
| `npm run package`                    | Builds the `.vsix`                                                                                                                                          | Before manual install checks |

## Automated Suites

| File                          | Scope                                                                                                                   | Fake used                        |
| :---------------------------- | :---------------------------------------------------------------------------------------------------------------------- | :------------------------------- |
| `test/extension.test.js`      | Pure functions: heading extraction, outline tree, escaping, math and Mermaid preservation, nonce, template substitution | `.html` loader and `vscode` shim |
| `test/lifecycle.test.js`      | Command, active-editor following, debounce, disposal, theme change, image paths, error notification                     | Fake panel, mock timers          |
| `test/bundle.test.js`         | The webpack output renders a complete page with CSP, pinned CDN versions, and no unreplaced placeholders                | Fake `vscode` only               |
| `test/docs.test.js`           | Relative links and heading anchors in every Markdown file; the routing table in `AGENTS.md` matches `docs/workflows.md` | None                             |
| `test/helpers/fake-vscode.js` | Shared `vscode` and `.html` shims, handler capture, fake documents and panel                                            | Not a suite                      |

## Workflow Map

| Workflow                                 | Evidence                                                                               | Gap                                      |
| :--------------------------------------- | :------------------------------------------------------------------------------------- | :--------------------------------------- |
| Run the command on a Markdown file       | `lifecycle`: renders the file; errors for no editor and non-Markdown                   | None                                     |
| Edit the file and see the preview update | `lifecycle`: debounce at 300 ms, rapid edits collapse, other files ignored             | None                                     |
| Close the panel                          | `lifecycle`: pending update cancelled, later events ignored                            | None                                     |
| Switch to another Markdown file          | `lifecycle`: preview follows; ignores no-editor, non-Markdown, `git` scheme, same file | Scroll reset is manual (see below)       |
| Change the VS Code color theme           | `lifecycle`: Mermaid and highlight.js themes switch                                    | Visual result is manual                  |
| Show local and remote images             | `lifecycle`: relative, parent, workspace-root, `https`, `data` paths                   | Loading through a real webview is manual |
| Hostile document text                    | `extension`: escaping of outline, math, Mermaid; placeholder text in content           | CSP enforcement is manual                |
| Inline and block math, Mermaid, code     | `extension`: source is preserved for the browser libraries                             | Rendering in the browser is manual       |
| Bundled extension starts and renders     | `bundle`: complete page from `dist/extension.js`                                       | Install in a real editor is manual       |
| Documents agree with each other          | `docs`: links, anchors, and task routing resolve                                       | Claims about behavior are manual (Sync)  |
| Outline sidebar, scroll save and restore | None automated                                                                         | Manual smoke check                       |

## Manual Smoke Check

Run this check before a release and after any change to `src/webview.html`. Use the F5 dev host or an installed `.vsix`, and open `examples/test.md`.

1. Confirm that block math, inline math, and both Mermaid syntaxes render.
2. Confirm that code blocks are highlighted.
3. Open the outline sidebar, select a heading, and confirm the page scrolls to it.
4. Scroll down, type in the editor, and confirm the preview keeps its position.
5. Open a second Markdown file in another tab. Confirm the preview switches and starts at the top.
6. Switch the VS Code color theme. Confirm diagrams and code colors follow it.
7. Open Developer Tools and confirm the only console error is the blocked MathJax worker message.

## Defect-Sensitivity Rule

A check proves something only if it can fail. When you add or change a test for a bug fix, break the behavior on purpose and confirm the test fails, then restore the code.

- **Examples that were checked:**
  - Removing `clearTimeout` on disposal fails the disposal test.
  - Removing `clearTimeout` on editor switch fails the stale-update test.
  - Removing the same-document guard fails the no-re-render test.
  - Skipping `escapeHtml` on math fails the escaping tests.
  - Dropping the `git` scheme guard fails the diff test.

## Rules for Changing Tests

- **Never weaken an assertion** to get a green run. Fix the implementation, or confirm the requirement changed first.
- **Reproduce a bug with a failing test** before you fix it.
- **Keep the fakes honest.** When the extension starts using a new `vscode` API, add it to `test/helpers/fake-vscode.js`.
