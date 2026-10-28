/**
 * Tests for the page's security policy: what the CSP says, and what a browser does with it.
 *
 * Why it exists: raw HTML in a document passes through `marked`, so the CSP is the only control between a
 * hostile document and the page. The first half pins the policy text. The second half loads the real page in
 * headless Chrome and checks the effect, because a policy that reads well can still fail to block; the first
 * version of this policy allowed jsDelivr scripts by host, and a document's own `<script src>` ran.
 * The browser half skips itself when Chrome is missing (set CHROME to its path), and the part that needs the
 * CDN skips itself when the CDN cannot be reached.
 */
/* global WebSocket, fetch, AbortSignal */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { install } = require("./helpers/fake-vscode");

install();
const { renderMarkdown, getWebviewContent } = require("../src/extension");

const theme = {
	mermaidTheme: "default",
	hljsTheme: "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/styles/atom-one-light.min.css",
	d2Theme: 0,
};
const JQUERY = "https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js";

/**
 * Builds the page for one document.
 *
 * @param {string} source - Markdown text
 * @param {string} [d2Origin] - Renderer origin for img-src
 * @returns {string} Complete page with the nonce NONCE123
 */
function page(source, d2Origin = "") {
	const { html, headings } = renderMarkdown(source);
	return getWebviewContent(html, "NONCE123", headings, theme, "doc", d2Origin);
}

/**
 * Reads the CSP directives from a page.
 *
 * @param {string} html - Complete page
 * @returns {Map<string, string>} Directive name to its value
 */
