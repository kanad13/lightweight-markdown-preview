# Testing Strategy

This page is the canonical testing guide. It maps each user workflow to the check that proves it, lists the commands, and says when to run each check. Update it whenever a workflow, contract, or tool changes.

## Overview

The extension has two halves, and each half has its own kind of check.

- **Extension host code** (`src/extension.js`):
  - Pure functions and event handling run under Node with a fake `vscode` module.
  - Automated tests cover this half, including the D2 address, the renderer URL validation and the CSP that admits the renderer.
- **Webview page** (`src/webview.html`):
  - Browser scripts render diagrams, math, the outline sidebar, and scroll restore from CDN libraries.
  - A manual smoke check covers this half, because it needs a real browser, a real webview, and network access.
  - A generated set of static pages (`test/visual/build-visual-check.js`) shows the extension's real output in a browser, so you can judge diagrams, themes and failures by eye.
- **Packaged artifact** (`dist/extension.js`, `.vsix`):
  - An automated smoke test loads the webpack bundle.
  - A manual install of the `.vsix` confirms the artifact in a real editor.

## Commands

| Command                                        | What it does                                                                                                                                | When to run                                                    |
| :--------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------- |
| `npm test`                                     | Builds the bundle, runs every automated test, then lints. The runner takes a quoted glob, so Node expands it the same way on every platform | Before every commit                                            |
| `node --test test/lifecycle.test.js`           | Runs one suite without a build (the bundle suite needs `dist/` to exist)                                                                    | While developing a handler                                     |
| `npm audit --omit=dev`                         | Checks shipped dependencies for advisories                                                                                                  | Before every release, and CI                                   |
| `npm run package`                              | Builds the `.vsix`                                                                                                                          | Before manual install checks                                   |
| `D2_RENDERERS=... npm run test:live`           | Draws test diagrams through real D2 renderers with the addresses the extension emits. Needs the network and a running container             | Before a release, and after a change to the address or options |
| `test/real-window/run.sh <label> <executable>` | Drives a real VS Code window through the preview. Needs the d2-renderer container                                                           | Before a release, in Stable and the `engines.vscode` floor     |

## Automated Suites

| File                          | Scope                                                                                                                                                                                                                                                                                                                       | Fake used                                        |
| :---------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------- |
| `test/extension.test.js`      | Pure functions: heading extraction and IDs, outline tree, escaping, math, Mermaid and image handling, nonce, template substitution, page contract                                                                                                                                                                           | `.html` loader and `vscode` shim                 |
| `test/lifecycle.test.js`      | Command, active-editor following, debounce, disposal, theme change, image paths (including `%20` and raw HTML), error notification                                                                                                                                                                                          | Fake panel, mock timers                          |
| `test/bundle.test.js`         | The webpack output renders a complete page with CSP, pinned CDN versions, and no unreplaced placeholders                                                                                                                                                                                                                    | Fake `vscode` only                               |
| `test/d2.test.js`             | D2: address encoding that inflates to the source and matches the reference header (Node versions differ in compressed bytes), renderer URL validation, fence detection, notices, the CSP that admits the renderer, hostile input, settings, theme mapping, the quick-pick command, the debounce, manifest and page contract | `.html` loader and `vscode` shim                 |
| `test/images.test.js`         | Every readme image is wide enough, small enough, and has no ink on its edge ring, which is what a cut-off picture looks like                                                                                                                                                                                                | None                                             |
| `test/live/renderers.live.js` | Opt-in. Real renderers draw plain, nested, table, sequence and Unicode diagrams; the theme, and the sketch, ELK and TALA options written in the diagram, change the picture; a syntax error is an error                                                                                                                     | Needs `D2_RENDERERS`                             |
| `test/security.test.js`       | The CSP text, and the CSP in headless Chrome: hosted, unclosed, upper-case, SVG and inline scripts, handlers and `javascript:` links do not run; forms, `<base>`, frames and objects are shut; no `Referer`; math, Mermaid and highlight.js still work                                                                      | Chrome (skips without it); CDN for the last test |
| `test/real-window/run.sh`     | Not a suite: a script that drives a real VS Code window (see Real-Window Check)                                                                                                                                                                                                                                             | Real VS Code                                     |
| `test/guide-svgs.test.js`     | Each D2 block in `docs/d2.md` has a pre-drawn SVG that records the hash of its source, holds no script, and follows the light or dark scheme                                                                                                                                                                                | None                                             |
| `test/docs.test.js`           | Relative links and heading anchors in every Markdown file; the routing table in `AGENTS.md` matches `docs/workflows.md`; readme images use absolute raw URLs, exist in `assets/`, and have alt text                                                                                                                         | None                                             |
| `test/helpers/fake-vscode.js` | Shared `vscode` and `.html` shims, handler capture, fake documents and panel                                                                                                                                                                                                                                                | Not a suite                                      |

