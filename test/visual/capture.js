/**
 * Captures a page from the visual check as a PNG whose edges cut nothing off.
 *
 * Why it exists: a fixed window height clips a diagram or a heading at the bottom, and a
 * screenshot that is cut off teaches the reader the wrong thing. This script waits until the
 * images, fonts, Mermaid and MathJax have settled, then clips the screenshot to the bottom of
 * a chosen element (or the whole page), so the crop always falls between blocks.
 *
 * Usage: CHROME=/path/to/chrome node test/visual/capture.js <url> <out.png> [--width 960] [--scale 1.5] [--from selector] [--until selector] [--before selector] [--pad 24]
 * `--from` is a CSS selector; the screenshot starts just above the first element it matches. `--until` is a CSS selector; the screenshot ends below the last element it matches. `--before` is a CSS selector; the screenshot ends just above the first element it matches, for cutting a page at a heading.
 */
/* global WebSocket, fetch */
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function option(name, fallback) {
	const at = process.argv.indexOf(`--${name}`);
	return at > 0 ? process.argv[at + 1] : fallback;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
	const [url, out] = process.argv.slice(2);
	if (!url || !out) {
		console.error("usage: node test/visual/capture.js <url> <out.png> [--width 960] [--scale 1.5] [--from selector] [--until selector] [--before selector] [--pad 24]");
		process.exit(2);
	}
	const width = Number(option("width", 960));
	const scale = Number(option("scale", 1.5));
	const from = option("from", "");
	const until = option("until", "");
	const before = option("before", "");
	const pad = Number(option("pad", 24));
	const port = 9300 + Math.floor(Math.random() * 500);
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lmp-capture-"));
	const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
	try {
		let target;
		for (let i = 0; i < 50 && !target; i++) {
			try {
				target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json();
			} catch {
				await sleep(200);
			}
		}
		if (!target) throw new Error("Chrome did not start");
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
		const send = (method, params = {}) => new Promise((resolve) => {
			const n = ++id;
			pending.set(n, resolve);
			ws.send(JSON.stringify({ id: n, method, params }));
		});
		const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;

		await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: scale, mobile: false });
		// Settled means: every image decoded or failed, fonts ready, MathJax typeset, Mermaid drawn
		const settled = `(async () => { await document.fonts.ready; if (window.mathReady) await window.mathReady;
			return [...document.images].every((i) => i.complete) && [...document.querySelectorAll('.mermaid')].every((m) => m.querySelector('svg')); })()`;
		for (let i = 0; i < 100 && !(await evaluate(settled)); i++) await sleep(300);
		await sleep(500);
		const height = await evaluate(`(() => {
			const until = ${JSON.stringify(until)};
			const before = ${JSON.stringify(before)};
			if (before) return Math.floor(document.querySelector(before).getBoundingClientRect().top + window.scrollY - ${pad} / 2);
			if (!until) return Math.ceil(document.documentElement.scrollHeight);
			const all = [...document.querySelectorAll(until)];
			return Math.ceil(Math.max(...all.map((e) => e.getBoundingClientRect().bottom + window.scrollY)) + ${pad});
		})()`);
		const top = from ? await evaluate(`Math.max(0, Math.floor(document.querySelector(${JSON.stringify(from)}).getBoundingClientRect().top + window.scrollY - ${pad} / 2))`) : 0;
		await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
		await sleep(300);
		const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: top, width, height: height - top, scale: 1 } });
		fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
		console.log(`${out}: ${width}x${height - top} css px at ${scale}x`);
		ws.close();
	} finally {
		chrome.kill();
		await sleep(500);
		try {
			fs.rmSync(profile, { recursive: true, force: true });
		} catch {
			// Chrome may still be flushing its profile; the temporary folder is harmless
		}
	}
}

main().then(() => process.exit(0), (error) => {
	console.error(error);
	process.exit(1);
});