function directives(html) {
	const csp = /Content-Security-Policy" content="([^"]*)"/.exec(html)[1];
	return new Map(
		csp
			.split(";")
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => {
				const [name, ...value] = part.split(/\s+/);
				return [name, value.join(" ")];
			})
	);
}

describe("Content Security Policy text", () => {
	const policy = directives(page("# x"));

	it("runs only scripts that carry the nonce or that a nonce-carrying script loads", () => {
		assert.equal(policy.get("script-src"), "'nonce-NONCE123' 'strict-dynamic'");
	});

	it("names no host in script-src, so a hosted script cannot ride on the CDN allowance", () => {
		assert.ok(!/https?:|\*/.test(policy.get("script-src")));
	});

	it("blocks <base> and form submission, which do not fall back to default-src", () => {
		assert.equal(policy.get("base-uri"), "'none'");
		assert.equal(policy.get("form-action"), "'none'");
	});

	it("keeps everything else shut: no network from scripts, no frames, no objects", () => {
		assert.equal(policy.get("default-src"), "'none'");
		for (const name of ["connect-src", "frame-src", "child-src", "object-src", "worker-src", "navigate-to"]) {
			assert.ok(!policy.has(name), `${name} would open what default-src closes`);
		}
	});

	it("allows no inline script, eval or inline event handler", () => {
		const text = [...policy.values()].join(" ");
		assert.ok(!text.includes("unsafe-eval"));
		assert.ok(!/script-src[^;]*unsafe-inline/.test([...policy].map(([k, v]) => `${k} ${v}`).join(";")));
	});

	it("limits style-src to inline styles and the CDN that serves the highlight.js theme", () => {
		assert.equal(policy.get("style-src"), "'unsafe-inline' https://cdn.jsdelivr.net");
	});

	it("sends no Referer header from the page", () => {
		assert.match(page("# x"), /<meta name="referrer" content="no-referrer">/);
	});

	it("keeps the nonce on every script the template ships", () => {
		const template = page("");
		for (const tag of template.match(/<script\b[^>]*>/g)) {
			assert.ok(tag.includes('nonce="NONCE123"'), tag);
		}
	});

	it("adds only the validated renderer origin, and only to img-src", () => {
		const withD2 = directives(page("# x", "http://localhost:8080"));
		assert.equal(withD2.get("img-src"), `${policy.get("img-src")} http://localhost:8080`);
		for (const [name, value] of policy) {
			if (name !== "img-src") {
				assert.equal(withD2.get(name), value, name);
			}
		}
	});
});

// A hostile document's markup reaches the page unchanged, which is why the browser half below matters
describe("raw HTML in a document", () => {
	it("passes through unchanged, so <details>, <kbd> and sized images keep working", () => {
		const html = renderMarkdown(
			'<details><summary>More</summary>Hi <kbd>Ctrl</kbd></details>\n\n<img src="https://x.test/a.png" width="300">'
		).html;
		assert.ok(html.includes("<details><summary>More</summary>"));
		assert.ok(html.includes("<kbd>Ctrl</kbd>"));
		assert.ok(html.includes('width="300"'));
	});
});

/** Finds a Chrome binary, or returns undefined */
function findChrome() {
	const candidates = [
		process.env.CHROME,
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/usr/bin/google-chrome",
		"/usr/bin/google-chrome-stable",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
	];
	return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

const CHROME = findChrome();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Loads pages in headless Chrome and reads state back over the DevTools protocol.
 *
 * Why not Playwright: the extension has one runtime dependency and the dev tools stay small; Node 22 has
 * WebSocket and fetch built in, and the DevTools protocol is enough to evaluate an expression.
 */
function startBrowser() {
	const state = { pages: new Map() };
	const server = http.createServer((request, response) => {
		const body = state.pages.get(request.url.split("?")[0]);
		response.statusCode = body === undefined ? 404 : 200;
		response.setHeader("content-type", "text/html");
		response.end(body ?? "");
	});
	const port = 9400 + Math.floor(Math.random() * 400);
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lmp-security-"));
	let chrome;

	return {
		async start() {
			await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
			chrome = spawn(
				CHROME,
				[
					"--headless=new",
					"--disable-gpu",
					`--remote-debugging-port=${port}`,
					`--user-data-dir=${profile}`,
					"--no-first-run",
					"about:blank",
				],
				{ stdio: "ignore" }
			);
		},
		/**
		 * Opens a page, waits, and evaluates an expression in it.
		 *
		 * @param {string} html - Page body to serve
		 * @param {string} expression - JavaScript to evaluate once the wait is over
		 * @param {{ wait?: number, before?: string }} [options] - `wait` in ms; `before` runs first, then the wait restarts
		 * @returns {Promise<unknown>} The expression's value
		 */
		async run(html, expression, { wait = 1500, before } = {}) {
			const route = `/p${state.pages.size}`;
			state.pages.set(route, html);
			const url = `http://127.0.0.1:${server.address().port}${route}`;
			let target;
			for (let i = 0; i < 50 && !target; i++) {
				try {
					target = await (
						await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })
					).json();
				} catch {
					await sleep(200);
				}
			}
			assert.ok(target, "Chrome did not start");
			const ws = new WebSocket(target.webSocketDebuggerUrl);
			await new Promise((resolve) => (ws.onopen = resolve));
			let id = 0;
			const pending = new Map();
			ws.onmessage = (message) => {
				const data = JSON.parse(message.data);
				if (data.id && pending.has(data.id)) {
					pending.get(data.id)(data.result);
					pending.delete(data.id);
				}
			};
			const evaluate = (code) =>
				new Promise((resolve) => {
					const n = ++id;
					pending.set(n, resolve);
					ws.send(
						JSON.stringify({
							id: n,
							method: "Runtime.evaluate",
							params: { expression: code, returnByValue: true, awaitPromise: true },
						})
					);
				});
			await sleep(wait);
			if (before) {
				await evaluate(before);
				await sleep(wait);
			}
			const result = (await evaluate(expression)).result.value;
			ws.close();
			return result;
		},
		async stop() {
			if (chrome) {
				const exited = new Promise((resolve) => chrome.once("exit", resolve));
				chrome.kill();
				await exited;
			}
			server.close();
			// Chrome's helper processes can still hold files for a moment; a leftover temp folder is harmless
			fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
		},
	};
}

/**
 * Adds a listener, ahead of everything else, that records every CSP violation.
 *
 * @param {string} html - Complete page
 * @returns {string} The page with the recorder in <head>
 */
function recordViolations(html) {
	return html.replace(
		"<head>",
		'<head><script nonce="NONCE123">window.__v=[];document.addEventListener("securitypolicyviolation",e=>__v.push(e.effectiveDirective+" "+e.blockedURI));</script>'
	);
}