## Workflow Map

| Workflow                                                | Evidence                                                                                                                                                                           | Gap                                                      |
| :------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| Run the command on a Markdown file                      | `lifecycle`: renders the file; errors for no editor and non-Markdown                                                                                                               | None                                                     |
| Edit the file and see the preview update                | `lifecycle`: debounce at 300 ms, rapid edits collapse, other files ignored                                                                                                         | None                                                     |
| Close the panel                                         | `lifecycle`: pending update cancelled, later events ignored                                                                                                                        | None                                                     |
| Switch to another Markdown file                         | `lifecycle`: preview follows; ignores no-editor, non-Markdown, `git` scheme, same file                                                                                             | Scroll reset is manual (see below)                       |
| Change the VS Code color theme                          | `lifecycle`: Mermaid and highlight.js themes switch                                                                                                                                | Visual result is manual                                  |
| Show local and remote images                            | `lifecycle`: relative, parent, workspace-root, `https`, `data`, `%20` and raw HTML paths                                                                                           | Loading through a real webview is manual                 |
| Hostile document text                                   | `extension`: escaping of outline, math, Mermaid; placeholder-like text in content. `security`: the CSP in headless Chrome, with a mutation check that the old policy fails         | VS Code's own enforcement is manual (see Security Check) |
| Inline and block math, Mermaid, code                    | `extension`: dollar signs in code and prices stay text, formulas and diagrams reach the libraries as `\(..\)`, `\[..\]` and `pre.mermaid`; heading IDs match anchors               | Rendering in the browser is manual                       |
| Open a document with a D2 fence and no renderer         | `d2`: the fence stays an ordinary code block, one hint under the first, no image, no CSP change                                                                                    | None                                                     |
| Existing users who never use D2                         | `d2`: documents without D2 render identically whatever the D2 settings; the CSP is the same whatever D2 is set to; the 300 ms wait stays; no prompts, messages or foreign settings | None                                                     |
| Readme screenshots are readable and not cut off         | `images`: size limits and an empty edge ring; the rest is review by eye                                                                                                            | Legibility is a human judgment                           |
| Draw a D2 diagram                                       | `d2`: fences in every container, encoding, theme; the source is sent unchanged; notices for no renderer, a bad URL, an empty block and a block too large for a URL                 | A renderer's real output is manual (see below)           |
| Choose or change the D2 renderer                        | `d2`: the quick-pick stores a normalized value in user settings; a setting change redraws the open preview; the origin enters `img-src` only                                       | The custom URL input box is untested in a real window    |
| Hostile D2 source or renderer URL                       | `d2`: no script, no attribute break-out, no extra CSP directive                                                                                                                    | None                                                     |
| Bundled extension starts and renders                    | `bundle`: complete page from `dist/extension.js`                                                                                                                                   | Install in a real editor is manual                       |
| Documents agree with each other                         | `docs`: links, anchors, and task routing resolve                                                                                                                                   | Claims about behavior are manual (Sync)                  |
| Outline sidebar, in-page links, scroll save and restore | Page contract: sidebar wired before the Mermaid import                                                                                                                             | Behavior is the manual smoke check                       |

