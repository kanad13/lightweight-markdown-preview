/**
 * Tests that documentation links and heading anchors resolve, and that the task
 * routing table in AGENTS.md names exactly the workflows defined in docs/workflows.md.
 * The routing table is the only copy of the triggers, so a rename on one side must fail here.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const guides = fs.readdirSync(path.join(root, "docs")).filter((f) => f.endsWith(".md"));
const markdownFiles = ["readme.md", "CHANGELOG.md", "AGENTS.md", ...guides.map((f) => `docs/${f}`)];

/** Returns the lines of a Markdown file outside fenced code blocks, where `#` starts a shell comment rather than a heading. */
function proseLines(file) {
	let fenced = false;
	return fs
		.readFileSync(path.join(root, file), "utf8")
		.split(/\r?\n/)
		.filter((line) => {
			if (/^\s*(```|~~~)/.test(line)) {
				fenced = !fenced;
				return false;
			}
			return !fenced;
		});
}

/** Converts a heading to the anchor that GitHub and the VS Code Markdown preview generate. */
function slug(heading) {
	return heading
		.trim()
		.toLowerCase()
		.replace(/`/g, "")
		.replace(/[^\p{L}\p{N}\s_-]/gu, "")
		.replace(/\s/g, "-");
}

/** Returns the set of anchors a file defines, numbering duplicates the way GitHub does. */
function anchorsOf(file) {
	const seen = new Map();
	const anchors = new Set();
	for (const line of proseLines(file)) {
		const match = /^#{1,6}\s+(.+?)\s*#*$/.exec(line);
		if (!match) continue;
		const base = slug(match[1]);
		const count = seen.get(base) || 0;
		seen.set(base, count + 1);
		anchors.add(count === 0 ? base : `${base}-${count}`);
	}
	return anchors;
}

/** Returns the relative link targets of a file as `{ file, anchor }`, skipping external URLs. */
function relativeLinks(file) {
	const links = [];
	for (const line of proseLines(file)) {
		// Inline code shows link syntax as an example, not as a link.
		for (const match of line.replace(/`[^`]*`/g, "").matchAll(/\]\(([^)\s]+)\)/g)) {
			const [target, anchor] = match[1].split("#");
			if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
			links.push({ target, anchor });
		}
	}
	return links;
}

/** Returns the workflow names in the AGENTS.md routing table (second column). */
function routedWorkflows() {
	const lines = proseLines("AGENTS.md");
	const start = lines.findIndex((l) => /^##\s+task routing/i.test(l));
	assert.ok(start >= 0, "AGENTS.md has no Task Routing section");
	const names = [];
	for (const line of lines.slice(start + 1)) {
		if (/^##\s/.test(line)) break;
		if (!line.startsWith("|")) continue;
		const cells = line.split("|").map((c) => c.trim());
		const name = cells[2];
		if (!name || /^:?-+:?$/.test(name) || /^run workflow$/i.test(name)) continue;
		names.push(name);
	}
	return names;
}

/** Returns the `##` headings of docs/workflows.md. */
function definedWorkflows() {
	return proseLines("docs/workflows.md")
		.map((l) => /^##\s+(.+?)\s*$/.exec(l))
		.filter(Boolean)
		.map((m) => m[1]);
}

describe("documentation links", () => {
	for (const file of markdownFiles) {
		it(`resolves every relative link and anchor in ${file}`, () => {
			for (const { target, anchor } of relativeLinks(file)) {
				// README images use root-relative paths that vsce rewrites to the repository.
				const resolved = target.startsWith("/")
					? path.join(root, target.slice(1))
					: path.join(path.dirname(path.join(root, file)), target);
				const destination = target === "" ? file : path.relative(root, resolved);
				if (target !== "") assert.ok(fs.existsSync(resolved), `${file} links to missing ${target}`);
				if (anchor && destination.endsWith(".md")) {
					assert.ok(
						anchorsOf(destination).has(anchor),
						`${file} links to missing anchor ${target}#${anchor}`
					);
				}
			}
		});
	}
});

describe("task routing", () => {
	it("routes only to workflows that docs/workflows.md defines", () => {
		const defined = definedWorkflows();
		for (const name of routedWorkflows()) {
			assert.ok(defined.includes(name), `AGENTS.md routes to "${name}", which docs/workflows.md does not define`);
		}
	});

	it("routes every workflow that docs/workflows.md defines", () => {
		const routed = routedWorkflows();
		for (const name of definedWorkflows()) {
			assert.ok(routed.includes(name), `docs/workflows.md defines "${name}", which AGENTS.md does not route to`);
		}
	});

	it("links the workflows guide from the README", () => {
		assert.ok(
			relativeLinks("readme.md").some((l) => l.target === "docs/workflows.md"),
			"readme.md does not link docs/workflows.md"
		);
	});
});
