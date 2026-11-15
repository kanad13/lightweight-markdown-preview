/** Tests that the editor floor matches the @types/vscode pin and stays at or below Cursor's base. */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));

describe("editor floor", () => {
	it("pins @types/vscode to the engine floor", () => {
		const floor = manifest.engines.vscode.replace(/^\^/, "");
		assert.equal(manifest.devDependencies["@types/vscode"], floor);
	});

	it("keeps the editor floor at or below Cursor's base, 1.105.0", () => {
		// Cursor is the lowest fork base the README advertises. A higher floor blocks installation there.
		// Raise this ceiling only for a named API need or a fork rebase, in every sibling extension.
		const floor = manifest.engines.vscode.replace(/^\^/, "").split(".").map(Number);
		const ceiling = [1, 105, 0];
		const diff = floor.findIndex((n, i) => n !== ceiling[i]);
		assert.ok(diff === -1 || floor[diff] < ceiling[diff], "engines.vscode is above 1.105.0");
	});
});
