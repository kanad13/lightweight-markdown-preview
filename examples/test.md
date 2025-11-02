# Sample Markdown File

![Lightweight Markdown Preview Screenshot](../docs/markdown-preview.png)



This file contains all typical elements found in a Markdown document. Like:

- Headings
- Lists
- Links
- Images
- Blockquotes
- Code blocks
- Tables
- Mermaid diagrams
- Mathematical expressions
# Lightweight Markdown Preview

A minimal VS Code extension for previewing Markdown with Mermaid diagrams and MathJax support. **No bloat. No configuration. Just markdown.**

## Why This Extension?

- **Lightweight:** ~38 KB packaged (no massive dependencies)
- **Privacy-Friendly:** No tracking, no analytics, no data collection. Your markdown stays on your machine
- **Simple:** ~300 lines of code, easy to understand and maintain
- **Fast:** Live preview updates as you type
- **Secure:** Content Security Policy, nonce-based script execution
- **One Job:** Previews Markdown. That's it. No themes, no plugins, no bloat.

![Lightweight Markdown Preview Screenshot](./docs/markdown-preview.png)
---

## Headings

- Nested lists:
  - Item 1
    - Subitem 1.1
    - Subitem 1.2
  - Item 2
- Numbered lists:
  1. First item
  2. Second item
  3. Third item

---

## Links

- Link to example.com: [Example](https://www.example.com)

---

## Images

![Sample Image](https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Comatricha_nigra_176600092.jpg/330px-Comatricha_nigra_176600092.jpg)

---

## Text formatting

- Bold text: **bold**
- Italic text: _italic_
- Strikethrough text: ~~strikethrough~~
- Blockquote: > This is a blockquote.
- Python code block:

```python
print("Hello, World!")
```

- Markdown table

| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Row 1    | Row 1    | Row 1    |
| Row 2    | Row 2    | Row 2    |
| Row 3    | Row 3    | Row 3    |

---

## Mermaid diagram

```mermaid
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
```

## Mathematical expressions

- Inline Mathematical Expression Not supported right now - $E = mc^2$

- Block Mathematical Expression Supported:

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
