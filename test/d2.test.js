/**
 * Tests for D2 diagram support: the address encoding, the renderer URL
 * validation, fence detection, the CSP that admits the renderer, hostile input,
 * and the settings, command and debounce around it.
 *
 * Reference vectors come from Python's `zlib.compress(..., 9)` and
 * `base64.urlsafe_b64encode`, the encoder the d2-renderer service documents, so
 * a change in the Node encoder fails here before a renderer rejects it.
 */
const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const { URL } = require("node:url");
const fs = require("node:fs");
const path = require("node:path");
const {
	install,
	handlers,
	settings,
	errors,
	configSections,
	settingUpdates,
	prompts,
	vscode,
	makeDoc,
	openPreview,
	reset,
} = require("./helpers/fake-vscode");

install();
const {
	activate,
	renderMarkdown,
	getWebviewContent,
	encodeD2Payload,
	parseRendererUrl,
	buildD2Url,
} = require("../src/extension");

const BASE = "http://localhost:8080";
const d2 = (extra = {}) => ({ rendererUrl: BASE, theme: 0, ...extra });
const render = (source, options) => renderMarkdown(source, { d2: d2(), ...options });

/** Reverses encodeD2Payload the way the renderer does */
function decode(payload) {
	return zlib.inflateSync(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64")).toString("utf8");
}

beforeEach(reset);

describe("D2 payload encoding", () => {
	const vectors = {
		"x -> y: Ping\ny -> x: Pong": "eNqrUNC1U6i0UgjIzEvnqgRxKoCc_Lx0AFhYBxk=",
		"User: Käyttäjä 🙂\nUser -> 日本語": "eNoLLU4tslLwPryksqTk8JKsw0sUPsyf2cQVChRW0LVTeDZ96bM5a16smgcAfGUT4w==",
		"": "eNoDAAAAAAE=",
		"a: A\nb: B\na -> b: hi": "eNpLtFJw5EqyUnDiSlTQtVMAsjIyAS5mBKg=",
	};

	// Node versions bundle different zlib builds, so the compressed bytes differ between them while every stream stays valid.
	// The contract with a renderer is that it inflates to the source, so the test checks that and the level-9 header, not the bytes.
	for (const [source, reference] of Object.entries(vectors)) {
		it(`agrees with the Python reference for ${JSON.stringify(source.slice(0, 20))}`, () => {
			const payload = encodeD2Payload(source);
			assert.equal(decode(reference), source, "the reference vector decodes to the source");
			assert.equal(decode(payload), source);
			assert.ok(payload.startsWith("eN"), "zlib header for level 9");
			assert.ok(!/[+/]/.test(payload));
		});
	}

	it("round-trips a large diagram and never emits + or /", () => {
		const source = Array.from({ length: 2000 }, (_, i) => `n${i} -> n${(i * 7919) % 2000}: edge ${i} ✓`).join("\n");
		const payload = encodeD2Payload(source);
		assert.equal(decode(payload), source);
		assert.ok(!/[+/]/.test(payload));
	});
});

describe("renderer URL validation", () => {
	const accepted = [
		["http://localhost:8080", "http://localhost:8080"],
		["  http://localhost:8080/  ", "http://localhost:8080"],
		["https://kroki.io", "https://kroki.io"],
		["https://KROKI.io///", "https://kroki.io"],
		["https://example.com/kroki/", "https://example.com/kroki"],
		["http://127.0.0.1:9000", "http://127.0.0.1:9000"],
		["https://d2-renderer.run.app:443", "https://d2-renderer.run.app"],
	];
	for (const [input, url] of accepted) {
		it(`accepts ${JSON.stringify(input)}`, () => {
			const result = parseRendererUrl(input);
			assert.equal(result.url, url);
			assert.equal(result.origin, new URL(url).origin);
		});
	}

	const rejected = [
		"",
		"   ",
		undefined,
		42,
		"localhost:8080",
		"javascript:alert(1)",
		"file:///etc/passwd",
		"data:image/svg+xml,<svg/>",
		"ftp://example.com",
		"http://user:pass@example.com",
		"https://user@example.com",
		"https://example.com/?a=1",
		"https://example.com/#x",
		"https://example.com?",
		"http://a;script-src *",
		"http://a,b.com",
		"https://exa mple.com",
	];
	for (const input of rejected) {
		it(`rejects ${JSON.stringify(input)}`, () => {
			const result = parseRendererUrl(input);
			assert.ok(result.error, "expected an error");
			assert.equal(result.url, undefined);
		});
	}
});

describe("image address", () => {
	it("sends the theme and nothing else", () => {
		const url = buildD2Url(BASE, "a -> b", { theme: 200 });
		assert.equal(url, `${BASE}/d2/svg/${encodeD2Payload("a -> b")}?theme=200`);
		assert.equal(buildD2Url(BASE, "a -> b"), `${BASE}/d2/svg/${encodeD2Payload("a -> b")}?theme=0`);
	});

	it("sends the author's source as written, so layout, sketch and padding set in d2-config reach the renderer", () => {
		const source =
			"vars: {\n  d2-config: {\n    layout-engine: tala\n    sketch: true\n    pad: 24\n  }\n}\na -> b";
		const payload = buildD2Url(BASE, source, { theme: 0 }).split("/d2/svg/")[1].split("?")[0];
		assert.equal(decode(payload), source);
	});
});

describe("D2 fence detection", () => {
	const img = (html) => (html.match(/<img class="d2-img" src="([^"]+)"/) || [])[1]?.replace(/&amp;/g, "&");

	it("renders a backtick fence as an image of the encoded source", () => {
		const { html } = render("```d2\nx -> y\n```");
		assert.equal(img(html), `${BASE}/d2/svg/${encodeD2Payload("x -> y")}?theme=0`);
		assert.ok(html.includes('<figure class="d2-diagram">'));
	});

	for (const [name, markdown] of [
		["a tilde fence", "~~~d2\nx -> y\n~~~"],
		["a fence indented three spaces", "   ```d2\n   x -> y\n   ```"],
		["an upper-case language", "```D2\nx -> y\n```"],
		["attributes after the language", '```d2 title="Flow" theme=1\nx -> y\n```'],
		["a list item", "- item\n\n  ```d2\n  x -> y\n  ```"],
		["a block quote", "> ```d2\n> x -> y\n> ```"],
		["a numbered list", "1. step\n\n   ```d2\n   x -> y\n   ```"],
	]) {
		it(`finds D2 in ${name}`, () => {
			assert.equal(img(render(markdown).html), `${BASE}/d2/svg/${encodeD2Payload("x -> y")}?theme=0`);
		});
	}

	it("keeps a list item's text next to its diagram", () => {
		const { html } = render("- first\n\n  ```d2\n  x -> y\n  ```\n- second");
		assert.ok(/<li>[\s\S]*first[\s\S]*d2-diagram[\s\S]*<\/li>\s*<li>[\s\S]*second/.test(html));
	});

	it("leaves other languages and look-alikes alone", () => {
		for (const lang of ["d2lang", "d", "python", "mermaid", ""]) {
			assert.ok(!render("```" + lang + "\nx -> y\n```").html.includes("d2-diagram"), lang);
		}
		assert.ok(!render("    x -> y").html.includes("d2-diagram"), "indented code block");
		assert.ok(!render("`d2`").html.includes("d2-diagram"), "code span");
	});

	it("handles Unicode and emoji in the source", () => {
		const source = "Käyttäjä 🙂 -> 日本語: ✓";
		assert.equal(
			decode(
				img(render("```d2\n" + source + "\n```").html)
					.split("/d2/svg/")[1]
					.split("?")[0]
			),
			source
		);
	});

	it("shows a notice and no request for an empty block", () => {
		for (const markdown of ["```d2\n```", "```d2\n\n  \n```"]) {
			const { html } = render(markdown);
			assert.ok(html.includes("This D2 block is empty."));
			assert.ok(!html.includes("<img"));
		}
	});

	it("shows the source and a notice instead of an address that is too long", () => {
		const big = Array.from({ length: 4000 }, (_, i) => `n${i} -> n${(i * 31337) % 4000}: ${Math.random()}`).join(
			"\n"
		);
		const { html } = render("```d2\n" + big + "\n```");
		assert.ok(html.includes("too large to send in a URL"));
		assert.ok(!html.includes("<img"));
		assert.ok(html.includes("n3999 -&gt; n"));
	});

	it("produces one image per block and each block keeps its own address", () => {
		const { html } = render("```d2\na -> b\n```\n\ntext\n\n```d2\nc -> d\n```\n\n```mermaid\ngraph TD\nA-->B\n```");
		assert.equal((html.match(/class="d2-img"/g) || []).length, 2);
		assert.ok(html.includes('<pre class="mermaid">'));
	});

	it("does not list D2 source lines as headings or math", () => {
		const { headings, html } = render("```d2\n# not a heading\n$x$ -> y\n```");
		assert.deepEqual(headings, []);
		assert.ok(!html.includes("math-inline"));
	});
});

describe("D2 fence while no renderer is set", () => {
	const codeBlock = '<pre><code class="language-d2">x -&gt; y\n</code></pre>\n';

	it("stays the ordinary code block it was before D2 support, plus one hint", () => {
		const { html, d2Origin } = renderMarkdown("```d2\nx -> y\n```", { d2: { rendererUrl: "" } });
		assert.ok(html.startsWith(codeBlock), html);
		assert.equal((html.match(/class="d2-hint"/g) || []).length, 1);
		assert.ok(html.includes("Markdown: Choose D2 Renderer"));
		assert.ok(html.includes("/blob/main/docs/d2.md"));
		assert.ok(!html.includes("<img") && !html.includes("d2-notice"));
		assert.equal(d2Origin, undefined);
	});

	it("renders exactly what another language's fence renders", () => {
		const d2 = renderMarkdown("```d2\nx -> y\n```", { d2: { rendererUrl: "" } }).html;
		const other = renderMarkdown("```text\nx -> y\n```").html;
		assert.equal(d2.split('<p class="d2-hint">')[0], other.replace("language-text", "language-d2"));
	});

	it("shows one hint per document, however many D2 blocks it holds", () => {
		const { html } = renderMarkdown("```d2\na\n```\n\n```d2\nb\n```\n\n```D2\nc\n```", {
			d2: { rendererUrl: "  " },
		});
		assert.equal((html.match(/class="d2-hint"/g) || []).length, 1);
		assert.equal((html.match(/language-d2/gi) || []).length, 3);
	});

	it("applies when renderMarkdown gets no D2 options", () => {
		assert.ok(renderMarkdown("```d2\nx\n```").html.includes("d2-hint"));
	});

	it("keeps the source of a D2 block and its fence kind in lists and quotes", () => {
		const { html } = renderMarkdown("- item\n\n  ```d2\n  x -> y\n  ```\n\n> ~~~d2\n> a -> b\n> ~~~", {
			d2: { rendererUrl: "" },
		});
		assert.ok(html.includes("x -&gt; y") && html.includes("a -&gt; b"));
		assert.ok(!html.includes("<img"));
	});
});

describe("D2 with a renderer URL that cannot be used", () => {
	it("explains why, shows the source, and never emits an image", () => {
		const { html, d2Origin } = renderMarkdown("```d2\nx -> y\n```", { d2: { rendererUrl: "javascript:alert(1)" } });
		assert.ok(html.includes("not usable"));
		assert.ok(html.includes("Only http: and https: URLs are accepted."));
		assert.ok(html.includes("x -&gt; y"));
		assert.ok(!html.includes("<img"));
		assert.equal(d2Origin, undefined);
	});

	it("marks the failure box and the source as hidden until the image fails", () => {
		const { html } = render("```d2\nx -> y\n```");
		assert.ok(/<div class="d2-error"[^>]* hidden>/.test(html));
		assert.ok(html.includes('<pre hidden class="d2-source">x -&gt; y</pre>'));
		assert.ok(html.includes(`The renderer at ${BASE} sent no picture`));
	});
});

describe("people who never use D2 see no change", () => {
	// The CSP when no renderer is set, with the nonce replaced; D2 may add its origin to img-src and nothing else, so this is also what every user without D2 gets
	const CSP_BEFORE_D2 =
		"default-src 'none'; img-src https: data: vscode-resource:; script-src 'nonce-N' 'strict-dynamic'; style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https: data:; base-uri 'none'; form-action 'none';";
	const root = path.join(__dirname, "..");
	const documents = ["examples/test.md", "docs/dependencies.md", "docs/development.md", "docs/workflows.md"].map(
		(file) => [file, fs.readFileSync(path.join(root, file), "utf8")]
	);
	documents.push([
		"text that only mentions d2",
		"# d2\n\nUse `d2` or d2lang, see https://d2lang.com.\n\n```d2lang\nx\n```\n\n```d\ny\n```\n\n````markdown\n```d2\nx -> y\n```\n````\n\n$a$ and $5 and $10.",
	]);

	for (const [name, text] of documents) {
		it(`renders ${name} identically with D2 unset, set to a renderer, or not configured at all`, () => {
			const plain = renderMarkdown(text);
			for (const d2 of [
				{ rendererUrl: "" },
				{ rendererUrl: BASE, theme: 200 },
				{ rendererUrl: "javascript:x" },
			]) {
				const other = renderMarkdown(text, { d2 });
				assert.equal(other.html, plain.html);
				assert.deepEqual(other.headings, plain.headings);
			}
			assert.ok(
				!/d2-(diagram|img|hint|notice|error|source)/.test(plain.html),
				"no D2 markup in a document without D2"
			);
		});
	}

	it("keeps the Content Security Policy the same whatever D2 is set to", () => {
		const csp = /Content-Security-Policy" content="([^"]*)"/.exec(
			getWebviewContent("", "N", [], {}, "doc", undefined)
		)[1];
		assert.equal(csp, CSP_BEFORE_D2);
		assert.equal(
			/Content-Security-Policy" content="([^"]*)"/.exec(getWebviewContent("", "N", [], {}, "doc", ""))[1],
			CSP_BEFORE_D2
		);
	});

	it("opens a preview, edits and switches themes without prompts, messages or reads of other settings", () => {
		const doc = makeDoc("/docs/plain.md", "# Plain\n\n```mermaid\ngraph TD\n A-->B\n```\n\n$x$");
		const panel = openPreview(activate, doc);
		vscode.window.activeColorTheme.kind = 2;
		handlers.theme();
		handlers.docChange({ document: doc });
		assert.ok(panel.webview.html.includes("Plain"));
		assert.deepEqual(errors, []);
		assert.equal(prompts.quickPickItems, undefined, "no quick pick opened by itself");
		assert.deepEqual(settingUpdates, [], "no setting written by itself");
		assert.ok(
			configSections.every((section) => section === "lightweightMarkdownViewer.d2"),
			configSections.join()
		);
	});

	it("keeps the 300 ms wait after an edit in documents without D2, whatever the settings", () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		try {
			const doc = makeDoc("/docs/plain2.md", "# Plain");
			for (const url of [undefined, BASE]) {
				if (url) settings["lightweightMarkdownViewer.d2.rendererUrl"] = url;
				const panel = openPreview(activate, doc);
				const before = panel.renders;
				handlers.docChange({ document: doc });
				mock.timers.tick(300);
				assert.equal(panel.renders, before + 1, String(url));
			}
		} finally {
			mock.timers.reset();
		}
	});

	it("does not draw the open preview again when an unrelated setting changes", () => {
		const doc = makeDoc("/docs/plain3.md", "# Plain");
		const panel = openPreview(activate, doc);
		const before = panel.renders;
		handlers.config({ affectsConfiguration: (id) => id === "editor.fontSize" });
		assert.equal(panel.renders, before);
	});

	it("adds one command and no activation work: the command that existed still opens the preview", () => {
		const doc = makeDoc("/docs/plain4.md", "# Plain");
		assert.ok(openPreview(activate, doc).webview.html.includes("Plain"));
		assert.equal(typeof handlers.chooseRenderer, "function");
	});
});

describe("Content Security Policy for the renderer", () => {
	const page = (origin) => getWebviewContent("", "NONCE", [], {}, "doc", origin);
	const imgSrc = (html) => /img-src ([^;]*);/.exec(html)[1];

	it("adds the configured origin to img-src and nowhere else", () => {
		const html = page("http://localhost:8080");
		assert.equal(imgSrc(html), "https: data: vscode-resource: http://localhost:8080");
		assert.equal((html.match(/http:\/\/localhost:8080/g) || []).length, 1);
	});

	it("leaves the policy as before when no renderer is set", () => {
		assert.equal(imgSrc(page(undefined)), "https: data: vscode-resource:");
		assert.equal(imgSrc(page("")), "https: data: vscode-resource:");
	});

	it("never allows http: as a whole scheme", () => {
		for (const origin of [undefined, "http://localhost:8080", "https://kroki.io"]) {
			assert.ok(!/(^|\s)http:(\s|;|$)/.test(imgSrc(page(origin))), String(origin));
		}
	});

	it("keeps every other directive unchanged", () => {
		const csp = /Content-Security-Policy" content="([^"]*)"/.exec(page("http://localhost:8080"))[1];
		assert.ok(csp.startsWith("default-src 'none';"));
		assert.ok(csp.includes("script-src 'nonce-NONCE' 'strict-dynamic';"));
		assert.ok(!csp.includes("connect-src"));
	});

	it("takes the origin from the validated setting", () => {
		assert.equal(render("```d2\nx\n```").d2Origin, BASE);
		assert.equal(
			renderMarkdown("```d2\nx\n```", { d2: { rendererUrl: "https://kroki.io/" } }).d2Origin,
			"https://kroki.io"
		);
	});
});

describe("hostile input", () => {
	// Escaped text may contain "onerror=" harmlessly; only real tags can carry a handler or a script
	const noScript = (html) =>
		!/<script/i.test(html) &&
		!(html.match(/<[a-z][^>]*>/gi) || []).some((tag) => /\son\w+\s*=|javascript:/i.test(tag));

	it("escapes D2 source that tries to close the block and add a script", () => {
		const source = "</pre><script>alert(1)</script><img src=x onerror=alert(1)>\"'";
		const { html } = render("```d2\n" + source + "\n```");
		assert.ok(noScript(html), html);
		assert.ok(html.includes("&lt;/pre&gt;&lt;script&gt;"));
	});

	it("escapes the same source when it is shown as a setup message", () => {
		const { html } = renderMarkdown("```d2\n</div><script>alert(1)</script>\n```", { d2: { rendererUrl: "" } });
		assert.ok(noScript(html), html);
	});

	it("cannot break out of the src attribute through the source", () => {
		const { html } = render('```d2\n" onerror="alert(1)\n```');
		const tag = /<img [^>]*>/.exec(html)[0];
		assert.ok(!/ onerror=/.test(tag), tag);
	});

	for (const hostile of [
		'https://x.test/"><script>alert(1)</script>',
		"https://x.test/' onerror='alert(1)",
		"http://x.test;script-src * 'unsafe-inline'",
		"http://x.test,evil.test",
		"https://x.test/</figure><script>alert(1)</script>",
	]) {
		it(`never lets the setting ${JSON.stringify(hostile)} add script or a CSP directive`, () => {
			const { html, d2Origin } = renderMarkdown("```d2\nx\n```", { d2: { rendererUrl: hostile } });
			assert.ok(noScript(html), html);
			const csp = /Content-Security-Policy" content="([^"]*)"/.exec(
				getWebviewContent(html, "N", [], {}, "d", d2Origin)
			)[1];
			assert.ok(!csp.includes("unsafe-inline';") || csp.includes("style-src 'unsafe-inline'"));
			assert.ok(!/script-src \*/.test(csp));
			assert.equal(csp.split(";").length, 8, csp);
		});
	}

	it("does not treat a document's own <img> pointing at the renderer as special", () => {
		const { html } = render(`<img src="${BASE}/d2/svg/abc" width="10">`);
		assert.ok(html.includes(`<img src="${BASE}/d2/svg/abc" width="10">`));
	});
});

describe("settings, theme and command", () => {
	const doc = makeDoc("/docs/d.md", "# T\n\n```d2\nx -> y\n```\n");
	const src = (panel) => /class="d2-img" src="([^"]+)"/.exec(panel.webview.html)?.[1].replace(/&amp;/g, "&");

	afterEach(() => mock.timers.reset());

	it("reads the renderer setting and admits only its origin", () => {
		settings["lightweightMarkdownViewer.d2.rendererUrl"] = "http://localhost:9999/";
		const panel = openPreview(activate, doc);
		assert.ok(src(panel).startsWith("http://localhost:9999/d2/svg/"));
		assert.ok(src(panel).endsWith("?theme=0"));
		assert.ok(panel.webview.html.includes("img-src https: data: vscode-resource: http://localhost:9999;"));
	});

	it("ignores layout and sketch settings: those belong to the diagram", () => {
		settings["lightweightMarkdownViewer.d2.rendererUrl"] = BASE;
		settings["lightweightMarkdownViewer.d2.layout"] = "elk";
		settings["lightweightMarkdownViewer.d2.sketch"] = true;
		assert.ok(src(openPreview(activate, doc)).endsWith("?theme=0"));
		assert.ok(configSections.every((section) => section === "lightweightMarkdownViewer.d2"));
	});

	it("keeps D2 fences as code blocks, with img-src unchanged, when the setting is empty", () => {
		const panel = openPreview(activate, doc);
		assert.ok(panel.webview.html.includes('<pre><code class="language-d2">x -&gt; y'));
		assert.ok(panel.webview.html.includes("d2-hint"));
		assert.ok(panel.webview.html.includes("img-src https: data: vscode-resource:;"));
	});

	it("maps light themes to D2 theme 0 and dark and high-contrast themes to 200", () => {
		settings["lightweightMarkdownViewer.d2.rendererUrl"] = BASE;
		for (const [kind, theme] of [
			[1, 0],
			[2, 200],
			[3, 200],
			[4, 0],
		]) {
			vscode.window.activeColorTheme.kind = kind;
			assert.ok(src(openPreview(activate, doc)).includes(`?theme=${theme}`), `kind ${kind}`);
		}
	});

	it("draws the open preview again when a D2 setting changes, and only then", () => {
		settings["lightweightMarkdownViewer.d2.rendererUrl"] = BASE;
		const panel = openPreview(activate, doc);
		const before = panel.renders;
		handlers.config({ affectsConfiguration: (id) => id === "editor.fontSize" });
		assert.equal(panel.renders, before);
		settings["lightweightMarkdownViewer.d2.rendererUrl"] = "https://kroki.io";
		handlers.config({ affectsConfiguration: (id) => id === "lightweightMarkdownViewer.d2" });
		assert.equal(panel.renders, before + 1);
		assert.ok(src(panel).startsWith("https://kroki.io/d2/svg/"));
	});

	it("waits longer after an edit in a document with D2 once a renderer is set", () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		settings["lightweightMarkdownViewer.d2.rendererUrl"] = BASE;
		const panel = openPreview(activate, doc);
		const before = panel.renders;
		handlers.docChange({ document: doc });
		mock.timers.tick(300);
		assert.equal(panel.renders, before, "still waiting after 300 ms");
		mock.timers.tick(500);
		assert.equal(panel.renders, before + 1);
	});

	it("keeps the 300 ms wait for documents without D2, or without a renderer", () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		const plain = makeDoc("/docs/p.md", "# plain");
		settings["lightweightMarkdownViewer.d2.rendererUrl"] = BASE;
		let panel = openPreview(activate, plain);
		let before = panel.renders;
		handlers.docChange({ document: plain });
		mock.timers.tick(300);
		assert.equal(panel.renders, before + 1);

		delete settings["lightweightMarkdownViewer.d2.rendererUrl"];
		panel = openPreview(activate, doc);
		before = panel.renders;
		handlers.docChange({ document: doc });
		mock.timers.tick(300);
		assert.equal(panel.renders, before + 1);
	});

	it("stores a quick-pick choice in the user settings", async () => {
		activate({ extensionUri: {}, subscriptions: [] });
		prompts.quickPick = (items) => items[0];
		await handlers.chooseRenderer();
		assert.deepEqual(settingUpdates, [
			{
				id: "lightweightMarkdownViewer.d2.rendererUrl",
				value: "http://localhost:8080",
				target: vscode.ConfigurationTarget.Global,
			},
		]);
		assert.ok(
			prompts.quickPickItems.some((item) => item.url === "https://kroki.io" && /third-party/.test(item.detail))
		);
	});

	it("normalizes a typed URL, and does nothing when the pick or the input is cancelled", async () => {
		activate({ extensionUri: {}, subscriptions: [] });
		prompts.quickPick = (items) => items.find((item) => item.url === undefined);
		prompts.inputBox = " https://d2.example.com// ";
		await handlers.chooseRenderer();
		assert.equal(settingUpdates[0].value, "https://d2.example.com");

		settingUpdates.length = 0;
		prompts.inputBox = undefined;
		await handlers.chooseRenderer();
		prompts.quickPick = undefined;
		await handlers.chooseRenderer();
		assert.deepEqual(settingUpdates, []);
	});

	it("validates what is typed before accepting it", async () => {
		activate({ extensionUri: {}, subscriptions: [] });
		prompts.quickPick = (items) => items.find((item) => item.url === undefined);
		prompts.inputBox = "https://ok.example";
		await handlers.chooseRenderer();
		const { validateInput } = prompts.inputBoxOptions;
		assert.equal(validateInput("https://ok.example"), undefined);
		assert.ok(validateInput("javascript:alert(1)"));
		assert.ok(validateInput("http://u:p@host"));
		assert.ok(validateInput(""));
	});

	it("clears the setting for 'Turn D2 rendering off'", async () => {
		activate({ extensionUri: {}, subscriptions: [] });
		prompts.quickPick = (items) => items.find((item) => item.url === "");
		await handlers.chooseRenderer();
		assert.equal(settingUpdates[0].value, "");
	});
});

describe("manifest and page contract", () => {
	const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
	const template = fs.readFileSync(path.join(__dirname, "../src/webview.html"), "utf8");

	it("declares the command and the one setting", () => {
		assert.ok(
			manifest.contributes.commands.some((c) => c.command === "lightweightMarkdownViewer.chooseD2Renderer")
		);
		const props = manifest.contributes.configuration.properties;
		assert.deepEqual(Object.keys(props), ["lightweightMarkdownViewer.d2.rendererUrl"]);
	});

	it("keeps the renderer URL out of workspace settings", () => {
		assert.equal(
			manifest.contributes.configuration.properties["lightweightMarkdownViewer.d2.rendererUrl"].scope,
			"application"
		);
	});

	it("puts the renderer origin in img-src only, and swaps a failed image for its message in the page script", () => {
		assert.ok(template.includes("img-src https: data: vscode-resource:{{RENDERER_ORIGIN}};"));
		assert.equal((template.match(/\{\{RENDERER_ORIGIN\}\}/g) || []).length, 1);
		assert.ok(template.includes("img.d2-img"));
		assert.ok(
			template.includes("querySelectorAll('.d2-error, .d2-source')"),
			"unhide the message and source by name"
		);
		assert.ok(
			!template.includes("querySelectorAll('[hidden]')"),
			"a [hidden] selector would un-hide the failed image again"
		);
		assert.ok(
			template.includes("img.complete && img.naturalWidth === 0"),
			"an image that failed before the script ran"
		);
		assert.ok(template.includes("addEventListener('error', showFailure"), "an image that fails later");
		assert.ok(template.indexOf("img.d2-img") < template.indexOf("import('https://cdn.jsdelivr.net"));
		assert.ok(!template.includes("connect-src"));
	});

	it("does not add a message from the page to the extension", () => {
		assert.ok(
			!/postMessage|onDidReceiveMessage/.test(
				template + fs.readFileSync(path.join(__dirname, "../src/extension.js"), "utf8")
			)
		);
	});
});
