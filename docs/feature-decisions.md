# Feature Decisions

This page records ideas that were evaluated and are **not implemented**, with the reason and the condition that would justify reopening each. It is a decision log, not a backlog: no entry is scheduled, and nobody should implement one unless the maintainer asks for it.

Features that exist are described in [readme.md](../readme.md) and [architecture.md](architecture.md). Release history is in [CHANGELOG.md](../CHANGELOG.md).

## How Ideas Are Judged

Each idea is compared on value to users (does it fix a real failure or add a capability people need) and cost (code, risk, and upkeep). The project goals set the limits: small, private, and zero configuration.

## Status Meanings

| Status                  | Meaning                                                                            |
| :---------------------- | :--------------------------------------------------------------------------------- |
| Worthwhile, unscheduled | Value justifies the cost. Waiting for the maintainer to ask.                       |
| Deferred                | Value is real but too small for the current cost. Reopen when the condition holds. |
| Declined                | Conflicts with a project goal. Do not reopen without changing the goal.            |

## Worthwhile, Unscheduled

### Reliable heading anchors

Heading IDs include a line number (`heading-intro-12`), so an author-written link such as `[see intro](#intro)` does not scroll to its heading. Headings are found with a regular expression that ignores setext headings (a title underlined with `====`) and shows raw characters for formatted headings such as `## **Bold** text`.

The fix reads headings from the `marked` token stream and generates GitHub-style slugs, with a numeric suffix for duplicates. The TOC and the rendered headings then share one source. The change is medium-sized because `extractHeadings()` and its tests change.

## Deferred

### Editor-to-preview scroll sync

**What it is.** Scrolling the editor scrolls the preview to the matching place, and the reverse.

**Why it waits.** The preview has to know which source line produced each rendered element. Mermaid and math blocks are swapped for placeholders before parsing, and `marked` reflows the rest, so no line mapping exists today. Building one means tagging every rendered block with its source line and adding two-way messages between the editor and the webview. Messages are a new channel for the security review to cover. Scroll position already survives edits, which removes the most frequent annoyance.

**Reopen when.** Heading anchors are rebuilt on the token stream, because that work produces the line mapping.

### Images outside the workspace

**What it is.** Images beside a Markdown file that is not inside an open workspace folder do not load, because the webview may only read folders listed when the panel opens.

**Why it waits.** Fixing it means recreating the panel whenever the file moves to a new folder, which flashes the preview. Files outside a workspace are uncommon.

**Reopen when.** A user reports it.

### Links to other Markdown files

**What it is.** Clicking `[guide](other.md)` opens that file.

**Why it waits.** It needs a message from the webview to the extension, which opens a new input path to the extension host. The extension would then need to validate every target path.

**Reopen when.** A concrete workflow needs it. Plan it together with scroll sync, since both add the message channel.

## Declined

| Idea                                                      | Reason                                                                                                                                   |
| :-------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle Mermaid, MathJax, and highlight.js for offline use | Mermaid alone adds several megabytes, which contradicts the lightweight goal, and the architecture rules exclude bundled webview scripts |
| Export to HTML or PDF                                     | Other extensions cover it, and it needs a heavy dependency or a headless browser                                                         |
| User settings for fonts, themes, or width                 | The project promises zero configuration, and the preview already follows the VS Code theme                                               |
