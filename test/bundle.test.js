const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { install, makeDoc, openPreview } = require("./helpers/fake-vscode");

install();

const bundlePath = path.resolve(__dirname, "../dist/extension.js");

// The source tests load webview.html through a test shim. This suite loads the webpack
// output instead, so it fails when the build stops inlining the template or bundling marked.
describe("webpack bundle", () => {
	it("exists (run `npm run build` first)", () => {
		assert.ok(fs.existsSync(bundlePath), `${bundlePath} is missing`);
	});

	it("renders a complete page from the bundled code", () => {
		const bundle = require(bundlePath);
		const markdown = "# Bundle heading\n\nInline $a<b$ and `echo $HOME $PATH`.\n\n```mermaid\ngraph TD\n  A-->B\n```\n";
		const html = openPreview(bundle.activate, makeDoc("/docs/bundle.md", markdown)).webview.html;

		assert.ok(html.startsWith("<!DOCTYPE html>"));
		assert.ok(html.includes("Content-Security-Policy"));
		assert.ok(html.includes('<h1 id="bundle-heading">Bundle heading</h1>'));
		assert.ok(html.includes('<span class="math-inline">\\(a&lt;b\\)</span>'));
		assert.ok(html.includes("<code>echo $HOME $PATH</code>"), "dollar signs in code survive the bundled parser");
		assert.ok(html.includes('<pre class="mermaid">'));
		assert.ok(!/\{\{[A-Z_]+\}\}/.test(html), "unreplaced template placeholder");
		assert.ok(html.includes(`mermaid@${bundle.CDN_VERSIONS.mermaid}/`));
	});
});
