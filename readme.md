# Lightweight Markdown Preview

A small, private Markdown preview for VS Code. It draws Mermaid and D2 diagrams, LaTeX math and highlighted code beside your file, and it follows your color theme.

![A dark VS Code theme showing one document with a D2 network diagram, a Mermaid flowchart and a math formula](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-hero-dark.png)

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

## Install

- **VS Code:**
  - Search for "Lightweight Markdown Preview" in the Extensions view, or for `KunalPathak.lightweight-markdown-preview`.
- **Forks such as Cursor and VSCodium:**
  - Install from [Open VSX](https://open-vsx.org/extension/KunalPathak/lightweight-markdown-preview).
  - Or download the `.vsix` from the [GitHub releases](https://github.com/kanad13/lightweight-markdown-preview/releases) and run **Extensions: Install from VSIX...**.
- **Use it:**
  - Open a Markdown file, then select the eye icon in the editor title bar, or run **Markdown: Show Lightweight Markdown Preview**.
  - The preview updates as you type and follows the file you edit.

## Private by design

- **Your text stays with you:**
  - The preview has no telemetry and no analytics.
  - Your Markdown stays on your machine.
  - D2 diagrams go to the renderer you choose, which can also run on your machine.
- **Locked-down page:**
  - The page runs only scripts that carry a fresh random nonce.
  - The preview escapes every piece of text that it inserts.
- **Restricted Mode:**
  - Workspace Trust is supported, so previews work in untrusted folders.

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
