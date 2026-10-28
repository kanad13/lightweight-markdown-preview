# Lightweight Markdown Preview: Mermaid, D2 and Math in VS Code

See your Markdown the way your readers will, while you type. The preview draws **D2 diagrams** (which GitHub and VS Code's built-in preview leave as code), **Mermaid** in both the GitHub and Azure DevOps syntax, **LaTeX math** and **highlighted code**, in a panel beside your file. It follows your color theme, installs quickly, and keeps your documents on your machine.

![A dark VS Code theme showing one document with a D2 network diagram, a Mermaid flowchart and a math formula](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-hero-dark.png)

## What you get

- **Architecture diagrams as text, drawn as you type:**
  - Write D2 in a fence and see the picture. Nested boxes, database tables, sequence diagrams and class diagrams all work.
  - Diagrams live in your repository as plain text, so they diff, review and merge like code.
- **One Mermaid source for GitHub and Azure DevOps:**
  - GitHub reads backtick fences. Azure DevOps reads `::: mermaid` blocks. The preview draws both, so you check a diagram once and publish it to either.
- **Math that reads the way you meant it:**
  - Prices such as "$5 and $10" and shell variables such as `$HOME` stay text. Only real formulas become math.
- **Files you can open without a second thought:**
  - Open a Markdown file from a cloned repository, a download or an email, and the preview does not run scripts hidden in it.
- **Documents that stay yours:**
  - There is no telemetry and no account. D2 diagrams go only to a renderer you choose, and that can be a container on your own machine.
- **A small footprint:**
  - The package is about 100 KB, with one setting and one runtime dependency. It does one job well.

## Install

- **VS Code:**
  - Search for "Lightweight Markdown Preview" in the Extensions view, or for `KunalPathak.lightweight-markdown-preview`.
- **Forks such as Cursor and VSCodium:**
  - Install from [Open VSX](https://open-vsx.org/extension/KunalPathak/lightweight-markdown-preview).
  - Or download the `.vsix` from the [GitHub releases](https://github.com/kanad13/lightweight-markdown-preview/releases) and run **Extensions: Install from VSIX...**.
- **Use it:**
  - Open a Markdown file, then select the eye icon in the editor title bar, or run **Markdown: Show Lightweight Markdown Preview**.
  - The preview updates as you type and follows the file you edit.

## D2 diagrams

[D2](https://d2lang.com) describes architecture diagrams as text, with nested containers, database tables, sequence diagrams and class diagrams. The preview draws each ` ```d2 ` fence for you.

![A D2 diagram of a cloud network, drawn in the preview: users, a CDN, a load balancer, two availability zones with app servers and a replicated database, and a VPN to a data center](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-d2-network.png)

### Start in two minutes

- **Run a renderer on your machine:**
  - One command starts the [d2-renderer](https://github.com/kanad13/d2-renderer) container. Your diagram text never leaves your computer, and layout engines such as TALA are included.
    ```bash
    docker run -d --name d2-renderer --platform linux/amd64 -p 8080:8080 ghcr.io/kanad13/d2-renderer:latest
    ```
- **Point the preview at it:**
  - Run **Markdown: Choose D2 Renderer** and pick **Local Docker container**.
  - Prefer a shared server? d2-renderer ships a runbook that deploys it to Google Cloud Run, and the public Kroki service works for a quick try.
- **Keep going with the [D2 guide](docs/d2.md):**
  - It has more examples with their source, options such as sketch style and layout engines, and troubleshooting.

### Let an agent write the diagrams

- **[d2-architect](https://github.com/kanad13/coherent-output/tree/main/skills/d2-architect):**
  - An agent skill that adds a checked D2 diagram under every heading of a technical document, without changing your text.
  - This preview draws what it writes, so the loop is: ask your agent for diagrams, read them in the preview, keep the ones you like.

## Mermaid

- **Two syntaxes, one preview:**
  - The same sequence diagram below is drawn from a GitHub-style fence and from an Azure DevOps-style block.

![The same Mermaid sequence diagram drawn from a GitHub-style fence and from an Azure DevOps-style block](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-mermaid-two-syntaxes.png)

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

## Safe to open, private by design

A Markdown file can carry HTML, so the preview treats every file as untrusted, including one you did not write.

- **Open anything:**
  - Scripts in a document do not run, whatever address they name, so a file from a repository you just cloned cannot take over your preview.
  - Harmless HTML such as `<details>`, `<kbd>` and sized images keeps working.
- **No tracking:**
  - There is no telemetry and no analytics. The page does not tell image hosts which page you are reading.
- **You choose where diagrams go:**
  - The renderer is a user setting, so a repository cannot send your diagrams to its own server.
- **Works in Restricted Mode:**
  - Workspace Trust is supported, so you can preview files in folders you have not trusted yet.
- **The details:**
  - [architecture.md](docs/architecture.md) explains the security model and its limits, and the tests load the real page in a browser against hostile documents.

## Focused by design

- **One job:**
  - The preview shows your Markdown beside your editor, and the editor stays the place where you write.
  - Because it ships no export pipeline, bundled browser engine or plugin system, it stays small, quick and easy to audit.
- **One setting:**
  - The D2 renderer is the only choice you make. Text, code and diagrams follow your VS Code theme.
- **Your ideas shape it:**
  - Scroll sync and links between Markdown files are on the list for when someone needs them. [Open an issue](https://github.com/kanad13/lightweight-markdown-preview/issues) with your workflow.

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
