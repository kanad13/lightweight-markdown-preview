/**
 * Test driver extension: runs one command at a time from a JSON file, so a script can steer a real VS Code window.
 *
 * Why it exists: the window has no scripting interface of its own for opening files, editing, or changing settings and themes.
 * It is loaded next to the extension under test with --extensionDevelopmentPath and is never published.
 */
/* global setInterval */
const vscode = require("vscode");
const fs = require("fs");
const CMD = process.env.LMP_CMD;
async function run(c) {
	switch (c.op) {
	case "open": { const d = await vscode.workspace.openTextDocument(c.file); await vscode.window.showTextDocument(d, { viewColumn: vscode.ViewColumn.One }); return d.uri.fsPath; }
	case "preview": await vscode.commands.executeCommand("lightweightMarkdownViewer.showPreview"); return "ok";
	case "theme": await vscode.workspace.getConfiguration().update("workbench.colorTheme", c.name, vscode.ConfigurationTarget.Global); return c.name;
	case "config": await vscode.workspace.getConfiguration().update(c.key, c.value, vscode.ConfigurationTarget.Global); return [c.key, c.value];
	case "edit": { const ed = vscode.window.activeTextEditor; const text = ed.document.getText(); const i = text.indexOf(c.from); if (i < 0) return "not found"; await ed.edit((b) => b.replace(new vscode.Range(ed.document.positionAt(i), ed.document.positionAt(i + c.from.length)), c.to)); return "edited"; }
	case "type": { const ed = vscode.window.activeTextEditor; await ed.edit((b) => b.insert(new vscode.Position(c.line, c.col), c.text)); return "typed"; }
	case "exec": await vscode.commands.executeCommand(c.command, ...(c.args || [])); return "ok";
	case "info": return { theme: vscode.window.activeColorTheme.kind, active: vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.fileName, trusted: vscode.workspace.isTrusted, url: vscode.workspace.getConfiguration("lightweightMarkdownViewer.d2").get("rendererUrl") };
	}
	return "unknown op";
}
exports.activate = () => {
	fs.writeFileSync(CMD + ".ready", "1");
	setInterval(async () => {
		if (!fs.existsSync(CMD)) return;
		const c = JSON.parse(fs.readFileSync(CMD, "utf8"));
		fs.unlinkSync(CMD);
		let out;
		try { out = await run(c); } catch (e) { out = "ERR " + e.message; }
		fs.writeFileSync(CMD + ".out", JSON.stringify(out));
	}, 250);
};
