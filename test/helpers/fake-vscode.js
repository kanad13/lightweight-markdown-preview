/**
 * Test double for the `vscode` module and the webpack `.html` loader.
 *
 * Why it exists: the extension runs inside VS Code and is bundled by webpack, so
 * neither `require("vscode")` nor `require("./webview.html")` resolves under plain
 * Node. This helper installs both shims and records the handlers the extension
 * registers, so tests can fire editor events and inspect the rendered page.
 *
 * Invariant: call `install()` before requiring the extension (source or bundle).
 */
const Module = require("module");
const fs = require("fs");
const path = require("path");

/** Handlers registered by the extension, keyed by event name. The latest activation wins. */
const handlers = {};

/** Messages passed to `showErrorMessage`, cleared by `reset()`. */
const errors = [];

/** Settings the fake `getConfiguration` serves, keyed by full id such as "lightweightMarkdownViewer.d2.rendererUrl". Cleared by `reset()`. */
const settings = {};

/** Calls made to `update` on a configuration section, cleared by `reset()`. */
const settingUpdates = [];

/** Sections passed to `getConfiguration`, cleared by `reset()`; lets tests prove the extension reads only its own settings. */
const configSections = [];

/** Answers the fake quick-pick and input box give next; set by tests, cleared by `reset()`. */
const prompts = { quickPick: undefined, inputBox: undefined, quickPickItems: undefined, inputBoxOptions: undefined };

const noopDisposable = () => ({ dispose: () => {} });

const vscode = {
	window: {
		activeColorTheme: { kind: 1 },
		activeTextEditor: undefined,
		showErrorMessage: (message) => errors.push(message),
		showQuickPick: async (items) => {
			prompts.quickPickItems = items;
			return typeof prompts.quickPick === "function" ? prompts.quickPick(items) : prompts.quickPick;
		},
		showInputBox: async (options) => {
			prompts.inputBoxOptions = options;
			return prompts.inputBox;
		},
		createWebviewPanel: undefined,
		onDidChangeActiveColorTheme: (handler) => {
			handlers.theme = handler;
			return noopDisposable();
		},
		onDidChangeActiveTextEditor: (handler) => {
			handlers.activeEditor = handler;
			return noopDisposable();
		},
	},
	workspace: {
		workspaceFolders: undefined,
		getConfiguration: (section) => (configSections.push(section), {
			get: (key, fallback) => (`${section}.${key}` in settings ? settings[`${section}.${key}`] : fallback),
			update: async (key, value, target) => {
				settingUpdates.push({ id: `${section}.${key}`, value, target });
			},
		}),
		onDidChangeConfiguration: (handler) => {
			handlers.config = handler;
			return noopDisposable();
		},
		onDidChangeTextDocument: (handler) => {
			handlers.docChange = handler;
			return noopDisposable();
		},
	},
	commands: {
		registerCommand: (id, handler) => {
			handlers[id === "lightweightMarkdownViewer.chooseD2Renderer" ? "chooseRenderer" : "command"] = handler;
			return noopDisposable();
		},
	},
	ViewColumn: { Beside: 2 },
	Uri: { joinPath: (base, ...parts) => ({ path: path.posix.join(base.path, ...parts) }) },
	ConfigurationTarget: { Global: 1, Workspace: 2 },
	ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
};

/**
 * Installs the `.html` loader and the `vscode` module shim.
 */
function install() {
	require.extensions[".html"] = function (module, filename) {
		module.exports = fs.readFileSync(filename, "utf-8");
	};

	const origResolve = Module._resolveFilename;
	Module._resolveFilename = function (request) {
		if (request === "vscode") return "vscode";
		return origResolve.apply(this, arguments);
	};
	require.cache["vscode"] = { id: "vscode", filename: "vscode", loaded: true, exports: vscode };
}

/**
 * Builds a fake text document.
 *
 * @param {string} filePath - Absolute path such as "/docs/guide.md"
 * @param {string} text - Document content
 * @param {{ languageId?: string, scheme?: string }} [options] - Language and URI scheme
 * @returns {object} A document with the members the extension reads
 */
function makeDoc(filePath, text, { languageId = "markdown", scheme = "file" } = {}) {
	const makeUri = (uriPath) => ({
		scheme,
		path: uriPath,
		with: (change) => makeUri(change.path ?? uriPath),
		toString: () => `${scheme}://${uriPath}`,
	});
	return { languageId, getText: () => text, uri: makeUri(filePath) };
}

/**
 * Activates the extension, runs its command on a document, and returns the fake panel.
 *
 * @param {(context: object) => void} activate - The `activate` export under test
 * @param {object} doc - Document from makeDoc()
 * @returns {{ webview: { html: string }, renders: number, disposeCallback: Function, created: number }} The fake panel
 */
function openPreview(activate, doc) {
	const panel = {
		renders: 0,
		created: 0,
		disposeCallback: undefined,
		reveal() {},
		onDidDispose(callback) {
			panel.disposeCallback = callback;
		},
		webview: {
			_html: "",
			asWebviewUri: (uri) => ({ toString: () => `webview:${uri.path}` }),
			set html(value) {
				this._html = value;
				panel.renders++;
			},
			get html() {
				return this._html;
			},
		},
	};
	vscode.window.createWebviewPanel = () => {
		panel.created++;
		return panel;
	};
	vscode.window.activeTextEditor = { document: doc };
	activate({ extensionUri: { path: "/ext" }, subscriptions: [] });
	handlers.command();
	return panel;
}

/**
 * Clears recorded errors and restores default workspace and theme state.
 */
function reset() {
	errors.length = 0;
	settingUpdates.length = 0;
	configSections.length = 0;
	for (const key of Object.keys(settings)) delete settings[key];
	prompts.quickPick = undefined;
	prompts.inputBox = undefined;
	prompts.quickPickItems = undefined;
	prompts.inputBoxOptions = undefined;
	vscode.workspace.workspaceFolders = undefined;
	vscode.window.activeColorTheme.kind = 1;
	vscode.window.activeTextEditor = undefined;
}

module.exports = { install, handlers, errors, settings, settingUpdates, configSections, prompts, vscode, makeDoc, openPreview, reset };