describe("the policy in a browser", { skip: CHROME ? false : "Chrome not found; set CHROME" }, () => {
	const browser = startBrowser();
	before(() => browser.start());
	after(() => browser.stop());

	const attacks = {
		"a script tag with a jsDelivr address": `<script src="${JQUERY}"></script>`,
		"the same tag inside a sentence": `text <script src="${JQUERY}"></script> text`,
		"an unclosed script tag, which a tag-stripping regex misses": `text <script src="${JQUERY}">`,
		"upper-case markup": `<SCRIPT SRC=${JQUERY}></SCRIPT>`,
		"a script inside svg": `<svg><script href="${JQUERY}"></script></svg>`,
		"an inline script": "<script>window.jQuery = function () {}</script>",
		"an inline event handler": '<img src="x" onerror="window.jQuery = function () {}">',
		"a javascript: link followed by a click": '<a id="go" href="javascript:window.jQuery=function(){}">go</a>',
	};
	for (const [name, markup] of Object.entries(attacks)) {
		it(`does not run ${name}`, async () => {
			const html = recordViolations(page(markup));
			const value = await browser.run(html, "typeof window.jQuery", {
				before: "document.getElementById('go')?.click()",
			});
			assert.equal(value, "undefined");
		});
	}

	it("blocks frames and objects", async () => {
		const html = recordViolations(
			page(
				'<iframe src="https://example.org/"></iframe><object data="https://example.org/"></object><embed src="https://example.org/">'
			)
		);
		const violations = await browser.run(html, "window.__v");
		for (const directive of ["frame-src", "object-src"]) {
			assert.ok(
				violations.some((entry) => entry.startsWith(directive)),
				`${directive} should have blocked: ${violations}`
			);
		}
	});

	it("does not let a form submission leave the page", async () => {
		const html = page('<form action="http://127.0.0.1:1/away"><button id="b">Go</button></form>');
		const href = await browser.run(html, "location.href", { before: "document.getElementById('b').click()" });
		assert.ok(href.startsWith("http://127.0.0.1:") && !href.includes("/away"), href);
	});

	// VS Code's webview does not enforce form-action (seen in a real window on 2026-10-28), so the page script must refuse the submit on its own
	it("refuses a form submission in the page script even where form-action is not enforced", async () => {
		const html = page(
			'<form action="http://127.0.0.1:1/away"><input name="q"><button id="b">Go</button></form>'
		).replace(" form-action 'none';", "");
		assert.ok(!directives(html).has("form-action"));
		const href = await browser.run(html, "location.href", { before: "document.getElementById('b').click()" });
		assert.ok(href.startsWith("http://127.0.0.1:") && !href.includes("/away"), href);
	});

	it("does not let a <base> tag redirect relative links", async () => {
		const html = page('<base href="http://127.0.0.1:1/elsewhere/"><a id="l" href="relative">r</a>');
		const href = await browser.run(html, "document.getElementById('l').href");
		assert.ok(!href.includes("/elsewhere/"), href);
	});

	it("sends no Referer to an image host", async () => {
		const seen = [];
		const imageServer = http
			.createServer((request, response) => {
				seen.push(request.headers.referer ?? null);
				response.setHeader("content-type", "image/gif");
				response.end(Buffer.from("R0lGODlhAQABAAAAACw=", "base64"));
			})
			.listen(0, "127.0.0.1");
		await new Promise((resolve) => imageServer.once("listening", resolve));
		try {
			// img-src admits https only, so the policy is widened for this one probe and the meta tag under test is untouched
			const html = page("# x")
				.replace("img-src https:", "img-src http://127.0.0.1:* https:")
				.replace("</main>", `<img src="http://127.0.0.1:${imageServer.address().port}/pixel.gif"></main>`);
			await browser.run(html, "1");
			assert.deepEqual(seen, [null]);
		} finally {
			imageServer.close();
		}
	});

	// The CDN libraries are the page's reason to exist; a policy that blocks them is worse than none
	describe("with the CDN reachable", () => {
		let online = false;
		before(async () => {
			try {
				online = (await fetch(JQUERY, { method: "HEAD", signal: AbortSignal.timeout(4000) })).ok;
			} catch {
				online = false;
			}
		});

		it("still typesets math, draws Mermaid and highlights code", async (t) => {
			if (!online) {
				t.skip("jsDelivr not reachable");
				return;
			}
			const source = "$x^2$\n\n```mermaid\ngraph TD; A-->B\n```\n\n```js\nlet a = 1;\n```\n";
			const value = await browser.run(
				recordViolations(page(source)),
				"({ math: document.querySelectorAll('mjx-container').length, mermaid: document.querySelectorAll('.mermaid svg').length, code: document.querySelectorAll('code.hljs').length, scriptViolations: window.__v.filter((v) => v.startsWith('script-src')) })",
				{ wait: 9000 }
			);
			assert.deepEqual(value, { math: 1, mermaid: 1, code: 1, scriptViolations: [] });
		});
	});
});
