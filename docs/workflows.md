# Task Workflows

This page tells an agent which procedure to run for each kind of request. Match the request to a trigger below, run that workflow, and stop at its stopping point. The workflows link to the canonical guides and never repeat their content.

## Rules for Every Workflow

- **Branch:**
  - Work on a feature branch. Never commit to `main`.
- **Authority:**
  - Merge, push, tag, and publish only when the maintainer asks.
  - Treat [feature-decisions.md](feature-decisions.md) as context, not as a task list.
- **Evidence:**
  - Verify claims about libraries, store rules, and behavior against the code, a command's output, or primary documentation.
  - Report a check as passed only if you ran it.
- **Attribution:**
  - Do not add `Co-Authored-By` trailers or tool attribution to commits, pull requests, or files.
- **Done:**
  - `npm test` passes and `npm audit --omit=dev` reports 0 before you call work complete.

## Routing Table

| If the maintainer says…                                                      | Run                                                   |
| :--------------------------------------------------------------------------- | :---------------------------------------------------- |
| "Evaluate adding X", "Is X worth it?", "Should we build X?"                  | [Evaluate a Change](#evaluate-a-change)               |
| "Add X", "Implement X" (after approval)                                      | [Build an Approved Change](#build-an-approved-change) |
| "Update", "upgrade", "maintain", "dependency review", "is the repo current?" | [Maintain and Upgrade](#maintain-and-upgrade)         |
| "X is broken", "fix this bug", "this looks wrong"                            | [Fix a Defect](#fix-a-defect)                         |
| "Release", "publish", "ship it"                                              | [Release](#release)                                   |
| "Check for drift", "sync the repo", "are the docs accurate?"                 | [Sync and Audit](#sync-and-audit)                     |
| "Update the docs", "rewrite the README"                                      | [Change Documentation](#change-documentation)         |

## Evaluate a Change

The goal is a verdict with evidence, not code.

- **Ground:**
  - Read [feature-decisions.md](feature-decisions.md) for earlier decisions on the same idea.
  - Read [architecture.md](architecture.md) and the code the change would touch.
- **Weigh:**
  - Value: Does it fix a real failure or add a capability people need?
  - Cost: What does it add in code, risk (especially the security surface), and upkeep?
  - Goals: Does it keep the extension small, private, and free of configuration?
- **Verify:**
  - Check each factual premise (a library's behavior, an editor API, a store rule) against primary sources.
- **Verdict:**
  - Choose one: pursue, scoped pursue, counter-proposal, defer, or reject.
  - Explain the verdict in plain terms: what the feature is, what it costs, and what would change the answer.
- **Stopping point:**
  - Report the verdict. Do not implement.
  - When the verdict is defer or reject, add an entry to [feature-decisions.md](feature-decisions.md) on a branch.

## Build an Approved Change

The goal is a tested, documented change on a branch, ready for the maintainer's review.

- **Plan:**
  - For a change that touches three or more files, follow the multi-file protocol in [AGENTS.md](../AGENTS.md).
- **Build:**
  - Write the test first when the change fixes behavior or adds a handler. See [testing.md](testing.md).
  - Keep logic in `src/extension.js` and the page in `src/webview.html`, within the architecture rules in [AGENTS.md](../AGENTS.md).
- **Security:**
  - Review any change to the CSP, escaping, nonce, message passing, or file access. [architecture.md](architecture.md) lists the sensitive areas.
- **Sync:**
  - Update [architecture.md](architecture.md), [readme.md](../readme.md), [testing.md](testing.md), and [CHANGELOG.md](../CHANGELOG.md) when the change affects them.
- **Verify:**
  - Run `npm test` and `npm audit --omit=dev`.
  - Run the manual smoke check in [testing.md](testing.md) for changes to `src/webview.html`.
- **Stopping point:**
  - Commit on the branch and build a `.vsix` with `npm run package`.
  - Give the maintainer the file path and install command.

## Maintain and Upgrade

The goal is a repository whose dependencies, support floor, tests, and documents are current.

- **Dependencies:**
  - Follow the review procedure in [dependencies.md](dependencies.md).
  - Apply the selection policy to every package, CDN library, and tool in the same way.
- **Editor floor:**
  - Apply the Editor Support Policy in [dependencies.md](dependencies.md). Check forks before you raise the floor.
- **Registries and authentication:**
  - Confirm that the publishing steps in [development.md](development.md) still match the stores' current rules.
- **Verify:**
  - Run `npm test`, `npm audit --omit=dev`, and the manual smoke check in light and dark themes.
- **Sync:**
  - Run [Sync and Audit](#sync-and-audit) for the files you changed.
- **Stopping point:**
  - Commit on a branch and report what changed, what was verified, and what the maintainer must decide.
  - Propose a release only when user-visible behavior changed or a security fix landed.

## Fix a Defect

The goal is a fix that a test proves.

- **Reproduce:**
  - Write a failing automated test first. When automation is not possible, record a repeatable manual reproduction in [testing.md](testing.md).
- **Fix:**
  - Change the implementation. Never weaken an assertion to get a green run.
- **Prove:**
  - Break the fix on purpose and confirm that the test fails. Restore the fix.
- **Sync:**
  - Update documents that described the wrong behavior, and add a [CHANGELOG.md](../CHANGELOG.md) entry for user-visible fixes.
- **Stopping point:**
  - Commit on a branch and report the cause, the fix, and the evidence.

## Release

The goal is a published version that matches a tagged commit.

- **Preconditions:**
  - The maintainer asked for a release, and the branch is merged to `main` by their instruction.
  - CI is green on `main`, and `npm audit --omit=dev` reports 0.
- **Store checks:**
  - Confirm that the icon is a PNG between 128 and 1024 pixels square, and that `engines.vscode` and the `@types/vscode` pin agree.
- **Local proof:**
  - Build the `.vsix`, give the maintainer the install command, and wait for confirmation that it works.
- **Procedure:**
  - Follow Section 3 of [development.md](development.md).
- **Tag:**
  - Tag the exact commit that is published. If a fix lands after tagging, report it and ask before you move the tag.
- **Verify:**
  - Check the store listing (allow for propagation delay), the GitHub release asset, and CI.

## Sync and Audit

The goal is one truth across code, documents, and tests.

- **Compare:**
  - List every claim in [readme.md](../readme.md), [architecture.md](architecture.md), [development.md](development.md), [testing.md](testing.md), and [AGENTS.md](../AGENTS.md) that the code can confirm or contradict.
  - Check each claim against the code and fix the document or the code.
- **Contracts:**
  - Check that commands, settings, and manifest fields agree across `package.json`, the code, the documents, and the tests.
- **Links:**
  - Check every relative link and every cross-reference between guides.
- **Formatting:**
  - Run Prettier and `npm run lint`. The configuration in `.prettierrc` matches the lint rules.
- **Stopping point:**
  - Commit on a branch and list the drift items that you found and fixed.

## Change Documentation

The goal is documents that describe the current state and read at a glance.

- **Content:**
  - Describe the current state in present tense. Put history in [CHANGELOG.md](../CHANGELOG.md) and Git.
  - State each fact in one place and link to it from elsewhere. Version numbers live only in `package.json`, `package-lock.json`, and `CDN_VERSIONS`.
- **Structure:**
  - Put the overview first, then mechanisms, then detail.
  - Use a bold category anchor with single-assertion child bullets, and use tables for conditional rules. Keep ordered runbooks in step order.
- **Check:**
  - Check relative links, run Prettier, and confirm that [readme.md](../readme.md) still matches the features that exist.
