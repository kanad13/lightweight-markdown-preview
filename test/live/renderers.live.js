/**
 * Live check of real D2 renderers through the addresses the extension emits.
 *
 * Why it exists: the unit tests prove the address, but only a renderer can show that
 * it understands it. Run it against the local d2-renderer container and against Kroki
 * before a release, and whenever the address, the options or the supported D2 syntax change.
 * It needs the network, so `npm test` does not run it.
 *
 * Usage:
 *   D2_RENDERERS="docker=http://localhost:8080,kroki=https://kroki.io" D2_TALA_RENDERERS=docker npm run test:live
 * D2_TALA_RENDERERS lists the renderers that have TALA, so a diagram that names it must draw there.
 */
/* global fetch */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { install } = require("../helpers/fake-vscode");

install();
const { renderMarkdown } = require("../../src/extension");

const renderers = Object.fromEntries(
	(process.env.D2_RENDERERS || "")
		.split(",")
		.filter(Boolean)
		.map((entry) => {
			const [name, ...url] = entry.split("=");
			return [name, url.join("=")];
		})
);
const talaRenderers = (process.env.D2_TALA_RENDERERS || "").split(",").filter(Boolean);

/** Kroki sits behind Cloudflare, which refuses the default User-Agent of scripts with error 1010 */
const HEADERS = { "User-Agent": "Mozilla/5.0 (lightweight-markdown-preview live test)" };

/**
 * Renders a D2 block through the extension and fetches the image it would load.
 *
 * @param {string} base - Renderer URL
 * @param {string} source - D2 source
 * @param {object} [options] - D2 settings such as `sketch`, `layout`, `theme`
 * @returns {Promise<{ status: number, type: string, body: string, url: string }>} The renderer's answer
 */
async function draw(base, source, options = {}) {
	const { html } = renderMarkdown("```d2\n" + source + "\n```", { d2: { rendererUrl: base, theme: 0, ...options } });
	const match = /<img class="d2-img" src="([^"]+)"/.exec(html);
	assert.ok(match, "the extension emitted no image address");
	const url = match[1].replace(/&amp;/g, "&");
	const response = await fetch(url, { headers: HEADERS });
	return { status: response.status, type: response.headers.get("content-type") || "", body: await response.text(), url };
}

/** Width and height of the SVG's viewBox */
function viewBox(svg) {
	const match = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg);
	assert.ok(match, `no viewBox in ${svg.slice(0, 120)}`);
	return { width: Number(match[1]), height: Number(match[2]) };
}

const CASES = [
	["plain graph", "client -> server: Ping\nserver -> client: Pong", ["Ping", "Pong", "client", "server"]],
	["containers", "cloud: Cloud {\n  api: API\n  worker: Worker\n  api -> worker: queue\n}\nuser -> cloud.api", ["Cloud", "Worker", "queue"]],
	["sql_table", "users: {\n  shape: sql_table\n  id: int {constraint: primary_key}\n  email: varchar\n}", ["users", "email", "varchar"]],
	["sequence diagram", "shape: sequence_diagram\nalice -> bob: hello\nbob -> alice: hi", ["alice", "bob", "hello"]],
	["unicode and emoji", "a: Käyttäjä 🙂\nb: 日本語\na -> b: ✓", ["Käyttäjä", "日本語"]],
	["larger graph", Array.from({ length: 40 }, (_, i) => (i ? `n${i}: Node ${i}\nn${Math.floor((i - 1) / 2)} -> n${i}` : "n0: Node 0")).join("\n"), ["Node 39"]],
];

describe("live D2 renderers", { skip: Object.keys(renderers).length ? false : "set D2_RENDERERS=name=url,... to run" }, () => {
	for (const [name, base] of Object.entries(renderers)) {
		describe(name, () => {
			for (const [title, source, labels] of CASES) {
				it(`draws ${title}`, async () => {
					const { status, type, body } = await draw(base, source);
					assert.equal(status, 200, body.slice(0, 200));
					assert.match(type, /svg/);
					assert.match(body, /<svg[\s>]/);
					assert.ok(body.includes("</svg>"));
					assert.ok(!/Error 4\d\d/.test(body), "an error picture came back");
					for (const label of labels) assert.ok(body.includes(label), `label ${label} is missing`);
					const { width, height } = viewBox(body);
					assert.ok(width > 100 && height > 50, `suspiciously small picture ${width}x${height}`);
				});
			}

			it("draws the dark theme differently from the light one", async () => {
				const light = await draw(base, "a -> b", { theme: 0 });
				const dark = await draw(base, "a -> b", { theme: 200 });
				assert.equal(dark.status, 200);
				assert.notEqual(dark.body, light.body);
				const colors = (svg) => [...new Set(svg.match(/#[0-9A-Fa-f]{6}/g))].sort().join();
				assert.notEqual(colors(dark.body), colors(light.body));
			});

			const withConfig = (inner, body) => `vars: {\n  d2-config: {\n${inner}\n  }\n}\n${body}`;
			const GRAPH = "direction: right\nclient -> gateway -> auth\ngateway -> orders -> db\norders -> payments -> db\nauth -> db";

			it("draws a sketch when the diagram asks for one", async () => {
				const clean = await draw(base, "a -> b: edge");
				const sketch = await draw(base, withConfig("    sketch: true", "a -> b: edge"));
				assert.equal(sketch.status, 200);
				assert.notEqual(sketch.body, clean.body);
			});

			it("uses the layout engine that the diagram names", async () => {
				const dagre = await draw(base, GRAPH);
				const elk = await draw(base, withConfig("    layout-engine: elk", GRAPH));
				assert.equal(elk.status, 200);
				assert.notEqual(elk.body, dagre.body);
			});

			if (talaRenderers.includes(name)) {
				it("uses TALA when the diagram names it", async () => {
					const dagre = await draw(base, GRAPH);
					const tala = await draw(base, withConfig("    layout-engine: tala", GRAPH));
					assert.equal(tala.status, 200);
					assert.notEqual(tala.body, dagre.body);
				});
			}

			it("honors the padding that a diagram sets for itself", async () => {
				const loose = await draw(base, "a -> b");
				const tight = await draw(base, "vars: {\n  d2-config: {\n    pad: 24\n  }\n}\na -> b");
				assert.equal(tight.status, 200);
				assert.ok(viewBox(tight.body).width < viewBox(loose.body).width);
			});

			it("answers a syntax error with an error, not a picture of the diagram", async () => {
				let answer;
				try {
					answer = await draw(base, "x -> -> y {");
				} catch (error) {
					// The d2-renderer image answers 400 with the compiler message in the HTTP reason phrase, which has newlines, so strict clients such as Node reject the reply as malformed. Browsers show their failure state, which the preview handles.
					assert.match(String(error.cause?.message || error.message), /protocol|fetch failed/);
					return;
				}
				assert.ok(answer.status >= 400 || /Error 4\d\d/.test(answer.body), `status ${answer.status}`);
			});

			it("returns the same picture for the same address", async () => {
				const first = await draw(base, "a -> b: same");
				const second = await draw(base, "a -> b: same");
				assert.equal(second.url, first.url);
				assert.equal(second.body.length, first.body.length);
			});
		});
	}
});
