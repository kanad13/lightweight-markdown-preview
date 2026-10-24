# Feature Decisions

This page records ideas that were evaluated and are **not implemented**. Each entry gives the reason and the condition that would justify reopening it. The page is a decision log, not a backlog.

- **Scheduling:**
  - No entry is scheduled.
  - Implement an entry only when the maintainer asks for it.
- **Related pages:**
  - [readme.md](../readme.md) and [architecture.md](architecture.md) describe the features that exist.
  - [CHANGELOG.md](../CHANGELOG.md) lists release history.

## How Ideas Are Judged

Each idea is compared on two measures:

- **Value:** Does it fix a real failure or add a capability people need?
- **Cost:** What does it add in code, risk, and upkeep?

The project goals set the limits: small, private, and zero configuration.

## Status Meanings

| Status                  | Meaning                                                                            |
| :---------------------- | :--------------------------------------------------------------------------------- |
| Worthwhile, unscheduled | Value justifies the cost. Waiting for the maintainer to ask.                       |
| Deferred                | Value is real but too small for the current cost. Reopen when the condition holds. |
| Declined                | Conflicts with a project goal. Do not reopen without changing the goal.            |

## Worthwhile, Unscheduled

### Reliable heading anchors

- **Problem:**
  - Heading IDs include a line number (`heading-intro-12`), so a link such as `[see intro](#intro)` does not scroll to its heading.
  - A regular expression finds headings, and it ignores setext headings (a title underlined with `====`).
  - Formatted headings such as `## **Bold** text` show raw characters in the outline.
- **Approach:**
  - Read headings from the `marked` token stream.
  - Generate GitHub-style slugs, with a numeric suffix for duplicates.
  - The outline and the rendered headings then share one source.
- **Cost:**
  - Medium. `extractHeadings()` and its tests change.

## Deferred

### Editor-to-preview scroll sync

- **What it is:**
  - Scrolling the editor scrolls the preview to the matching place, and the reverse.
- **Why it waits:**
  - The preview must know which source line produced each rendered element.
  - Mermaid and math blocks are swapped for placeholders before parsing, and `marked` reflows the rest, so no line mapping exists.
  - A mapping needs every rendered block tagged with its source line, plus two-way messages between the editor and the webview.
  - The messages are a new channel for the security review to cover.
  - Scroll position already survives edits, which removes the most frequent annoyance.
- **Reopen when:**
  - Heading anchors are rebuilt on the token stream, because that work produces the line mapping.

### Images outside the workspace

- **What it is:**
  - Images beside a Markdown file outside every open workspace folder do not load.
  - The webview may read only the folders listed when the panel opens.
- **Why it waits:**
  - A fix recreates the panel whenever the file moves to a new folder, which flashes the preview.
  - Files outside a workspace are uncommon.
- **Reopen when:**
  - A user reports it.

### Links to other Markdown files

- **What it is:**
  - Clicking `[guide](other.md)` opens that file.
- **Why it waits:**
  - It needs a message from the webview to the extension, which opens a new input path to the extension host.
  - The extension then has to validate every target path.
- **Reopen when:**
  - A concrete workflow needs it.
  - Plan it together with scroll sync, since both add the message channel.

## Declined

| Idea                                                      | Reason                                                                                                                                   |
| :-------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle Mermaid, MathJax, and highlight.js for offline use | Mermaid alone adds several megabytes, which contradicts the lightweight goal, and the architecture rules exclude bundled webview scripts |
| Export to HTML or PDF                                     | Other extensions cover it, and it needs a heavy dependency or a headless browser                                                         |
| User settings for fonts, themes, or width                 | The project promises zero configuration, and the preview already follows the VS Code theme                                               |
