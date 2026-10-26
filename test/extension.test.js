const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { install } = require("./helpers/fake-vscode");

install();

// --- Load the extension module ---
const {
	extractHeadings,
	buildTOCTree,
	generateTOC,
	getNonce,
	escapeHtml,
	renderMarkdown,
	getWebviewContent,
	CDN_VERSIONS,
} = require("../src/extension");

// ============================================================================
// extractHeadings
// ============================================================================
describe("extractHeadings", () => {
	it("extracts h1–h6 headings", () => {
		const md = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6";
		const result = extractHeadings(md);
		assert.equal(result.length, 6);
		assert.deepEqual(
			result.map((h) => h.level),
			[1, 2, 3, 4, 5, 6]
		);
		assert.deepEqual(
			result.map((h) => h.text),
			["H1", "H2", "H3", "H4", "H5", "H6"]
		);
	});

	it("returns empty array for input with no headings", () => {
		assert.deepEqual(extractHeadings("Just a paragraph.\nAnother line."), []);
	});

	it("returns empty array for empty string", () => {
		assert.deepEqual(extractHeadings(""), []);
	});

	it("ignores headings inside backtick code blocks", () => {
		const md = "# Real\n```\n# Fake\n```\n## Also Real";
		const result = extractHeadings(md);
		assert.equal(result.length, 2);
		assert.equal(result[0].text, "Real");
		assert.equal(result[1].text, "Also Real");
	});

	it("ignores headings inside triple-colon mermaid blocks", () => {
		const md = "# Before\n::: mermaid\n# Not a heading\n:::\n## After";
		const result = extractHeadings(md);
		assert.equal(result.length, 2);
		assert.equal(result[0].text, "Before");
		assert.equal(result[1].text, "After");
	});

	it("handles nested code blocks correctly", () => {
		const md = "# A\n```\ncode\n```\n# B\n```\n# C inside code\n```\n# D";
		const result = extractHeadings(md);
		assert.equal(result.length, 3);
		assert.deepEqual(
			result.map((h) => h.text),
			["A", "B", "D"]
		);
	});

	it("generates GitHub-style IDs", () => {
		assert.equal(extractHeadings("# Hello World!")[0].id, "hello-world");
		assert.equal(extractHeadings("## C++ & Java: A Comparison")[0].id, "c--java-a-comparison");
		assert.equal(extractHeadings("# \u00dcberblick")[0].id, "\u00fcberblick");
	});

	it("numbers duplicate IDs so every anchor is unique", () => {
		const ids = extractHeadings("# Intro\n\n## Intro\n\n## Intro").map((h) => h.id);
		assert.deepEqual(ids, ["intro", "intro-1", "intro-2"]);
	});

	it("falls back to a stable ID when the text has no usable characters", () => {
		const ids = extractHeadings("# !!!\n\n# ???").map((h) => h.id);
		assert.deepEqual(ids, ["section", "section-1"]);
	});

	it("uses the visible text of formatted headings", () => {
		const [bold, link, code, entity] = extractHeadings(
			"## **Bold** and _soft_ text\n\n## [Docs](https://example.test)\n\n## `a<b`\n\n## Tom &amp; Jerry"
		);
		assert.equal(bold.text, "Bold and soft text");
		assert.equal(bold.id, "bold-and-soft-text");
		assert.equal(link.text, "Docs");
		assert.equal(code.text, "a<b");
		assert.equal(entity.text, "Tom & Jerry");
	});

	it("finds setext headings", () => {
		const result = extractHeadings("Title\n=====\n\nSub\n---\n");
		assert.deepEqual(
			result.map((h) => [h.level, h.text]),
			[
				[1, "Title"],
				[2, "Sub"],
			]
		);
	});

	it("finds headings inside blockquotes and list items", () => {
		const result = extractHeadings("> # Quoted\n\n- # Listed\n");
		assert.deepEqual(
			result.map((h) => h.text),
			["Quoted", "Listed"]
		);
	});

	it("ignores headings inside tilde and indented fences", () => {
		const md = "~~~\n# Tilde\n~~~\n\n  ```\n# Indented\n  ```\n\n# Real";
		assert.deepEqual(
			extractHeadings(md).map((h) => h.text),
			["Real"]
		);
	});

	it("requires a space after the hash marks", () => {
		const md = "#NoSpace\n## Has Space";
		const result = extractHeadings(md);
		assert.equal(result.length, 1);
		assert.equal(result[0].text, "Has Space");
	});

	it("ignores lines with more than 6 hashes", () => {
		const md = "####### Not a heading\n###### Valid H6";
		const result = extractHeadings(md);
		assert.equal(result.length, 1);
		assert.equal(result[0].level, 6);
	});

	it("records correct lineIndex for each heading", () => {
		const md = "paragraph\n# First\nparagraph\n## Second";
		const result = extractHeadings(md);
		assert.equal(result[0].lineIndex, 1);
		assert.equal(result[1].lineIndex, 3);
	});
});

