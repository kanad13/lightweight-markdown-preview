# Security Policy

Lightweight Markdown Preview treats every Markdown file as untrusted. This page says how to report a problem, what the preview protects, and which limits remain.

## Report a vulnerability

- **Use GitHub's private reporting:**
  - Open the [Security tab](https://github.com/kanad13/lightweight-markdown-preview/security/advisories/new) of the repository and choose **Report a vulnerability**.
  - Include the Markdown that reproduces the problem and your VS Code version.
- **Supported versions:**
  - The latest release on the Marketplace and Open VSX receives fixes.

## What the preview protects

- **Scripts in a document do not run.**
  - The page runs a script only if it carries the random nonce of the current render, or if such a script loads it. A `<script>` tag, an inline event handler or a `javascript:` link in a document is blocked.
- **Forms, frames, plugins and `<base>` redirects are blocked.**
  - The page also cancels form submits itself, because VS Code's webview does not enforce the `form-action` directive.
- **Image and font requests carry no `Referer` header.**
- **The D2 renderer is a user setting.**
  - It has application scope, so a repository cannot choose where your diagrams go.
- **Restricted Mode:** the preview works in folders you have not trusted.

## Every network request

| Request                                                     | Sent to                                | When                                      |
| :---------------------------------------------------------- | :------------------------------------- | :---------------------------------------- |
| Mermaid, MathJax, MathJax fonts, highlight.js and its theme | `cdn.jsdelivr.net`, at pinned versions | Each time the preview opens or redraws    |
| Remote images named in the document                         | The host in each image address         | When the document contains a remote image |
| D2 diagram text                                             | The renderer URL you set               | When the document contains a `d2` fence   |

The extension sends nothing else and collects no telemetry.

## Known limits

- **Remote images reveal your IP address to their host.**
  - A document can make the preview request an image from any `https:` host. That is how remote images work. Open documents from sources you do not trust with this in mind.
- **Mermaid and MathJax need network access.**
  - On a machine without it, the preview shows their source text instead of the drawing.
- **D2 renderers see your diagram text.**
  - Run the [d2-renderer](https://github.com/kanad13/d2-renderer) container on your machine to keep it there. The public Kroki service is a third party.

The [security model](docs/architecture.md#security-model) describes how each protection works, and the tests load the real page in a browser against hostile documents.
