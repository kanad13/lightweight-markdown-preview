# Lightweight Markdown Preview - VS Code Extension

This file is the shared instruction set for every AI agent and harness that works in this repository.

## Key Context

This extension provides a lightweight, privacy-friendly Markdown preview in a VS Code webview panel. It renders Markdown with Mermaid diagrams, MathJax equations, and syntax-highlighted code blocks. Package name: `lightweight-markdown-preview`, command prefix: `lightweightMarkdownViewer`.

- Single source file: `src/extension.js`
- One runtime dependency: `marked`
- Build: webpack → `dist/extension.js`
- Closure-based state (no classes, no globals)
- CSP nonce security on all webview renders

## Task Routing

Match the maintainer's request to a workflow in `docs/workflows.md` and run it. Stop at the stopping point that the workflow names. The workflow column must equal a heading in `docs/workflows.md`; `test/docs.test.js` checks it.

| If the maintainer says...                                    | Run workflow             |
| :----------------------------------------------------------- | :----------------------- |
| "Evaluate adding X", "Is X worth it?", "Add a dependency"    | Evaluate a Change        |
| "Add X", "Implement X" (after approval)                      | Build an Approved Change |
| "Update", "upgrade", "maintain", "dependency review"         | Maintain and Upgrade     |
| "X is broken", "fix this bug"                                | Fix a Defect             |
| "Release", "publish", "ship it"                              | Release                  |
| "Check for drift", "sync the repo", "are the docs accurate?" | Sync and Audit           |
| "Update the docs", "rewrite the README"                      | Change Documentation     |

- **No match:**
  - A question about the code or the docs gets an answer and no file changes.
  - Any other request that matches no row or several rows: name the closest workflow and ask the maintainer to confirm it.
- **Evidence:**
  - Verify claims about libraries, store rules, and behavior against the code, a command's output, or primary documentation.
  - Report a check as passed only if you ran it.
- **Authority:**
  - Treat `docs/decisions.md` as context, not as a task list.

## Dependencies

Before adding, upgrading, or auditing any dependency (npm package, CDN library, or build tool), read `docs/dependencies.md`. It defines the version-selection criteria, the constraints that currently limit upgrades, and the review procedure. Ideas that were evaluated and not built are logged in `docs/decisions.md`.

## Architecture Rules

- All extension logic in `src/extension.js` unless it exceeds ~1500 lines
- Single webview panel, reused across files
- No TypeScript, no frameworks, no bundled webview scripts
- CDN-loaded (Mermaid, MathJax, highlight.js) at exact versions defined in `CDN_VERSIONS` in `src/extension.js`
- Mermaid extraction: backtick (```) and Azure DevOps (:::) syntaxes
- Math extraction: inline ($...$) and block ($$...$$); preserved source is HTML-escaped
- TOC sidebar: overlay pattern, slides from right, no layout reflow

## Code Style (enforced by ESLint)

- Tabs, double quotes, semicolons, Unix line endings
- ES2020, CommonJS (`require`/`module.exports`)
- JSDoc on all exported/public functions
- No TODO comments in code - track in issues

## Git and Commits

- Work on a feature branch. Never commit to `main`.
- Commit messages are concise and imperative, and describe _what changed_. Commit at meaningful intervals.
- Merge, push, tag, and publish only when the maintainer says so.
- Do not add `Co-Authored-By` trailers or other tool attribution to commits, pull requests, files, or release notes.

## Multi-File Change Protocol

When a task touches 3+ files or requires multiple related edits:

1. **Branch first** - see Git and Commits
2. **File-touch matrix** - map which files each change touches, then group/sequence to minimize redundant edits to the same file across commits
3. **Phase the work** - group changes into logical phases (infra/config first, then code, then tests). Never fix a file you're about to delete
4. **Gate each phase** - after each phase: commit, build `.vsix`, run tests, verify before proceeding
5. **Track in a workplan** - for more than 1 phase, create a `WORKPLAN.md` (delete when done) with the matrix and checklist

## Testing

- The testing strategy, commands, and manual smoke check live in `docs/testing.md`; update it when a workflow, contract, or tool changes
- Manual testing via F5 debug launch
- Test file at `examples/test.md` with diverse Markdown content, Mermaid diagrams, and MathJax equations
- `npm test` and `npm audit --omit=dev` must pass before any work is considered complete. The audit cannot see CDN libraries; `docs/workflows.md` covers them under Maintain and Upgrade
- Build a `.vsix` (`npm run package`) after each phase for manual install testing
