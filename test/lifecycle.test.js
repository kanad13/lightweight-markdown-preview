const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const { install, handlers, errors, vscode, makeDoc, openPreview, reset } = require("./helpers/fake-vscode");

install();
const { activate } = require("../src/extension");

const docA = makeDoc("/docs/a.md", "# Alpha heading");
const docB = makeDoc("/docs/b.md", "# Beta heading");

beforeEach(reset);

// ============================================================================
// Command
// ============================================================================
describe("show preview command", () => {
	it("renders the file the command was run on", () => {
		const panel = openPreview(activate, docA);
		assert.ok(panel.webview.html.includes("Alpha heading"));
	});

	it("reports an error when no editor is active", () => {
		activate({ extensionUri: {}, subscriptions: [] });
		vscode.window.activeTextEditor = undefined;
		handlers.command();
		assert.deepEqual(errors, ["No active editor"]);
	});

	it("reports an error for a non-Markdown file", () => {
		activate({ extensionUri: {}, subscriptions: [] });
		vscode.window.activeTextEditor = { document: makeDoc("/x.js", "x", { languageId: "javascript" }) };
		handlers.command();
		assert.deepEqual(errors, ["Not a Markdown file"]);
	});

	it("reuses the single panel for a second run on another file", () => {
		const panel = openPreview(activate, docA);
		vscode.window.activeTextEditor = { document: docB };
		handlers.command();
		assert.equal(panel.created, 1);
		assert.ok(panel.webview.html.includes("Beta heading"));
	});

	it("shows a notification when rendering throws", () => {
		const broken = makeDoc("/docs/broken.md", "");
		broken.getText = () => {
			throw new Error("disk gone");
		};
		openPreview(activate, broken);
		assert.deepEqual(errors, ["Failed to render markdown: disk gone"]);
	});
});

// ============================================================================
// Following the active editor
// ============================================================================
describe("active editor following", () => {
	it("switches to another Markdown editor when it becomes active", () => {
		const panel = openPreview(activate, docA);
		handlers.activeEditor({ document: docB });
		assert.ok(panel.webview.html.includes("Beta heading"));
		assert.ok(!panel.webview.html.includes("Alpha heading"));
	});

	it("does not re-render when the active editor is the previewed file", () => {
		const panel = openPreview(activate, docA);
		const before = panel.renders;
		handlers.activeEditor({ document: docA });
		assert.equal(panel.renders, before);
	});

	it("keeps the preview when focus moves to the panel (no editor)", () => {
		const panel = openPreview(activate, docA);
		handlers.activeEditor(undefined);
		assert.ok(panel.webview.html.includes("Alpha heading"));
	});

	it("keeps the preview when a non-Markdown file becomes active", () => {
		const panel = openPreview(activate, docA);
		handlers.activeEditor({ document: makeDoc("/c.js", "const x = 1;", { languageId: "javascript" }) });
		assert.ok(panel.webview.html.includes("Alpha heading"));
	});

	it("ignores the git side of a diff", () => {
		const panel = openPreview(activate, docA);
		handlers.activeEditor({ document: makeDoc("/docs/a.md", "# Old revision", { scheme: "git" }) });
		assert.ok(panel.webview.html.includes("Alpha heading"));
	});

	it("does nothing when no preview is open", () => {
		activate({ extensionUri: {}, subscriptions: [] });
		assert.doesNotThrow(() => handlers.activeEditor({ document: docB }));
		assert.deepEqual(errors, []);
	});
});

// ============================================================================
// Live updates: debounce, disposal, theme
// ============================================================================
describe("live updates", () => {
	beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
	afterEach(() => mock.timers.reset());

	it("renders an edit only after the 300 ms pause", () => {
		const panel = openPreview(activate, docA);
		const before = panel.renders;
		handlers.docChange({ document: docA });
		mock.timers.tick(299);
		assert.equal(panel.renders, before);
		mock.timers.tick(1);
		assert.equal(panel.renders, before + 1);
	});

	it("collapses rapid edits into one render", () => {
		const panel = openPreview(activate, docA);
		const before = panel.renders;
		handlers.docChange({ document: docA });
		mock.timers.tick(200);
		handlers.docChange({ document: docA });
		mock.timers.tick(200);
		handlers.docChange({ document: docA });
		mock.timers.tick(300);
		assert.equal(panel.renders, before + 1);
	});

	it("ignores edits to files other than the previewed one", () => {
		const panel = openPreview(activate, docA);
		const before = panel.renders;
		handlers.docChange({ document: docB });
		mock.timers.tick(1000);
		assert.equal(panel.renders, before);
	});

	it("drops a pending update when the editor switches to another file", () => {
		const panel = openPreview(activate, docA);
		handlers.docChange({ document: docA });
		handlers.activeEditor({ document: docB });
		mock.timers.tick(1000);
		assert.ok(panel.webview.html.includes("Beta heading"));
	});

	it("cancels a pending update when the panel closes", () => {
		const panel = openPreview(activate, docA);
		handlers.docChange({ document: docA });
		const before = panel.renders;
		panel.disposeCallback();
		mock.timers.tick(1000);
		assert.equal(panel.renders, before);
		assert.deepEqual(errors, []);
	});

	it("ignores edits and theme changes after the panel closes", () => {
		const panel = openPreview(activate, docA);
		panel.disposeCallback();
		const before = panel.renders;
		handlers.docChange({ document: docA });
		handlers.theme();
		mock.timers.tick(1000);
		assert.equal(panel.renders, before);
	});

	it("re-renders with the dark Mermaid theme when the color theme changes", () => {
		const panel = openPreview(activate, docA);
		assert.ok(panel.webview.html.includes("theme: 'default'"));
		vscode.window.activeColorTheme.kind = vscode.ColorThemeKind.Dark;
		handlers.theme();
		assert.ok(panel.webview.html.includes("theme: 'dark'"));
		assert.ok(panel.webview.html.includes("atom-one-dark"));
	});
});

// ============================================================================
// Image path resolution
// ============================================================================
describe("image paths", () => {
	const render = (markdown) => {
		const doc = makeDoc("/docs/guide.md", markdown);
		return openPreview(activate, doc).webview.html;
	};

	it("resolves a relative path against the document folder", () => {
		assert.ok(render("![a](./img/a.png)").includes('<img src="webview:/docs/img/a.png"'));
	});

	it("resolves a parent-folder path", () => {
		assert.ok(render("![a](../up.png)").includes('<img src="webview:/up.png"'));
	});

	it("treats a leading slash as workspace-relative", () => {
		vscode.workspace.workspaceFolders = [{ uri: { path: "/ws" } }];
		assert.ok(render("![a](/assets/i.png)").includes('<img src="webview:/ws/assets/i.png"'));
	});

	it("leaves a leading-slash path unchanged without a workspace", () => {
		assert.ok(render("![a](/assets/i.png)").includes('<img src="/assets/i.png"'));
	});

	it("leaves https and data URIs unchanged", () => {
		const html = render("![a](https://example.test/a.png)\n\n![b](data:image/png;base64,AAAA)");
		assert.ok(html.includes('<img src="https://example.test/a.png"'));
		assert.ok(html.includes('<img src="data:image/png;base64,AAAA"'));
	});
});