## Manual Smoke Check

Run this check before a release and after any change to `src/webview.html`. Use the F5 dev host or an installed `.vsix`, and open `examples/test.md`. Run it in VS Code Stable, which most users run, and before a release also in the lowest version that `engines.vscode` allows. A run in Insiders is provisional evidence only.

1. Confirm that block math, inline math, and both Mermaid syntaxes render. Add a line with `` `echo $HOME $PATH` `` and "costs $5 and $10" and confirm both stay plain text.
2. Confirm that code blocks are highlighted.
3. Open the outline sidebar, select a heading, and confirm the page scrolls to it. Select an in-page link such as `[end](#the-end)` and confirm it scrolls too. Open the sidebar while diagrams are still loading and confirm it responds.
4. Scroll down, type in the editor, and confirm the preview keeps its position.
5. Open a second Markdown file in another tab. Confirm the preview switches and starts at the top.
6. Switch the VS Code color theme. Confirm diagrams and code colors follow it.
7. Open Developer Tools and confirm the only console error is the blocked MathJax worker message.
8. D2, with a renderer running and `docs/d2.md` open. The renderer is the container from the d2-renderer README, started by the maintainer: `docker run -d --name d2-test --platform linux/amd64 -p 8080:8080 ghcr.io/kanad13/d2-renderer:latest`, used as `http://localhost:8080`. If no container is running, ask the maintainer to start one; do not build one yourself.
   - Run **Markdown: Choose D2 Renderer** and pick the local container. Confirm the diagrams appear and the hint under the code block disappears.
   - Edit one D2 block and confirm that only that block asks the renderer for a new picture (the container log shows one `GET`) and that the scroll position stays.
   - Break a block on purpose and confirm that a message and the source replace it while the other diagrams stay.
   - Switch between a light and a dark theme and confirm that the diagrams change theme.
   - Clear the setting and confirm that D2 fences are plain code blocks with one hint line.
   - Set the renderer to `http://localhost:9` and confirm that every D2 block shows the failure message and no broken-image icon.

## Real-Window Check

`test/real-window/run.sh` drives a real VS Code window: it loads the extension and a small driver extension, opens documents, edits, changes themes and settings, and reads the preview page over the DevTools protocol. It covers what the fakes cannot: the real CSP, theme mapping, file access, Restricted Mode and the quick pick.

```bash
npm run build
test/real-window/run.sh stable "/path/to/Visual Studio Code.app/Contents/MacOS/Code"
test/real-window/run.sh v105 "/path/to/VS Code 1.105.0/Visual Studio Code.app/Contents/MacOS/Electron"
```

- **Builds:** run it in VS Code Stable, and before a release in the `engines.vscode` floor. Builds before about 1.106 name the executable `Electron`. Insiders results are provisional.
- **Renderer:** it needs the d2-renderer container on `http://localhost:8080`. Ask the maintainer to start it.
- **Profile folder:** it uses `~/.lmpv` (set `LMP_HOME` to change it), because VS Code's socket path must stay under about 100 characters.
- **Last run:** 2026-10-27, VS Code Stable 1.143.1 and 1.105.0, every line passed. A line that reports `requests +1` after one D2 edit and `+0` after a prose edit proves that only the changed diagram asks the renderer again.

## Security Check

`test/security.test.js` proves the policy in Chrome. VS Code's webview differs: it rewrites the CSP and does not enforce `form-action`. So after any change to the CSP or the page script, run the real-window method above with a document that holds the payloads, and read the result with `test/real-window/cdp.js`.

- A `<script src>` to jsDelivr, in a block and after text, leaves `typeof window.jQuery` at `undefined`.
- Math, Mermaid and highlight.js still draw (`mjx-container`, `.mermaid svg`, `code.hljs` each count 1).
- `<details>` with `<kbd>` still renders.
- Clicking the button of a raw `<form>` leaves the preview in place.

