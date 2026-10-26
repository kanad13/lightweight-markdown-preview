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

The project goals set the limits: small, private, and zero configuration.

## Status Meanings

| Status        | Meaning                                                                                |
| :------------ | :------------------------------------------------------------------------------------- |
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

## Deferred

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
| User settings for fonts, themes, or width                 | The project promises zero configuration, and the preview already follows the VS Code theme                                               |
