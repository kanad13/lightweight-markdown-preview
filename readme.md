# Lightweight Markdown Preview: Mermaid, D2 and Math in VS Code

A Markdown preview for VS Code. It draws D2 diagrams, Mermaid diagrams (GitHub and Azure DevOps syntax), LaTeX math and highlighted code beside your file. It follows your VS Code color theme, adds a collapsible outline sidebar, and collects no telemetry.

![A dark VS Code theme showing one document with a D2 network diagram, a Mermaid flowchart and a math formula](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-hero-dark.png)

## Features

| Feature          | What it does                                                                        | What you gain                                                                                                                                    |
| :--------------- | :---------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| D2 diagrams      | Draws every `d2` fence through a renderer you choose                                | Architecture diagrams stay text in your repository, so they diff in pull requests and AI agents can write them. See [D2 diagrams](#d2-diagrams). |
| Mermaid          | Draws backtick fences (GitHub) and `::: mermaid` blocks (Azure DevOps)              | You check a diagram once and publish it to either platform.                                                                                      |
| LaTeX math       | Draws `$...$` inline and `$$...$$` block formulas with MathJax                      | Prices such as "$5 and $10" and shell variables such as `$HOME` stay text.                                                                       |
| Highlighted code | Colors fenced code by language                                                      | Code samples are easy to scan.                                                                                                                   |
| Outline sidebar  | Lists your headings in a collapsible panel that follows where you read              | You move through long documents quickly, and `[intro](#intro)` links scroll to their heading.                                                    |
| Color themes     | Follows your light, dark or high contrast VS Code theme and redraws when it changes | Text, code and diagrams match your editor.                                                                                                       |
| Script blocking  | Does not run scripts that a Markdown file contains                                  | Files from the internet, email or an unfamiliar repository cannot run code in the preview.                                                       |
| No telemetry     | Collects nothing and needs no account                                               | Your documents and diagrams stay with you.                                                                                                       |

## Install

- **VS Code:**
  - Search for "Lightweight Markdown Preview" in the Extensions view, or for `KunalPathak.lightweight-markdown-preview`.
- **Forks such as Cursor and VSCodium:**
  - Install from [Open VSX](https://open-vsx.org/extension/KunalPathak/lightweight-markdown-preview).
  - Or download the `.vsix` from the [GitHub releases](https://github.com/kanad13/lightweight-markdown-preview/releases) and run **Extensions: Install from VSIX...**.

### First use

1. Open a Markdown file.
2. Select the eye icon in the editor title bar, or run **Markdown: Show Lightweight Markdown Preview**.
3. Edit the file. The preview updates as you type and follows the file you switch to.

## D2 diagrams

[D2](https://d2lang.com) is a text language for architecture diagrams, with nested containers, database tables, sequence diagrams and class diagrams. Text diagrams diff and review like code, and an AI agent can write and revise them. The preview draws each ` ```d2 ` fence as you type.

![A VS Code window with a Markdown file on the left that holds a D2 fence, and the Markdown preview on the right that shows the drawn diagram: a web shop sends an order to an order service, which saves to a database and enqueues to a queue](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-d2-source-and-preview.png)

![A D2 diagram of a cloud network, drawn in the preview: users, a CDN, a load balancer, two availability zones with app servers and a replicated database, and a VPN to a data center](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-d2-network.png)

### Set up a renderer

1. **Start the renderer.** The [d2-renderer](https://github.com/kanad13/d2-renderer) container keeps your diagram text on your machine:

   ```bash
   docker run -d --name d2-renderer -p 8080:8080 ghcr.io/kanad13/d2-renderer:latest
   ```

2. **Choose it.** Run **Markdown: Choose D2 Renderer** and pick **Local Docker container**.

   ![The Choose D2 Renderer quick pick with four choices: a local Docker container, the Kroki public service, another URL, and turning D2 off](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-d2-choose-renderer.png)

3. **Write a `d2` fence.** The diagram appears in the preview.

### Your D2 toolkit

| Piece                                                                                    | What it does                                                                                                             |
| :--------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| [D2 guide](docs/d2.md)                                                                   | Setup, examples with their source and pictures, diagram options and troubleshooting.                                     |
| [d2-renderer](https://github.com/kanad13/d2-renderer)                                    | The container that draws the diagrams. It includes the TALA layout engine, and a runbook deploys it to Google Cloud Run. |
| [d2-architect](https://github.com/kanad13/coherent-output/tree/main/skills/d2-architect) | An agent skill that adds a checked D2 diagram under every heading of a document, without changing your text.             |

## Mermaid, math and code

Mermaid draws from both platform syntaxes, so one source works on GitHub and in Azure DevOps. The sequence diagram below is drawn from a GitHub fence and from an Azure DevOps block.

![The same Mermaid sequence diagram drawn from a GitHub-style fence and from an Azure DevOps-style block](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-mermaid-two-syntaxes.png)

Write inline math as `$x_n$` and block math as `$$ ... $$`. Dollar signs that are not math stay text, so "costs $5 and $10" and `echo $HOME` render as written. Fenced code is highlighted.

![A light theme showing a load formula and a highlighted Python function](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-math-and-code-light.png)

## Outline and themes

The ☰ button opens a collapsible outline that follows where you read. The preview uses your active color theme, whether light, dark or high contrast, and redraws when you change it.

![The outline sidebar listing the headings of a document](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-outline-sidebar.png)

| Dark                                                                                                                                                           | Light                                                                                                                                                            |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![A Mermaid flowchart and a formula in a dark theme](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-theme-dark.png) | ![A Mermaid flowchart and a formula in a light theme](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-theme-light.png) |

## Security and privacy

A Markdown file can contain HTML and scripts. The preview blocks them, so a file from the internet, an email or a cloned repository cannot run code in the preview.

| Risk                                           | What the preview does                                                                                  |
| :--------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| A script inside a Markdown file                | Does not run it, whatever address it names. Harmless HTML such as `<details>` and `<kbd>` still works. |
| A form or `<base>` tag that redirects the page | Blocks form submits and `<base>` redirects.                                                            |
| A document that reports where you read it      | Sends no `Referer` header with image and font requests.                                                |
| A repository that picks your D2 renderer       | Cannot: the renderer is a user setting.                                                                |
| A folder you have not trusted                  | Previews work in VS Code Restricted Mode.                                                              |
| Usage tracking                                 | None: no telemetry, no analytics, no account.                                                          |

The preview makes these network requests and no others:

- **Libraries:** Mermaid, MathJax, its fonts, highlight.js and its theme, from jsDelivr at pinned versions.
- **Images:** the remote images your document names, fetched from their hosts.
- **D2 diagrams:** the diagram text, sent to the renderer you set.

The [security policy](SECURITY.md) explains how to report a vulnerability.

## At a glance

| Measure              | Value                    |
| :------------------- | :----------------------- |
| Package size         | About 100 KB             |
| Runtime dependencies | One: `marked`            |
| Settings             | One: the D2 renderer URL |

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