- **Last run:** 2026-10-28, VS Code Insiders only, so the result is provisional. Run it in Stable before the release.

## Guide Pictures

`docs/d2.md` shows each D2 source with a pre-drawn SVG copy in `docs/d2/`, because GitHub drops inline `<svg>` tags from Markdown and shows an image that points at a file. After you edit a D2 block in the guide, redraw its picture with the container running:

```bash
node test/visual/render-guide-svgs.js http://localhost:8080
```

`test/guide-svgs.test.js` fails until you do.

## Visual Check

`test/visual/build-visual-check.js` writes the extension's real page for each combination of renderer, document, theme and D2 option. Renderer URLs are arguments, so none is stored in the repository.

```bash
node test/visual/build-visual-check.js /tmp/lmp-visual --renderer docker=http://localhost:8080 --renderer dead=http://localhost:9 --doc docs/d2.md
python3 -m http.server 8099 --directory /tmp/lmp-visual
```

Open `http://localhost:8099/index.html` and judge the pages by eye. `test/visual/capture.js` takes a screenshot that ends between blocks, so a crop never slices through a heading or a diagram:

- Every diagram is a picture. No page shows a broken-image icon.
- No label is clipped or overlaps another.
- The `option-elk`, `option-tala` and `option-sketch` pages look different from `option-default`.
- Dark and high-contrast pages use the dark D2 theme.
- The browser console shows no CSP violation except the blocked MathJax worker.

Use `--only` and `--themes` to keep a run small when the renderer is a shared service.

## Live Renderer Check

Run it against the local container and against Kroki before a release:

```bash
D2_RENDERERS="docker=http://localhost:8080,kroki=https://kroki.io" D2_TALA_RENDERERS=docker npm run test:live
```

- **The container:** the maintainer starts it from the d2-renderer README. Ask for it; do not build your own.
- **Kroki:** it sits behind Cloudflare, which refuses scripts that send the default User-Agent (error 1010). The test sends a browser-like one.
- **Known renderer defect:** the d2-renderer image answers a syntax error with 400 and puts the multi-line compiler message in the HTTP reason phrase. Strict clients such as Node reject that reply as malformed. Browsers cope, and the preview shows its failure box.

## Defect-Sensitivity Rule

A check proves something only if it can fail. When you add or change a test for a bug fix, break the behavior on purpose and confirm the test fails, then restore the code.

- **Examples that were checked:**
  - Removing `clearTimeout` on disposal fails the disposal test.
  - Removing `clearTimeout` on editor switch fails the stale-update test.
  - Removing the same-document guard fails the no-re-render test.
  - Skipping `escapeHtml` on math fails the escaping tests.
  - Dropping the `git` scheme guard fails the diff test.
  - Dropping the digit rule or the leading-space rule from inline math fails the price tests.
  - Skipping duplicate numbering fails the heading ID tests.
  - Enabling a dollar delimiter in the page template fails the page contract test.
  - Dropping the protocol, credential, query or host check from `parseRendererUrl` fails the URL tests.
  - Skipping `escapeHtml` on D2 source, or allowing `http:` as a whole scheme, fails the hostile-input and CSP tests.
  - Using a `[hidden]` selector in the page's failure handler un-hides the broken image again. The contract test fails on it, and the visual check shows the broken-image icon.
  - A placeholder name with a digit, such as `{{D2_...}}`, is never substituted because the template pattern matches `[A-Z_]+`. The CSP test caught it, so the placeholder is `{{RENDERER_ORIGIN}}`.
  - Removing `decodeURI` from image resolution fails the `%20` test.

## Rules for Changing Tests

- **Never weaken an assertion** to get a green run. Fix the implementation, or confirm the requirement changed first.
- **Reproduce a bug with a failing test** before you fix it.
- **Keep the fakes honest.** When the extension starts using a new `vscode` API, add it to `test/helpers/fake-vscode.js`.
