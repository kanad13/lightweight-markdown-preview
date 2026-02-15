# Lightweight Markdown Preview - VS Code Extension

## Key Context

This extension provides a lightweight, privacy-friendly Markdown preview in a VS Code webview panel. It renders Markdown with Mermaid diagrams, MathJax equations, and syntax-highlighted code blocks. Package name: `lightweight-markdown-preview`, command prefix: `lightweightMarkdownViewer`.

- Single source file: `src/extension.js`
- One runtime dependency: `marked`
- Build: webpack → `dist/extension.js`
- Closure-based state (no classes, no globals)
- CSP nonce security on all webview renders

## Architecture Rules

- All extension logic in `src/extension.js` unless it exceeds ~1500 lines
- Single webview panel, reused across files
- No TypeScript, no frameworks, no bundled webview scripts
- CDN-loaded: Mermaid v11, MathJax v3, highlight.js v11
- Mermaid extraction: backtick (```) and Azure DevOps (:::) syntaxes
- Math extraction: inline ($...$) and block ($$...$$)
- TOC sidebar: overlay pattern, slides from right, no layout reflow

## Code Style (enforced by ESLint)

- Tabs, double quotes, semicolons, Unix line endings
- ES2020, CommonJS (`require`/`module.exports`)
- JSDoc on all exported/public functions
- No TODO comments in code - track in issues

## Git Commits

Concise, imperative mood. Describe *what changed*. Commit at meaningful intervals.

## Multi-File Change Protocol

When a task touches 3+ files or requires multiple related edits:

1. **Branch first** - always work on a feature branch, never directly on main
2. **File-touch matrix** - map which files each change touches, then group/sequence to minimize redundant edits to the same file across commits
3. **Phase the work** - group changes into logical phases (infra/config first, then code, then tests). Never fix a file you're about to delete
4. **Gate each phase** - after each phase: commit, build `.vsix`, run tests, verify before proceeding
5. **Track in a workplan** - for more than 1 phase, create a `WORKPLAN.md` (delete when done) with the matrix and checklist

## Testing

- Manual testing via F5 debug launch
- Test file at `examples/test.md` with diverse Markdown content, Mermaid diagrams, and MathJax equations
- `npm test` must pass before any work is considered complete
- Build a `.vsix` (`npm run package`) after each phase for manual install testing
