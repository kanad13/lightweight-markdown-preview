# Lightweight Markdown Preview

A small, private Markdown preview for VS Code. It draws Mermaid and D2 diagrams, LaTeX math and highlighted code beside your file, follows your color theme, and sends no telemetry.

![A dark VS Code theme showing one document with a D2 network diagram, a Mermaid flowchart and a math formula](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-hero-dark.png)

## Diagrams

### Mermaid, in GitHub and Azure DevOps syntax

GitHub reads Mermaid from backtick fences, and Azure DevOps reads it from `::: mermaid` blocks. Neither renders the other's syntax. The preview draws both, so you keep one source and check it before you publish to either.

![The same Mermaid sequence diagram drawn from a GitHub-style fence and from an Azure DevOps-style block](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-mermaid-two-syntaxes.png)

### D2

[D2](https://d2lang.com) describes architecture diagrams as text: nested containers, database tables, sequence and class diagrams. GitHub and VS Code do not draw it, so the preview draws each ` ```d2 ` fence for you, through a renderer that you choose, such as a Docker container on your own machine.

![A D2 diagram of a cloud network, drawn in the preview: users, a CDN, a load balancer, two availability zones with app servers and a replicated database, and a VPN to a data center](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-d2-network.png)

Run **Markdown: Choose D2 Renderer** once to set it up. The [D2 guide](docs/d2.md) has the three setup steps, more examples with their source, and the answers to everything else.

## Math and code

Write inline math as `$x_n$` and block math as `$$ ... $$`. Dollar signs that are not math stay text, so "costs $5 and $10" and `echo $HOME` render as written. Fenced code is highlighted.

![A light theme showing a load formula and a highlighted Python function](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-math-and-code-light.png)

## Outline

The ☰ button opens a collapsible outline that follows where you read. Links such as `[intro](#intro)` scroll to their heading.

![The outline sidebar listing the headings of a document](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-outline-sidebar.png)

## Themes

Text, code and diagrams follow the VS Code color theme, light, dark or high contrast, and redraw when you change it.

| Dark                                                                                                                                                           | Light                                                                                                                                                            |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![A Mermaid flowchart and a formula in a dark theme](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-theme-dark.png) | ![A Mermaid flowchart and a formula in a light theme](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-theme-light.png) |

## Install

Search for "Lightweight Markdown Preview" in the Extensions view, or for `KunalPathak.lightweight-markdown-preview`. Cursor, VSCodium and other forks read [Open VSX](https://open-vsx.org/extension/KunalPathak/lightweight-markdown-preview), and the [GitHub releases](https://github.com/kanad13/lightweight-markdown-preview/releases) carry a `.vsix` for **Extensions: Install from VSIX...**.

Then open a Markdown file and select the eye icon in the editor title bar, or run **Markdown: Show Lightweight Markdown Preview**. The preview updates as you type and follows the file you edit.

## Private by design

- No telemetry and no analytics.
- Your document text stays on your machine. The only requests are for the Mermaid, MathJax and highlight.js libraries from jsDelivr, and, for D2, for diagrams to the renderer you choose, which can run on your machine.
- A Content Security Policy runs only scripts that carry a per-render nonce, and the preview escapes what it inserts.
- Workspace Trust is supported, so previews work in Restricted Mode.

## Not included

- Themes, plugins and font settings. The one setting is the D2 renderer.
- Export to HTML or PDF.
- Scroll sync between editor and preview, and opening other Markdown files from links.

## Contribute

- [architecture.md](docs/architecture.md) explains the design and the security model.
- [development.md](docs/development.md) covers setup and publishing, and [dependencies.md](docs/dependencies.md) sets the rules for versions.
- [testing.md](docs/testing.md) maps each workflow to its checks.
- [workflows.md](docs/workflows.md) maps each kind of request to its steps, and [AGENTS.md](AGENTS.md) holds the shared instructions for AI agents.
- [decisions.md](docs/decisions.md) lists ideas that were evaluated, and [CHANGELOG.md](CHANGELOG.md) lists changes by version.
- [sibling-extensions.md](docs/sibling-extensions.md) lists the other extensions published as KunalPathak.

Licensed under the [MIT License](LICENSE).
