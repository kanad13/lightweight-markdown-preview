# Decisions

This page is a living record of ideas that were evaluated, what the evidence showed, and where each idea stands. It is not a rulebook and not a backlog. An entry is a judgment at a date. Check its evidence again before you rely on it, and update the entry when the evidence changes.

- **Scheduling:**
  - Nothing here is built until the maintainer approves it.
  - A status of "Recommended" means an evaluation found the idea worth doing. It does not mean approved.
- **Keeping entries current:**
  - Each entry carries a "Last reviewed" date.
  - When you touch the code an entry describes, re-check its claims and update the date or the status.
  - When a change ships, remove its entry and let [CHANGELOG.md](../CHANGELOG.md) and [architecture.md](architecture.md) describe the result.
- **Related pages:**
  - [readme.md](../readme.md) and [architecture.md](architecture.md) describe the features that exist.
  - [CHANGELOG.md](../CHANGELOG.md) lists release history.

## How Ideas Are Judged

Each idea is compared on two measures:

- **Value (the juice):** Does it fix a real failure or add a capability people need?
- **Cost (the squeeze):** What does it add in code, risk, and upkeep?

The project goals set the limits: small, private, and no configuration beyond the one setting that D2 rendering needs.

## Status Meanings

| Status        | Meaning                                                                                |
| :------------ | :------------------------------------------------------------------------------------- |
| Built         | Approved and built on a branch. Remove the entry when the change ships.                |
| Recommended   | Evaluated and worth doing. Waiting for the maintainer's approval.                      |
| Open question | A problem is confirmed, but the right fix needs a maintainer decision.                 |
| Deferred      | The value is real but too small for the current cost. Reopen when the condition holds. |
| Declined      | Conflicts with a project goal. Do not reopen without changing the goal.                |

## Open question

### Raw HTML in documents and the script allowlist

Last reviewed: 2026-10-26.

- **Problem:**
  - [architecture.md](architecture.md) states that a script injected through Markdown lacks the nonce and is blocked. That is true for inline scripts only.
  - The CSP also allows scripts from `https://cdn.jsdelivr.net` by host, and `marked` passes raw HTML through. In a test page, `<script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js">` in Markdown loaded and ran.
  - jsDelivr serves arbitrary npm and GitHub content, so a hostile document can run any script published there.
- **Why the damage is limited today:**
  - The CSP sets no `connect-src`, so scripts cannot make network requests.
  - The page sends no messages to the extension host, so a script has nothing to call.
  - Images can still load from any `https:` host, which the extension already allows.
- **Options:**
  - Correct the architecture text now. This costs nothing and should happen regardless.
  - Replace the host allowlist with `'strict-dynamic'` so that only nonce-carrying scripts load more scripts. This needs a check in a real VS Code webview, because Mermaid loads through a dynamic `import()`.
  - Escape raw HTML in the renderer. This is the simplest, and it breaks documents that use `<details>`, `<kbd>`, or `<img width>`.
- **Reopen when:**
  - Any change adds a message from the page to the extension host. Settle this first, because that channel is what makes a hostile script dangerous.
- **Since D2 support:**
  - `img-src` also admits the configured D2 renderer origin, so a hostile document can make the preview request an image from that one origin. The request is a plain `GET` for an image. No message channel was added.

## Built

### D2 diagrams through a renderer URL

Last reviewed: 2026-10-27. Verdict: scoped pursue, approved by the maintainer. Built on `feat/d2-diagrams`; remove this entry when it ships.

- **What it is:**
  - A `d2` fence renders as an `<img>` whose address points at a Kroki-compatible renderer that the user chooses with `lightweightMarkdownViewer.d2.rendererUrl`.
- **Value:**
  - GitHub and VS Code do not render D2, so authors had no preview.
  - The extension is already the maintainer's tool for diagrams in Markdown.
- **Cost:**
  - About 150 lines of host code, one setting, one command, and one CSP source.
  - No new dependency: Node's `zlib` builds the address.
  - No message from the page to the extension host, so the open question below stays unchanged.
- **Premises checked on 2026-10-27:**
  - Kroki and the d2-renderer image accept `layout-engine`, `sketch`, `pad` and `theme-id` written in the diagram's `d2-config`. A diagram that names `tala` fails on Kroki, which does not bundle it.
  - Kroki returns a D2 compile error as an SVG that shows the message, so an `<img>` displays it. The d2-renderer image answers 400 with text, so the page shows its own failure box instead.
  - The d2-renderer image sends `Cache-Control: public, max-age=31536000, immutable` on success, so an unchanged block keeps its address and the browser can reuse the picture.
  - The `?theme=` query overrides a `theme-id` set inside the D2 source on the d2-renderer image. Both were compared by their colors.
  - The example payload in the d2-renderer README does not inflate, in Python or in Node. The extension's reference vectors come from Python's encoder instead.
- **Choices and why:**
  - Default is an empty URL. A preset such as `https://kroki.io` would send diagram text to a third party before anyone chose it, and a preset `http://localhost:8080` fails for most users. While it is empty, a D2 fence stays the ordinary code block it was before D2 support, with one quiet hint under the first one, so people who never use D2 see no change. An invalid URL shows a warning box instead, because the user did set something.
  - The setting has application scope, so a cloned repository cannot choose where its diagrams go.
  - The renderer origin enters `img-src` and nothing else. `http:` is never allowed as a whole scheme.
  - The renderer URL is the only setting. Layout, sketch style and padding are written in the diagram (`vars: { d2-config: { ... } }`), where D2 already puts them. The same file then draws the same way in the preview, the playground and a teammate's editor, and the extension carries no style choices of its own. An earlier build had `layout` and `sketch` settings; they were removed before release.
  - The extension sends the source as written and adds only `?theme=`, which follows the editor (light 0, dark and high contrast 200). On the d2-renderer image the query replaces a `theme-id` in the diagram.
  - A diagram whose address passes 8,000 characters shows its source and a notice, because common servers refuse longer request lines.
  - Documents with D2 wait 800 ms after an edit instead of 300 ms once a renderer is set.
