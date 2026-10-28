# Lightweight Markdown Preview: Mermaid, D2 and Math in VS Code

A fast, private Markdown preview for VS Code, built for people who draw diagrams in Markdown. It renders **Mermaid** (GitHub and Azure DevOps syntax), **D2**, **LaTeX math** (MathJax) and **highlighted code** beside your file, follows your color theme, and sends no telemetry. The package is about 100 KB.

![A dark VS Code theme showing one document with a D2 network diagram, a Mermaid flowchart and a math formula](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-hero-dark.png)

## Why use it

- **D2 diagrams:**
  - [D2](https://d2lang.com) describes architecture, sequence and database diagrams as text. GitHub and VS Code's built-in preview do not draw it, and this extension does.
  - You choose the renderer: a Docker container on your own machine, the public Kroki service, or your own server.
- **Mermaid for GitHub and Azure DevOps:**
  - It draws both the backtick fence and the `::: mermaid` block, so one source previews the same way for either platform.
- **Math and code:**
  - Inline and block LaTeX through MathJax, and syntax highlighting for fenced code.
  - Prices such as "$5 and $10" and shell variables such as `$HOME` stay text.
- **Private and locked down:**
  - No telemetry or analytics, and your Markdown stays on your machine.
  - The preview page runs only its own scripts, so a script in a Markdown file you open from the internet does not run. [Details below](#private-and-secure-by-design).
- **Small and focused:**
  - One setting, no plugins, one runtime dependency. It does one job: preview Markdown.

## Install

- **VS Code:**
  - Search for "Lightweight Markdown Preview" in the Extensions view, or for `KunalPathak.lightweight-markdown-preview`.
- **Forks such as Cursor and VSCodium:**
  - Install from [Open VSX](https://open-vsx.org/extension/KunalPathak/lightweight-markdown-preview).
  - Or download the `.vsix` from the [GitHub releases](https://github.com/kanad13/lightweight-markdown-preview/releases) and run **Extensions: Install from VSIX...**.
- **Use it:**
  - Open a Markdown file, then select the eye icon in the editor title bar, or run **Markdown: Show Lightweight Markdown Preview**.
  - The preview updates as you type and follows the file you edit.

## Diagrams

### Mermaid

- **Two syntaxes:**
  - GitHub reads Mermaid from backtick fences.
  - Azure DevOps reads it from `::: mermaid` blocks.
  - The preview draws both, so you keep one source and check it before you publish to either.

![The same Mermaid sequence diagram drawn from a GitHub-style fence and from an Azure DevOps-style block](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-mermaid-two-syntaxes.png)

### D2

- **What D2 is:**
  - [D2](https://d2lang.com) describes architecture diagrams as text.
  - It handles nested containers, database tables, sequence diagrams and class diagrams.
- **What the preview does:**
  - GitHub and VS Code do not draw D2, so the preview draws each ` ```d2 ` fence for you.
  - A renderer that you choose does the drawing. A Docker container on your own machine works well.
- **How to start:**
  - Run **Markdown: Choose D2 Renderer** once.
  - Follow the [D2 guide](docs/d2.md) for the setup steps and more examples with their source.

![A D2 diagram of a cloud network, drawn in the preview: users, a CDN, a load balancer, two availability zones with app servers and a replicated database, and a VPN to a data center](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-d2-network.png)

## Math and code

- **Math:**
  - Write inline math as `$x_n$` and block math as `$$ ... $$`.
  - Dollar signs that are not math stay text, so "costs $5 and $10" and `echo $HOME` render as written.
- **Code:**
  - Fenced code is highlighted.

![A light theme showing a load formula and a highlighted Python function](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-math-and-code-light.png)

## Outline

- **Sidebar:**
  - The ☰ button opens a collapsible outline.
  - The outline follows where you read.
- **Links:**
  - A link such as `[intro](#intro)` scrolls to its heading.

![The outline sidebar listing the headings of a document](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-outline-sidebar.png)

## Themes

- **Follows VS Code:**
  - Text, code and diagrams use the active color theme: light, dark or high contrast.
  - The preview redraws when you change the theme.

| Dark                                                                                                                                                           | Light                                                                                                                                                            |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![A Mermaid flowchart and a formula in a dark theme](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-theme-dark.png) | ![A Mermaid flowchart and a formula in a light theme](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-theme-light.png) |

## Private and secure by design

A Markdown file can hold HTML, so the preview treats every file as untrusted, including one from a cloned repository or an email attachment.

- **Your text stays with you:**
  - No telemetry, no analytics and no accounts.
  - Your Markdown stays on your machine. D2 diagrams go only to the renderer you choose, and you can run it on your machine.
  - The renderer setting is a user setting, so a repository cannot point your diagrams at its own server.
- **Only the preview's own scripts run:**
  - The page runs a script only if it carries a fresh random nonce for that render, or if such a script loads it. A `<script>` tag, an inline handler or a `javascript:` link in a document does not run, whatever address it names.
  - The preview escapes every piece of text that it inserts, and Mermaid runs at its strict security level.
  - Frames, plugins, form submits and `<base>` redirects are blocked. The page sends no `Referer` header.
  - Harmless HTML such as `<details>`, `<kbd>` and sized `<img>` tags still works.
- **What it does not hide:**
  - A remote image in a document is fetched from its host, which sees your IP address. That is how remote images work, so open files from sources you do not trust with that in mind.
  - Mermaid and MathJax load from jsDelivr at pinned versions, so an offline machine shows their source text instead of the drawing.
- **Restricted Mode:**
  - Workspace Trust is supported, so previews work in untrusted folders.
- **Check it:**
  - [architecture.md](docs/architecture.md) explains the security model, and tests load the real page in a browser against hostile documents.

## Not included

- **Settings:**
  - There are no themes, plugins or font settings.
  - The one setting is the D2 renderer.
- **Other features:**
  - Export to HTML or PDF.
  - Scroll sync between editor and preview.
  - Opening other Markdown files from links.

## Contribute

- **Understand the design:**
  - [architecture.md](docs/architecture.md) explains the design and the security model.
  - [decisions.md](docs/decisions.md) lists ideas that were evaluated.
- **Build and test:**
  - [development.md](docs/development.md) covers setup and publishing.
  - [dependencies.md](docs/dependencies.md) sets the rules for versions.
  - [testing.md](docs/testing.md) maps each workflow to its checks.
- **Work with agents and siblings:**
  - [workflows.md](docs/workflows.md) maps each kind of request to its steps.
  - [AGENTS.md](AGENTS.md) holds the shared instructions for AI agents.
  - [sibling-extensions.md](docs/sibling-extensions.md) lists the other extensions published as KunalPathak.
- **Follow changes:**
  - [CHANGELOG.md](CHANGELOG.md) lists changes by version.

Licensed under the [MIT License](LICENSE).
