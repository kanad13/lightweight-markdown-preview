# Lightweight Markdown Preview

A small, private Markdown preview for VS Code, built for people who write diagrams. It draws **Mermaid** (GitHub and Azure DevOps syntax) and **D2** diagrams, **LaTeX math** and **highlighted code** beside your file. It follows your color theme and sends no telemetry.

![Lightweight Markdown Preview in a dark VS Code theme: one document with a D2 architecture diagram, a Mermaid flowchart and a math formula](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-hero-dark.png)

## What it does

| Capability               | What you get                                                                                                                                 |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **Diagrams, 3 syntaxes** | Mermaid in ` ```mermaid ` fences, Mermaid in Azure DevOps `::: mermaid` blocks, and D2 in ` ```d2 ` fences. [Details](#diagrams)             |
| **Math**                 | Inline `$x_n$` and block `$$ ... $$` through MathJax. Prices such as "$5 and $10" stay text. [Details](#math-and-code)                       |
| **Code**                 | Fenced code blocks highlighted by highlight.js. [Details](#math-and-code)                                                                    |
| **Outline sidebar**      | A collapsible outline that tracks where you are reading. [Details](#outline-sidebar)                                                         |
| **Themes**               | Light, dark and high-contrast, for text, code and diagrams. [Details](#light-dark-and-high-contrast-themes)                                  |
| **Live**                 | Updates as you type, keeps your reading position, and follows the Markdown file you are editing.                                             |
| **Private**              | No telemetry. D2 diagrams go only to the renderer you choose, which can be a container on your own machine. [Details](#privacy-and-security) |
| **Configurable**         | One command and three settings, all for D2: where to render, which layout engine, and sketch style. [Details](#settings)                     |

## Diagrams

### Mermaid, GitHub and Azure DevOps syntax

GitHub reads Mermaid from backtick fences, and Azure DevOps reads it from `::: mermaid` blocks. A diagram written for one does not render on the other. This extension renders both the same way, so you keep one source file and check it before you publish to either platform.

![The same Mermaid sequence diagram rendered from a GitHub-style fence and from an Azure DevOps-style fence in the VS Code Markdown preview](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-mermaid-two-syntaxes.png)

### D2

[D2](https://d2lang.com) is a diagram language for architecture, sequence and database diagrams. GitHub and VS Code do not render it, so this extension draws each ` ```d2 ` fence as an image from a **D2 renderer that you choose**.

````markdown
```d2
direction: right
clients -> gateway: HTTPS
gateway -> orders: REST
orders -> db: SQL
```
````

D2 fences work in lists and block quotes, accept `~~~` fences and extra text after the language, and follow your color theme: D2 theme 0 in light themes and Dark Mauve (200) in dark themes and the dark high-contrast theme.

#### Choose your D2 renderer

Until you pick a renderer, a D2 block shows its source and a setup message. Run **Markdown: Choose D2 Renderer** from the Command Palette, or set `lightweightMarkdownViewer.d2.rendererUrl`.

![The Choose D2 Renderer quick pick, offering a local Docker container, the Kroki public service, a custom URL, and turning D2 off](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-d2-choose-renderer.png)

| Option               | URL                     | When to use it                                                                                                                                                                                              |
| :------------------- | :---------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local Docker**     | `http://localhost:8080` | Your diagrams never leave your machine. Run `docker run -d --name d2-renderer -p 8080:8080 ghcr.io/kanad13/d2-renderer:latest`. The image comes from [d2-renderer](https://github.com/kanad13/d2-renderer). |
| **Kroki, to try it** | `https://kroki.io`      | Nothing to install. Kroki is a third-party public service, so your diagram text is sent to it. At the time of writing it runs an older D2 than the Docker image and has no TALA layout.                     |
| **Your own server**  | Any `https://` URL      | A server that answers `GET /d2/svg/<payload>` with SVG, the format Kroki uses. Run the d2-renderer image on a host or a cloud container service, then use its URL.                                          |

The same document looks slightly different from each renderer, because each runs its own D2 version:

![The same D2 diagram in the preview, drawn by a local Docker renderer and by Kroki](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-d2-renderers.png)

- **Cloud-hosted renderers:** Any HTTPS URL works, such as a copy of the d2-renderer image on a cloud container service.
- **Plain `http://`:** Use it for `localhost` or a network you trust. The diagram text travels in the URL.
- **Where the setting lives:** It is a user setting. A repository cannot set it, so a cloned project cannot choose where your diagrams go.

#### Layout and sketch style

Two settings change how every D2 diagram looks. `lightweightMarkdownViewer.d2.layout` selects `dagre` (default), `elk` or `tala`. `lightweightMarkdownViewer.d2.sketch` draws diagrams in a hand-drawn style.

![One D2 diagram drawn with the dagre, ELK and TALA layouts and in sketch style](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-d2-layouts.png)

TALA is included in the d2-renderer image. Its licence terms are unclear to us, so check them before you rely on it. Kroki does not offer TALA.

#### When a D2 diagram does not render

A diagram with a syntax error, or a renderer that is down, shows a message and the diagram source. The diagrams around it keep working.

![A D2 block with a typo shown as a message and its source, between two diagrams that rendered](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-d2-failure.png)

- **Compiler messages:** The preview cannot read an error message from an image. Kroki returns its error as a picture, so you see it. For other renderers, run the same source through `d2` or the renderer's `POST /d2/svg` endpoint to see the message.
- **Very large diagrams:** A diagram whose address would pass 8,000 characters is not sent, because common servers refuse longer addresses. Split it into smaller diagrams.
- **Editing:** Only a changed D2 block asks the renderer for a new picture, as long as the renderer sends cache headers, as the d2-renderer image does. After an edit, documents with D2 wait a little longer before they redraw.

## Math and code

Write inline math as `$x_n$` and block math as `$$ ... $$`, on one line or several. Dollar signs stay plain text when they are not math, so "costs $5 and $10" and `echo $HOME $PATH` render as written.

![A Markdown preview in a light theme showing a Fourier transform equation, a Mermaid flowchart and a highlighted Python code block](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-math-and-code-light.png)

- **Inline math:** `$...$`. The opening `$` must touch the formula, and the closing `$` must not be followed by a digit.
- **Block math:** `$$ ... $$`, with no blank line inside.
- **Code:** fenced blocks are highlighted by highlight.js.

## Outline sidebar

Open the ☰ button for a collapsible outline of the document. It highlights the section you are reading, expands the parents of that section, and scrolls to a heading when you select it. Links such as `[see intro](#intro)` scroll to their heading too.

![The outline sidebar of the Markdown preview, listing the headings of a document with the current section highlighted](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-outline-sidebar.png)

## Light, dark and high-contrast themes

The preview follows the active VS Code color theme, including Mermaid, D2 and code, and re-renders when you change it.

| Dark theme                                                                                                                                                              | Light theme                                                                                                                                                               |
| :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ![Markdown preview with a D2 diagram in a dark VS Code theme](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-theme-dark.png) | ![Markdown preview with a D2 diagram in a light VS Code theme](https://raw.githubusercontent.com/kanad13/lightweight-markdown-preview/main/assets/readme-theme-light.png) |

## Settings

The preview needs no setup, except for D2, which needs a renderer. These are all the settings and commands.

| Setting or command                              | Default | What it does                                                                                                                                                    |
| :---------------------------------------------- | :------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lightweightMarkdownViewer.d2.rendererUrl`      | empty   | Base URL of the D2 renderer. Empty turns D2 rendering off. It accepts `http://` and `https://` URLs without a user name, query or fragment. User settings only. |
| `lightweightMarkdownViewer.d2.layout`           | `dagre` | Layout engine: `dagre`, `elk` or `tala`.                                                                                                                        |
| `lightweightMarkdownViewer.d2.sketch`           | `false` | Draws D2 diagrams in a hand-drawn style.                                                                                                                        |
| **Markdown: Choose D2 Renderer**                |         | Quick pick that stores a renderer URL for you.                                                                                                                  |
| **Markdown: Show Lightweight Markdown Preview** |         | Opens the preview. The eye icon in the editor title bar runs the same command.                                                                                  |

## Install

1. Open the Extensions view in VS Code.
2. Search for "Lightweight Markdown Preview", or for the identifier `KunalPathak.lightweight-markdown-preview`.
3. Select **Install**.

**VS Code forks:** Cursor, VSCodium and similar editors read the [Open VSX](https://open-vsx.org/extension/KunalPathak/lightweight-markdown-preview) registry, where this extension is also published. You can also download the `.vsix` file from the [GitHub releases](https://github.com/kanad13/lightweight-markdown-preview/releases) and run **Extensions: Install from VSIX...**.

**Requirements:**

- VS Code, or a compatible fork, released within the last 12 months.
- Network access to the jsDelivr CDN for diagrams, math and syntax highlighting.
- A D2 renderer, only if you write D2. A local Docker container needs no internet access for D2 itself.

## Use

1. Open a Markdown file.
2. Select the eye icon in the top-right of the editor title bar. You can also open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and run **Markdown: Show Lightweight Markdown Preview**.
3. Edit the file. The preview updates after a short pause.
4. Switch to another Markdown file. The preview switches with you and starts at the top of that file.
5. To draw D2 diagrams, run **Markdown: Choose D2 Renderer** once. [`examples/d2.md`](examples/d2.md) is a document to try it on.

## Privacy and security

- **Privacy:**
  - The extension has no telemetry and no analytics.
  - D2 diagrams go only to the renderer you choose, and that can be a container on your own machine.
  - Your other document text stays on your machine. jsDelivr sees the requests for the Mermaid, MathJax and highlight.js files, not your content.
- **Security:**
  - A Content Security Policy runs inline scripts only when they carry a per-render random nonce.
  - The renderer origin is checked and is the only extra address the policy allows for images. It is never a whole `http:` scheme.
  - D2 diagrams load as images, so a diagram cannot run scripts.
  - The extension escapes the text it inserts into the page.
  - Mermaid runs at its strict security level.
  - Workspace Trust is supported, so previews work in Restricted Mode on untrusted repositories without running local code.

## What it does not do

- It has no themes, plugins or font settings. The only settings are the three for D2.
- It does not draw D2 by itself. It needs a renderer URL, and the renderer decides which D2 version and layout engines you get.
- It does not show a renderer's D2 error message, unless the renderer returns the error as a picture.
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