- **Related:**
  - TALA is open source under D2's MPL-2.0 license and ships with D2 0.9.0, per D2's announcement (checked 2026-10-27). The d2-renderer image has it and Kroki does not.
  - The published d2-renderer image is `linux/amd64` only, so Apple Silicon needs `--platform linux/amd64`. The docs say so.

## Deferred

### A house style prepended to every D2 block

Last reviewed: 2026-10-27.

- **What it is:**
  - The extension adds a `vars` block (a palette, a padding, a layout) in front of each D2 block, as the d2-architect skill describes for a previewer.
- **Why it waits:**
  - D2 merges repeated `vars` blocks (checked on the d2-renderer image), so it would work.
  - It changes what the author wrote, moves compiler line numbers, and adds settings. The extension has no setting for it and the skill does not need one.
- **Reopen when:**
  - The maintainer wants a house look in every preview, or a padding default for all diagrams.

### Fetch D2 diagrams for error messages and POST

Last reviewed: 2026-10-27.

- **What it is:**
  - The page fetches the SVG itself, shows the compiler message when the renderer answers 400, and sends long diagrams with `POST` instead of a long address.
- **Why it waits:**
  - It needs `connect-src` for the renderer origin, and `blob:` in `img-src` if the SVG should still load through an `<img>`. Injecting the SVG into the page would let SVG scripts run and needs a sanitizer.
  - It needs the renderer to allow cross-origin reads. The d2-renderer image does, and a Kroki-compatible server may not.
  - The image path already shows the failure box, the source, and Kroki's own error pictures.
  - It relates to the question under [Open question](#open-question), because a script on the page could then reach the renderer.
- **Reopen when:**
  - Users hit the 8,000-character limit, or ask for the compiler message in the preview.

### Bundled D2 through WebAssembly

Last reviewed: 2026-10-27.

- **What it is:**
  - The `@terrastruct/d2` package renders D2 inside the extension with no server.
- **Why it waits:**
  - Version 0.1.33 from August 2025 is 59.8 MB unpacked, which contradicts the lightweight goal. The architecture rules also exclude bundled webview scripts.
  - It offers dagre and ELK, not TALA.
  - A local Docker container already keeps diagrams on the machine.
- **Reopen when:**
  - Many users cannot run Docker or reach a renderer, and the package size falls or the maintainer accepts the cost.

### Editor and preview scroll sync

Last reviewed: 2026-10-26.

- **What it is:**
  - Scrolling the editor scrolls the preview to the matching place, and scrolling the preview scrolls the editor.
- **Decision:**
  - Build both directions or neither. Editor-to-preview alone would feel half-finished and could confuse people who expect the reverse.
- **Why it waits:**
  - The preview needs a source line for every rendered block. The renderer now runs on the `marked` token stream, and a probe showed that summing the newlines in each token's `raw` text gives the line of every top-level block. Headings already record it as `lineIndex`. Tagging every block is the remaining step.
  - Preview-to-editor needs a message from the page to the extension host. That is a new input path, so it needs the CSP question above settled and a security review, and the host must accept only a whole-number line.
  - Both directions need loop guards, so that a programmatic scroll does not trigger the reverse scroll.
  - Mermaid and MathJax change block heights after the first render, so positions are measured at scroll time. A long code block needs interpolation between its first and last line.
  - The page script has no automated tests, so the manual smoke check grows.
  - Nobody has asked for it. The one open issue is about math.
- **Reopen when:**
  - The maintainer or a user asks for sync.

### Update the page without replacing it

Last reviewed: 2026-10-26.

- **What it is:**
  - Send new HTML to the open page with `postMessage` and typeset in place, instead of replacing the whole page on every edit.
- **Why it waits:**
  - Today's approach works. It restores the scroll position through the webview state API, a MathJax-ready promise, and a four-second timeout.
  - The in-place update removes that workaround and any flicker, but it adds an untested page script and a message channel.
- **Reopen when:**
  - Scroll sync or Markdown-link navigation is approved, because both need the same channel.

### Images outside the workspace

Last reviewed: 2026-10-26.

- **What it is:**
  - Images beside a Markdown file outside every open workspace folder do not load.
  - The webview may read only the folders listed when the panel opens.
- **Why it waits:**
  - A fix recreates the panel whenever the file moves to a new folder, which flashes the preview.
  - Files outside a workspace are uncommon.
- **Reopen when:**
  - A user reports it.

### Links to other Markdown files

Last reviewed: 2026-10-26.

- **What it is:**
  - Clicking `[guide](other.md)` opens that file.
- **Why it waits:**
  - It needs a message from the webview to the extension, which opens a new input path to the extension host.
  - The extension then has to validate every target path.
- **Reopen when:**
  - A concrete workflow needs it.
  - Plan it together with scroll sync and the CSP question, since all three share the message channel.

## Declined

| Idea                                                      | Reason                                                                                                                                   |
| :-------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle Mermaid, MathJax, and highlight.js for offline use | Mermaid alone adds several megabytes, which contradicts the lightweight goal, and the architecture rules exclude bundled webview scripts |
| Export to HTML or PDF                                     | Other extensions cover it, and it needs a heavy dependency or a headless browser                                                         |
| User settings for fonts, themes, or width                 | The preview follows the VS Code theme, and settings exist only where the user must choose something, as with the D2 renderer             |
| A preset D2 renderer URL as the default                   | It would send diagram text to a service the user never chose, or fail on a port that most machines do not serve                          |
