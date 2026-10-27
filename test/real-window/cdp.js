/**
 * Talks to a real VS Code window over the DevTools protocol.
 *
 * Why it exists: the preview is a webview, and only a real window shows what it does with the real CSP, theme and
 * file access. VS Code must run with --remote-debugging-port=9222.
 */
/* global WebSocket */
// usage: node cdp.js eval '<expr>'   (in the preview webview)
//        node cdp.js main '<expr>'   (in the VS Code workbench page)
//        node cdp.js shot out.png [x y w h scale]  (workbench screenshot, optional clip)
const http = require("http"); const fs = require("fs");
const get = (u) => new Promise((res, rej) => http.get(u, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(JSON.parse(d))); }).on("error", rej));
async function conn(t) { const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r)); let id = 0; const pend = new Map(); const ev = []; ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result || d.error); pend.delete(d.id); } else ev.push(d); }; const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); }); return { ws, send, ev }; }
(async () => {
	const targets = await get("http://127.0.0.1:9222/json"); const [mode, a, ...rest] = process.argv.slice(2);
	if (mode === "main" || mode === "shot") {
		const c = await conn(targets.find((t) => t.type === "page"));
		if (mode === "main") { const r = await c.send("Runtime.evaluate", { expression: a, returnByValue: true }); console.log(JSON.stringify(r.result.value)); }
		else { const [x, y, w, h, sc] = rest.map(Number); const params = { format: "png" }; if (w) params.clip = { x, y, width: w, height: h, scale: sc || 1 }; const r = await c.send("Page.captureScreenshot", params); fs.writeFileSync(a, Buffer.from(r.data, "base64")); console.log("saved", a); }
		process.exit(0);
	}
	const out = [];
	for (const t of targets.filter((t) => t.type === "iframe" && t.url.includes("vscode-webview://"))) {
		const c = await conn(t); await c.send("Runtime.enable"); await new Promise((r) => setTimeout(r, 400));
		for (const ctx of c.ev.filter((e) => e.method === "Runtime.executionContextCreated").map((e) => e.params.context)) {
			const r = await c.send("Runtime.evaluate", { contextId: ctx.id, expression: `(function(){ if(!document.querySelector('.content')) return undefined; return (${a}); })()`, returnByValue: true, awaitPromise: true });
			if (r.result && r.result.value !== undefined) out.push(r.result.value);
		}
		c.ws.close();
	}
	console.log(JSON.stringify(out)); process.exit(0);
})();