// ============================================================================
// buildTOCTree
// ============================================================================
describe("buildTOCTree", () => {
	it("returns empty array for no headings", () => {
		assert.deepEqual(buildTOCTree([]), []);
	});

	it("puts same-level headings as siblings at root", () => {
		const headings = [
			{ level: 2, text: "A", id: "a" },
			{ level: 2, text: "B", id: "b" },
			{ level: 2, text: "C", id: "c" },
		];
		const tree = buildTOCTree(headings);
		assert.equal(tree.length, 3);
		tree.forEach((node) => assert.equal(node.children.length, 0));
	});

	it("nests lower-level headings under higher-level parents", () => {
		const headings = [
			{ level: 1, text: "Parent", id: "p" },
			{ level: 2, text: "Child", id: "c" },
			{ level: 3, text: "Grandchild", id: "gc" },
		];
		const tree = buildTOCTree(headings);
		assert.equal(tree.length, 1);
		assert.equal(tree[0].heading.text, "Parent");
		assert.equal(tree[0].children.length, 1);
		assert.equal(tree[0].children[0].heading.text, "Child");
		assert.equal(tree[0].children[0].children.length, 1);
		assert.equal(tree[0].children[0].children[0].heading.text, "Grandchild");
	});

	it("handles skipped levels (h1 → h3 with no h2)", () => {
		const headings = [
			{ level: 1, text: "Top", id: "t" },
			{ level: 3, text: "Deep", id: "d" },
		];
		const tree = buildTOCTree(headings);
		assert.equal(tree.length, 1);
		assert.equal(tree[0].children.length, 1);
		assert.equal(tree[0].children[0].heading.text, "Deep");
	});

	it("handles multiple top-level sections with children", () => {
		const headings = [
			{ level: 1, text: "Section A", id: "a" },
			{ level: 2, text: "Sub A1", id: "a1" },
			{ level: 1, text: "Section B", id: "b" },
			{ level: 2, text: "Sub B1", id: "b1" },
		];
		const tree = buildTOCTree(headings);
		assert.equal(tree.length, 2);
		assert.equal(tree[0].children.length, 1);
		assert.equal(tree[1].children.length, 1);
	});
});

// ============================================================================
// generateTOC
// ============================================================================
describe("generateTOC", () => {
	it("returns 'No headings found' message for empty array", () => {
		const result = generateTOC([]);
		assert.ok(result.includes("No headings found"));
		assert.ok(result.includes("var(--vscode-descriptionForeground)"));
	});

	it("generates a <ul> list for non-empty headings", () => {
		const headings = [{ level: 1, text: "Title", id: "title" }];
		const result = generateTOC(headings);
		assert.ok(result.includes('<ul class="toc-list">'));
		assert.ok(result.includes("Title"));
		assert.ok(result.includes('href="#title"'));
	});

	it("uses <details>/<summary> for headings with children", () => {
		const headings = [
			{ level: 1, text: "Parent", id: "p" },
			{ level: 2, text: "Child", id: "c" },
		];
		const result = generateTOC(headings);
		assert.ok(result.includes("<details"));
		assert.ok(result.includes("<summary"));
	});

	it("marks h1 details as open by default", () => {
		const headings = [
			{ level: 1, text: "Open", id: "o" },
			{ level: 2, text: "Child", id: "c" },
		];
		const result = generateTOC(headings);
		assert.ok(result.includes("open"));
	});

	it("shows correct prefix pound signs", () => {
		const headings = [{ level: 3, text: "Heading", id: "h" }];
		const result = generateTOC(headings);
		assert.ok(result.includes("###"));
	});
});

// ============================================================================
// getNonce
// ============================================================================
describe("getNonce", () => {
	it("returns a 32-character string", () => {
		assert.equal(getNonce().length, 32);
	});

	it("is hexadecimal", () => {
		assert.match(getNonce(), /^[0-9a-f]{32}$/);
	});

	it("contains only alphanumeric characters", () => {
		const nonce = getNonce();
		assert.match(nonce, /^[A-Za-z0-9]{32}$/);
	});

	it("generates different values on successive calls", () => {
		const a = getNonce();
		const b = getNonce();
		assert.notEqual(a, b);
	});
});

