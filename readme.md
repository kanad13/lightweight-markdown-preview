# Lightweight Markdown Preview

A small, private Markdown preview for VS Code. It renders **Mermaid diagrams**, **LaTeX math** and **highlighted code** beside your file, follows your color theme, and needs no configuration. It sends no telemetry.

![Lightweight Markdown Preview in VS Code: a Markdown note rendered with a math equation, a Mermaid flowchart, highlighted Python code and a table](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-hero-dark.png)

- **Everything in one pane:** headings, lists, tables, images, code, math and diagrams.
- **Live:** the preview updates as you type, keeps your reading position, and follows the Markdown file you are editing.
- **Private:** no telemetry, no analytics, and your text never leaves your machine.
- **Zero settings:** no themes or plugins to manage. The preview matches your VS Code theme.

## Mermaid diagrams, GitHub and Azure DevOps syntax

GitHub reads Mermaid from backtick fences, and Azure DevOps reads it from `::: mermaid` blocks. A diagram written for one does not render on the other. This extension renders both the same way, so you keep one source file and check it before you publish to either platform.

![The same Mermaid sequence diagram rendered from a GitHub-style fence and from an Azure DevOps-style fence in the VS Code Markdown preview](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-mermaid-two-syntaxes.png)

## LaTeX math and syntax-highlighted code

Write inline math as `$x_n$` and block math as `$$ ... $$`, on one line or several. Dollar signs stay plain text when they are not math, so "costs $5 and $10" and `echo $HOME $PATH` render as written.

![A Markdown preview in a light theme showing a Fourier transform equation, a Mermaid flowchart and a highlighted Python code block](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-math-and-code-light.png)

- **Inline math:** `$...$`. The opening `$` must touch the formula, and the closing `$` must not be followed by a digit.
- **Block math:** `$$ ... $$`, with no blank line inside.
- **Code:** fenced blocks are highlighted by highlight.js.

## Outline sidebar

Open the ☰ button for a collapsible outline of the document. It highlights the section you are reading, expands the parents of that section, and scrolls to a heading when you select it. Links such as `[see intro](#intro)` scroll to their heading too.

![The outline sidebar of the Markdown preview, listing the headings of a document with the current section highlighted](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-outline-sidebar.png)

## Light, dark and high-contrast themes

The preview follows the active VS Code color theme, including diagrams and code, and re-renders when you change it.

| Dark theme                                                                                                                                            | Light theme                                                                                                                                             |
| :---------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ![Markdown preview in a dark VS Code theme](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-theme-dark.png) | ![Markdown preview in a light VS Code theme](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-theme-light.png) |

## Install

1. Open the Extensions view in VS Code.
2. Search for "Lightweight Markdown Preview", or for the identifier `KunalPathak.lightweight-markdown-preview`.
3. Select **Install**.

**VS Code forks:** Cursor, VSCodium and similar editors read the [Open VSX](https://open-vsx.org/extension/KunalPathak/lightweight-markdown-preview) registry, where this extension is also published. You can also download the `.vsix` file from the [GitHub releases](https://github.com/kanad13/lightweight-markdown-preview/releases) and run **Extensions: Install from VSIX...**.

**Requirements:**

- VS Code, or a compatible fork, released within the last 12 months.
- Network access to the jsDelivr CDN for diagrams, math and syntax highlighting.

## Use

1. Open a Markdown file.
2. Select the eye icon in the top-right of the editor title bar. You can also open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and run **Markdown: Show Lightweight Markdown Preview**.
3. Edit the file. The preview updates after a short pause.
4. Switch to another Markdown file. The preview switches with you and starts at the top of that file.

## Privacy and security

- **Privacy:**
  - The extension sends no telemetry or analytics.
  - Your document text stays on your machine.
  - jsDelivr sees the requests for the Mermaid, MathJax and highlight.js files, not your content.
- **Security:**
  - A Content Security Policy runs inline scripts only when they carry a per-render random nonce.
  - The extension escapes the text it inserts into the page.
  - Mermaid runs at its strict security level.
  - Workspace Trust is supported, so previews work in Restricted Mode on untrusted repositories without running local code.

## What it does not do

- It has no settings, themes or plugins.
- It does not export to HTML or PDF.
- It does not scroll the editor and the preview together.
- It does not open other Markdown files when you select a link to them.

## Contribute

Start with the documents below. Each one answers a different question.

- **Understand the design:** [architecture.md](docs/architecture.md) explains the structure and the security model.
- **Work with dependencies:** [dependencies.md](docs/dependencies.md) sets the rules for choosing and reviewing versions.
- **Build and release:** [development.md](docs/development.md) covers setup and publishing.
- **Pick a task procedure:** [workflows.md](docs/workflows.md) maps each kind of request to its steps.
- **Find the sibling extensions:** [sibling-extensions.md](docs/sibling-extensions.md) lists the other extensions published as KunalPathak and the files they share.
- **Test:** [testing.md](docs/testing.md) maps workflows to checks and lists the manual smoke check.
- **Check past decisions:** [decisions.md](docs/decisions.md) lists ideas that were evaluated and their status.
- **See what changed:** [CHANGELOG.md](CHANGELOG.md) lists changes by version.
- **Work as an AI agent:** [AGENTS.md](AGENTS.md) holds the shared instructions.

Licensed under the [MIT License](LICENSE).