// ============================================================================
// escapeHtml
// ============================================================================
describe("escapeHtml", () => {
	it("escapes &, <, > and double quotes", () => {
		assert.equal(escapeHtml('<a href="x">&</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
	});

	it("leaves plain text unchanged", () => {
		assert.equal(escapeHtml("plain text 123"), "plain text 123");
	});
});

// ============================================================================
// generateTOC escaping
// ============================================================================
describe("generateTOC escaping", () => {
	it("escapes HTML in heading text", () => {
		const html = generateTOC(extractHeadings("# <img src=x onerror=alert(1)>"));
		assert.ok(!html.includes("<img"));
		assert.ok(html.includes("&lt;img"));
	});
});

// ============================================================================
// renderMarkdown
// ============================================================================
describe("renderMarkdown math", () => {
	const html = (md) => renderMarkdown(md).html;

	it("wraps inline math in MathJax inline delimiters", () => {
		assert.ok(html("Energy $E = mc^2$ here").includes('<span class="math-inline">\\(E = mc^2\\)</span>'));
	});

	it("wraps block math in MathJax display delimiters, on one line or several", () => {
		const multi = html("$$\n\\int x\n$$\n");
		assert.ok(multi.includes('<div class="math-block">\\[\n\\int x\n\\]</div>'), multi);
		const single = html("$$ x^2 + y^2 $$");
		assert.ok(single.includes('<div class="math-block">\\[ x^2 + y^2 \\]</div>'), single);
	});

	it("renders display math written inside a sentence", () => {
		assert.ok(html("so $$x$$ holds").includes('<span class="math-display">\\[x\\]</span>'));
	});

	it("emits no dollar delimiters, so the page cannot pair stray dollar signs", () => {
		const out = html("$a$ and $$\nb\n$$\n\nIt costs $5 and $10.");
		assert.ok(!/math-(inline|block)">\$/.test(out));
		assert.ok(out.includes("It costs $5 and $10."));
		assert.equal((out.match(/math-/g) || []).length, 2, "only the real formulas are marked");
	});

	it("keeps prices as text", () => {
		const out = html("It costs $5 and $10 total, or $5.");
		assert.ok(!out.includes("math-"));
		assert.ok(out.includes("$5 and $10 total"));
	});

	it("does not start a formula on a dollar sign followed by a space", () => {
		assert.ok(!html("a $ b + c$ d").includes("math-"));
	});

	it("does not end a formula on a dollar sign that is followed by a digit", () => {
		assert.ok(!html("US$5 and US$10").includes("math-"));
	});

	it("keeps an escaped dollar sign as text", () => {
		const out = html("price \\$5 and \\$6");
		assert.ok(!out.includes("math-"));
		assert.ok(out.includes("price $5 and $6"));
	});

	it("leaves dollar signs in code spans and fences alone", () => {
		const out = html("use `$HOME` and `$PATH` vars\n\n```bash\necho $HOME $PATH\n```\n");
		assert.ok(!out.includes("math-"));
		assert.ok(out.includes("<code>$HOME</code>"));
		assert.ok(out.includes("echo $HOME $PATH"));
		assert.ok(!out.includes("PRESERVED"));
	});

	it("shows complete math expressions inside code spans as written", () => {
		const out = html(
			"1. Writing `$x$` and `$$ math here $$` shows source.\n\n| a |\n| - |\n| `$x$` |\n\n- `$a$ and $b$`\n"
		);
		assert.ok(out.includes("<code>$x$</code>"));
		assert.ok(out.includes("<code>$$ math here $$</code>"));
		assert.ok(out.includes("<code>$a$ and $b$</code>"));
		assert.ok(!out.includes("math-") && !out.includes("PRESERVED"));
	});

	it("does not treat underscores or asterisks in a formula as emphasis", () => {
		const out = html("$a_b + c_d$ and $a*b*c$");
		assert.ok(out.includes("\\(a_b + c_d\\)"));
		assert.ok(out.includes("\\(a*b*c\\)"));
		assert.ok(!out.includes("<em>"));
	});

	it("escapes HTML characters inside math", () => {
		const out = html("$a<b$ and $$\nx & y\n$$");
		assert.ok(out.includes("\\(a&lt;b\\)"));
		assert.ok(out.includes("x &amp; y"));
	});

	it("does not let a block formula run across a blank line", () => {
		const out = html("$$ open\n\ntext\n\nclose $$");
		assert.ok(!out.includes("math-block"));
	});

	it("leaves a lone dollar sign untouched", () => {
		assert.equal(html("a $ b"), "<p>a $ b</p>\n");
	});

	it("keeps math out of heading text", () => {
		const { headings } = renderMarkdown("## Area $\\pi r^2$\n");
		assert.equal(headings[0].text, "Area $\\pi r^2$");
	});
});

describe("renderMarkdown Mermaid", () => {
	const html = (md) => renderMarkdown(md).html;

	it("keeps dollar signs inside Mermaid blocks out of math handling", () => {
		const out = html('```mermaid\ngraph TD\n  A["$5"] --> B["$6"]\n```\n');
		assert.ok(out.includes('<pre class="mermaid">'));
		assert.ok(out.includes("$5") && out.includes("$6"));
		assert.ok(!out.includes("math-"));
	});

	it("renders both Mermaid syntaxes identically", () => {
		const a = html("```mermaid\ngraph TD\n  A-->B\n```\n");
		const b = html("::: mermaid\ngraph TD\n  A-->B\n:::\n");
		assert.equal(a, b);
		assert.ok(a.includes('<pre class="mermaid">graph TD\n  A--&gt;B</pre>'));
	});

	it("accepts a tilde fence and a closing colon fence at the end of the file", () => {
		assert.ok(html("~~~mermaid\ngraph TD\n  A-->B\n~~~\n").includes('<pre class="mermaid">'));
		assert.ok(html("::: mermaid\ngraph TD\n  A-->B\n:::").includes('<pre class="mermaid">'));
	});

	it("escapes markup in Mermaid source so it cannot break out of the pre element", () => {
		const out = html("```mermaid\ngraph TD\n  A[</pre><img src=x>]\n```\n");
		assert.ok(!out.includes("<img src=x>"));
	});

	it("keeps a diagram inside its list item", () => {
		const out = html("- item\n\n  ```mermaid\n  graph TD\n    A-->B\n  ```\n- next\n");
		assert.match(out, /<li><p>item<\/p>\s*<pre class="mermaid">[\s\S]*<\/pre>\s*<\/li>\s*<li><p>next<\/p>/);
	});

	it("leaves other fenced languages as highlighted code", () => {
		assert.ok(html("```js\nlet a = 1;\n```\n").includes('<code class="language-js">'));
	});

	it("does not render a placeholder-like comment from the document as content", () => {
		const out = html("<!--PRESERVED_0-->\n\n$x$");
		assert.ok(out.includes("<!--PRESERVED_0-->"));
		assert.ok(out.includes("math-inline"));
	});
});

describe("renderMarkdown headings", () => {
	it("adds heading IDs matching the extracted headings", () => {
		const { html, headings } = renderMarkdown("# Title\n\n## Sub\n");
		assert.equal(headings.length, 2);
		for (const h of headings) {
			assert.ok(html.includes(`<h${h.level} id="${h.id}">`));
		}
	});

	it("keeps every ID on its own heading when fences, setext headings and quotes are mixed in", () => {
		const md = "~~~\n# Fake\n~~~\n\nTitle\n=====\n\n> # Quoted\n\n# Real\n";
		const { html, headings } = renderMarkdown(md);
		assert.deepEqual(
			headings.map((h) => h.text),
			["Title", "Quoted", "Real"]
		);
		assert.ok(html.includes('<h1 id="title">Title</h1>'));
		assert.ok(html.includes('<h1 id="quoted">Quoted</h1>'));
		assert.ok(html.includes('<h1 id="real">Real</h1>'));
		assert.ok(!html.includes('id="fake"'));
	});

	it("makes an in-page link point at the heading it names", () => {
		const { html } = renderMarkdown("# Intro\n\nSee [the intro](#intro).\n");
		assert.ok(html.includes('<a href="#intro">the intro</a>'));
		assert.ok(html.includes('<h1 id="intro">'));
	});

	it("renders formatted headings with their markup and plain-text outline entries", () => {
		const { html, headings } = renderMarkdown("## **Bold** text\n");
		assert.ok(html.includes('<h2 id="bold-text"><strong>Bold</strong> text</h2>'));
		assert.equal(headings[0].text, "Bold text");
	});

	it("records the source line of each top-level heading", () => {
		const { headings } = renderMarkdown("para\n\n# First\n\n```\ncode\n```\n\n## Second\n");
		assert.deepEqual(
			headings.map((h) => h.lineIndex),
			[2, 8]
		);
	});
});

describe("renderMarkdown images", () => {
	it("passes each Markdown image address through resolveImage", () => {
		const { html } = renderMarkdown('![alt](./a.png "Title") and [link](./a.png)', {
			resolveImage: (href) => `resolved:${href}`,
		});
		assert.ok(html.includes('<img src="resolved:./a.png" alt="alt" title="Title">'));
		assert.ok(html.includes('<a href="./a.png">link</a>'), "links are not images");
	});

	it("resolves raw HTML images, whatever the attribute order or quote style", () => {
		const resolveImage = (href) => `r:${href}`;
		const md =
			'<img src="a.png" width="300">\n\ntext <img alt=\'x\' src=\'b.png\'> more\n\n<p><img\n  src="c.png"></p>\n';
		const { html } = renderMarkdown(md, { resolveImage });
		for (const name of ["a", "b", "c"]) {
			assert.ok(html.includes(`src="r:${name}.png"`) || html.includes(`src='r:${name}.png'`), name);
		}
		assert.ok(html.includes('width="300"'));
	});

	it("does not rewrite image-looking text in code", () => {
		const { html } = renderMarkdown('`<img src="a.png">`\n\n```html\n<img src="b.png">\n```\n', {
			resolveImage: (href) => `r:${href}`,
		});
		assert.ok(!html.includes("r:"));
	});

	it("leaves image addresses alone when no resolver is given", () => {
		assert.ok(renderMarkdown("![a](./a.png)").html.includes('<img src="./a.png"'));
	});

	it("reaches images nested in links, lists and tables", () => {
		const resolveImage = (href) => `r:${href}`;
		const md = "[![b](b.png)](https://example.test)\n\n- ![c](c.png)\n\n| h |\n| - |\n| ![d](d.png) |\n";
		const { html } = renderMarkdown(md, { resolveImage });
		for (const name of ["b", "c", "d"]) {
			assert.ok(html.includes(`src="r:${name}.png"`), name);
		}
	});
});

// ============================================================================
// getWebviewContent
// ============================================================================
describe("getWebviewContent", () => {
	const theme = { mermaidTheme: "default", hljsTheme: "https://example.test/theme.css" };
	const page = getWebviewContent("<p>x</p>", "NONCE123", [], theme);

	it("leaves no unreplaced placeholders", () => {
		assert.ok(!/\{\{[A-Z_]+\}\}/.test(page));
	});

	it("loads every CDN library at its pinned version", () => {
		assert.ok(page.includes(`mermaid@${CDN_VERSIONS.mermaid}/`));
		assert.ok(page.includes(`mathjax@${CDN_VERSIONS.mathjax}/`));
		assert.ok(page.includes(`cdn-assets@${CDN_VERSIONS.highlightjs}/`));
		assert.ok(!/(mermaid|mathjax)@\d+\//.test(page), "floating major version found");
	});

	it("lets MathJax read only the delimiters the renderer emits", () => {
		assert.ok(page.includes("inlineMath: [['\\\\(', '\\\\)']]"));
		assert.ok(page.includes("displayMath: [['\\\\[', '\\\\]']]"));
		assert.ok(!page.includes("['$'"), "a dollar delimiter would pair prices and shell variables");
	});

	it("wires the outline sidebar before it waits for Mermaid", () => {
		const wiring = page.indexOf("classList.add('sidebar-open')");
		const mermaidImport = page.indexOf("await import(");
		assert.ok(wiring > 0 && mermaidImport > 0);
		assert.ok(wiring < mermaidImport, "a slow Mermaid load would leave the sidebar dead");
	});

	it("puts the nonce on every script tag and in the CSP", () => {
		const scripts = page.match(/<script\b[^>]*>/g);
		assert.ok(scripts.length >= 4);
		for (const tag of scripts) {
			assert.ok(tag.includes('nonce="NONCE123"'), tag);
		}
		assert.ok(page.includes("'nonce-NONCE123'"));
	});
});

// ============================================================================
// getWebviewContent placeholders
// ============================================================================
describe("getWebviewContent placeholders", () => {
	const theme = { mermaidTheme: "default", hljsTheme: "https://example.test/theme.css" };

	it("writes an escaped document key for the scroll position", () => {
		const page = getWebviewContent("", "N", [], theme, 'file:///a"b.md');
		assert.ok(page.includes('data-doc="file:///a&quot;b.md"'));
	});

	it("does not substitute placeholder text that appears inside content", () => {
		const page = getWebviewContent("<p>{{TOC}} and {{NONCE}}</p>", "N", extractHeadings("# {{CONTENT}}"), theme);
		assert.ok(page.includes("<p>{{TOC}} and {{NONCE}}</p>"));
		assert.ok(page.includes("{{CONTENT}}"));
	});
});

// ============================================================================
// package.json manifest capabilities
// ============================================================================
describe("package.json manifest capabilities", () => {
	const pkg = require("../package.json");

	it("declares untrustedWorkspaces capability as supported", () => {
		assert.equal(pkg.capabilities?.untrustedWorkspaces?.supported, true);
	});
});
