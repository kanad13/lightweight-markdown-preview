/**
 * VS Code extension entry point: a lightweight Markdown preview in a webview.
 *
 * Why it exists: the built-in preview is heavier than needed for people who
 * want Mermaid, D2, MathJax, and a navigable outline with nothing else. This file
 * holds all extension logic; `webview.html` supplies the page template.
 *
 * Approach and invariants:
 * - One webview panel, reused across files; state lives in the `activate` closure.
 * - Markdown is rendered in the extension host, then injected as a whole page.
 * - `marked` is the only parser. Math, Mermaid, heading IDs and image addresses
 *   are handled as parser extensions and token passes, never by rewriting the
 *   text before or the HTML after, so code spans and fences stay untouched.
 * - Untrusted text reaches HTML only through `marked` or `escapeHtml`, and the
 *   CSP runs only scripts that carry the per-render nonce.
 * - D2 diagrams become `<img>` tags that point at the renderer URL the user
 *   chose. The extension itself never contacts that URL, and the CSP admits
 *   images from that one origin only.
 */
const crypto = require("crypto");
const zlib = require("zlib");
const { URL } = require("url");
const vscode = require("vscode");
const { Marked } = require("marked");
const webviewTemplate = require("./webview.html");

/**
 * Exact versions of the libraries the webview loads from jsDelivr.
 *
 * Each value is an exact version, so a compromised or regressed upstream
 * release reaches users only after a maintainer reviews it and changes this
 * constant. Selection criteria and upgrade rules live in docs/dependencies.md.
 */
const CDN_VERSIONS = {
	mermaid: "12.1.0",
	mathjax: "4.1.3",
	highlightjs: "11.12.0",
};

/**
 * Escapes the characters that are significant in HTML text and attributes
 *
 * Used wherever untrusted document text is placed into generated markup that
 * marked does not process (TOC entries, preserved math and Mermaid source).
 * Browsers decode the entities back, so MathJax and Mermaid still read the
 * original source from the element text.
 *
 * @param {string} text - Raw text to escape
 * @returns {string} Text safe to embed in HTML
 */
function escapeHtml(text) {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Activation function - called when the extension loads
 *
 * This extension provides a lightweight Markdown preview with Mermaid diagram and MathJax support.
 * It maintains a single webview panel that follows the active Markdown editor.
 *
 * State managed:
 * - currentPanel: The active preview panel (or undefined if closed)
 * - currentDocument: The markdown document currently being previewed
 *
 * This approach prevents resource exhaustion and keeps the extension lightweight.
 *
 * @param {vscode.ExtensionContext} context - Extension context provided by VS Code
 */
function activate(context) {
	// Keep track of current panel to avoid duplicates and enable updates
	let currentPanel = undefined;
	let currentDocument = undefined;
	let updateTimer = undefined;

	const disposable = vscode.commands.registerCommand("lightweightMarkdownViewer.showPreview", function () {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage("No active editor");
			return;
		}

		const doc = editor.document;
		if (doc.languageId !== "markdown") {
			vscode.window.showErrorMessage("Not a Markdown file");
			return;
		}

		if (currentPanel) {
			// If panel exists, reveal it and update content
			currentPanel.reveal(vscode.ViewColumn.Beside);
			currentDocument = doc;
			updateWebviewContent(currentPanel, doc);
		} else {
			// Create new panel with proper options
			const workspaceFolders = vscode.workspace.workspaceFolders;
			const localResourceRoots = [context.extensionUri];

			// Add workspace folder(s) to allow access to markdown files and images
			if (workspaceFolders) {
				localResourceRoots.push(...workspaceFolders.map((folder) => folder.uri));
			}

			currentPanel = vscode.window.createWebviewPanel(
				"markdownPreviewBasic",
				"Markdown Preview",
				vscode.ViewColumn.Beside,
				{
					enableScripts: true, // Required for Mermaid to work
					localResourceRoots: localResourceRoots,
				}
			);

			currentDocument = doc;
			updateWebviewContent(currentPanel, doc);

			// Handle panel disposal
			currentPanel.onDidDispose(
				() => {
					clearTimeout(updateTimer);
					currentPanel = undefined;
					currentDocument = undefined;
				},
				null,
				context.subscriptions
			);
		}
	});

	// Listen for document changes to update preview with debounce
	const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
		if (currentPanel && currentDocument && e.document.uri.toString() === currentDocument.uri.toString()) {
			clearTimeout(updateTimer);
			// A renderer is asked for a picture of every changed D2 block, so those documents wait longer
			const hasD2 =
				/(?:```|~~~)[ \t]*d2\b/i.test(e.document.getText()) && readD2Settings().rendererUrl.trim() !== "";
			updateTimer = setTimeout(
				() => {
					updateWebviewContent(currentPanel, e.document);
				},
				hasD2 ? D2_DEBOUNCE_MS : 300
			);
		}
	});

	// Follow the active Markdown editor. The panel itself taking focus reports no editor, and non-Markdown
	// editors keep the last preview. The "git" scheme is the old side of a diff, which must not replace the file being edited.
	const activeEditorSubscription = vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (!currentPanel || !editor) {
			return;
		}
		const doc = editor.document;
		if (doc.languageId !== "markdown" || doc.uri.scheme === "git") {
			return;
		}
		if (currentDocument && doc.uri.toString() === currentDocument.uri.toString()) {
			return;
		}
		// A pending debounced update belongs to the previous file and would overwrite this one
		clearTimeout(updateTimer);
		currentDocument = doc;
		updateWebviewContent(currentPanel, doc);
	});

	// Re-render when VS Code color theme changes (light ↔ dark)
	const themeChangeSubscription = vscode.window.onDidChangeActiveColorTheme(() => {
		if (currentPanel && currentDocument) {
			updateWebviewContent(currentPanel, currentDocument);
		}
	});

	// Renderer, layout and sketch change every D2 address, so the open preview is drawn again
	const configChangeSubscription = vscode.workspace.onDidChangeConfiguration((e) => {
		if (currentPanel && currentDocument && e.affectsConfiguration("lightweightMarkdownViewer.d2")) {
			updateWebviewContent(currentPanel, currentDocument);
		}
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(
		vscode.commands.registerCommand("lightweightMarkdownViewer.chooseD2Renderer", chooseD2Renderer)
	);
	context.subscriptions.push(configChangeSubscription);
	context.subscriptions.push(changeDocumentSubscription);
	context.subscriptions.push(activeEditorSubscription);
	context.subscriptions.push(themeChangeSubscription);
}

/**
 * Reads the D2 settings
 *
 * @returns {{ rendererUrl: string, sketch: boolean, layout: string }} Current values with defaults applied
 */
function readD2Settings() {
	const config = vscode.workspace.getConfiguration("lightweightMarkdownViewer.d2");
	return {
		rendererUrl: config.get("rendererUrl", ""),
		sketch: config.get("sketch", false) === true,
		layout: config.get("layout", "dagre"),
	};
}

/**
 * Offers the usual D2 renderers in a quick-pick and stores the choice
 *
 * The change event of the setting re-renders the open preview, so this
 * function only writes the value. The setting has application scope, so a
 * workspace cannot point diagrams at a server of its own choosing.
 */
async function chooseD2Renderer() {
	const choice = await vscode.window.showQuickPick(
		[
			{
				label: "Local Docker container",
				description: "http://localhost:8080",
				detail: "Stays on your machine: docker run -d -p 8080:8080 ghcr.io/kanad13/d2-renderer",
				url: "http://localhost:8080",
			},
			{
				label: "Kroki public service",
				description: "https://kroki.io",
				detail: "Quick way to try D2. This is a third-party service, and your diagram text is sent to it.",
				url: "https://kroki.io",
			},
			{ label: "Enter another URL...", detail: "Your own server or a cloud deployment", url: undefined },
			{ label: "Turn D2 rendering off", detail: "D2 blocks show their source and a setup message", url: "" },
		],
		{ title: "D2 renderer", placeHolder: "Where should D2 diagrams be rendered?" }
	);
	if (!choice) {
		return;
	}
	let url = choice.url;
	if (url === undefined) {
		url = await vscode.window.showInputBox({
			title: "D2 renderer URL",
			prompt: "Base URL of a Kroki-compatible D2 renderer, for example https://d2.example.com",
			validateInput: (value) => parseRendererUrl(value).error,
		});
		if (url === undefined) {
			return;
		}
	}
	const stored = url ? parseRendererUrl(url).url : "";
	await vscode.workspace
		.getConfiguration("lightweightMarkdownViewer.d2")
		.update("rendererUrl", stored, vscode.ConfigurationTarget.Global);
}

/**
 * Resolves and converts image paths to webview-accessible URIs
 *
 * Handles:
 * - Relative paths: Resolved relative to the markdown file's directory
 * - Absolute file paths: Converted to webview-accessible URIs
 * - HTTPS URLs: Passed through unchanged
 * - Data URIs: Passed through unchanged
 *
 * @param {string} imagePath - The image path from markdown
 * @param {vscode.TextDocument} document - The markdown document
 * @param {vscode.WebviewPanel} panel - The webview panel for URI conversion
 * @returns {string} The converted image path or original if not a local file
 */
function resolveImagePath(imagePath, document, panel) {
	// Skip external URLs and data URIs
	if (imagePath.startsWith("http://") || imagePath.startsWith("https://") || imagePath.startsWith("data:")) {
		return imagePath;
	}

	try {
		const documentPath = document.uri;
		const documentDir = documentPath.with({
			path: documentPath.path.substring(0, documentPath.path.lastIndexOf("/")),
		});

		// Markdown writes spaces as %20; Uri.joinPath would encode the percent sign again and the file would not load
		let decodedPath = imagePath;
		try {
			decodedPath = decodeURI(imagePath);
		} catch {
			// A stray percent sign is a literal character
		}

		// Resolve relative path against document directory
		let imagePath_parsed;
		if (imagePath.startsWith("/")) {
			// Absolute path - treat as workspace-relative
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (workspaceFolders && workspaceFolders.length > 0) {
				imagePath_parsed = vscode.Uri.joinPath(workspaceFolders[0].uri, decodedPath);
			} else {
				return imagePath;
			}
		} else {
			// Relative path - resolve against document directory
			imagePath_parsed = vscode.Uri.joinPath(documentDir, decodedPath);
		}

		// Convert to webview-accessible URI
		return panel.webview.asWebviewUri(imagePath_parsed).toString();
	} catch (error) {
		console.error(`Failed to resolve image path: ${imagePath}`, error);
		return imagePath; // Return original if resolution fails
	}
}

/**
 * Block math: `$$ ... $$` on one line or across several lines
 *
 * Why a parser extension: `marked` already knows which text is code, so a `$$`
 * inside a fence or code span never reaches this tokenizer. The body may not
 * contain a blank line, so a stray `$$` cannot swallow the rest of the page.
 * The output uses MathJax's `\[ \]` delimiters, which the page enables instead
 * of any dollar delimiter (see webview.html).
 */
const mathBlock = {
	name: "mathBlock",
	level: "block",
	start(src) {
		const at = src.search(/(?:^|\n)\$\$/);
		return at < 0 ? undefined : src[at] === "\n" ? at + 1 : at;
	},
	tokenizer(src) {
		const match = /^\$\$((?:(?!\n[ \t]*\n)[\s\S])+?)\$\$[ \t]*(?:\n|$)/.exec(src);
		if (match) {
			return { type: "mathBlock", raw: match[0], text: match[1] };
		}
		return undefined;
	},
	renderer(token) {
		return `<div class="math-block">\\[${escapeHtml(token.text)}\\]</div>\n`;
	},
};

/**
 * Inline math: `$...$`, plus `$$...$$` written inside a sentence
 *
 * Why the extra rules: the opening `$` must touch the formula, the closing `$`
 * must not follow a space or precede a digit. That is Pandoc's rule, and it is
 * what keeps "costs $5 and $10" as text. An escaped `\$` is consumed by
 * `marked`'s own escape rule before this tokenizer sees it.
 */
const mathInline = {
	name: "mathInline",
	level: "inline",
	start(src) {
		return src.indexOf("$");
	},
	tokenizer(src) {
		const display = /^\$\$((?:\\[\s\S]|[^$\\])+?)\$\$/.exec(src);
		if (display) {
			return { type: "mathInline", raw: display[0], text: display[1], display: true };
		}
		const inline = /^\$(?!\s)((?:\\[\s\S]|[^$\\\n])+?)(?<!\s)\$(?!\d)/.exec(src);
		if (inline) {
			return { type: "mathInline", raw: inline[0], text: inline[1], display: false };
		}
		return undefined;
	},
	renderer(token) {
		const [open, close, kind] = token.display ? ["\\[", "\\]", "math-display"] : ["\\(", "\\)", "math-inline"];
		return `<span class="${kind}">${open}${escapeHtml(token.text)}${close}</span>`;
	},
};

/**
 * Azure DevOps Mermaid fence (`::: mermaid` ... `:::`)
 *
 * Emits an ordinary `code` token with the language `mermaid`, so it renders
 * exactly like the backtick form and nests inside lists and quotes.
 */
const mermaidColonFence = {
	name: "mermaidColonFence",
	level: "block",
	start(src) {
		const at = src.search(/(?:^|\n):::[ \t]*mermaid[ \t]*\n/);
		return at < 0 ? undefined : src[at] === "\n" ? at + 1 : at;
	},
	tokenizer(src) {
		const match = /^:::[ \t]*mermaid[ \t]*\n((?:[\s\S]*?\n)??):::[ \t]*(?:\n|$)/.exec(src);
		if (match) {
			return { type: "code", raw: match[0], text: match[1], lang: "mermaid" };
		}
		return undefined;
	},
};

/** Debounce for documents that hold D2 blocks, so a renderer is not asked for a picture after every keystroke */
const D2_DEBOUNCE_MS = 800;

/** Longest image address the extension emits; common servers refuse request lines beyond about 8 KB */
const MAX_D2_URL_LENGTH = 8000;

const D2_LAYOUTS = ["dagre", "elk", "tala"];

/** D2 theme IDs: 0 is "Neutral Default" and 200 is "Dark Mauve" */
const D2_THEME_LIGHT = 0;
const D2_THEME_DARK = 200;

/**
 * Encodes D2 source for a Kroki-style renderer address
 *
 * The format is zlib deflate at level 9, then Base64 with `-` and `_` in place
 * of `+` and `/`. Padding stays, as in Kroki's reference encoders, because `=`
 * is legal in a URL path.
 *
 * @param {string} source - D2 source text
 * @returns {string} URL-safe payload
 */
function encodeD2Payload(source) {
	return zlib
		.deflateSync(Buffer.from(source, "utf8"), { level: 9 })
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");
}

/**
 * Validates and normalizes the renderer URL from the settings
 *
 * Why so strict: the origin is copied into the page's CSP, and diagram text is
 * sent to it. Only plain http(s) base URLs pass, and the host must be made of
 * characters that cannot end a CSP source expression (`;`, `,`), so the setting
 * cannot add directives. Credentials, query strings and fragments are refused
 * because the extension appends its own path and query.
 *
 * @param {unknown} value - The raw setting value
 * @returns {{ url: string, origin: string } | { error: string }} Base URL without a trailing slash and its origin, or the reason it was refused
 */
function parseRendererUrl(value) {
	const text = typeof value === "string" ? value.trim() : "";
	if (!text) {
		return { error: "The URL is empty." };
	}
	let parsed;
	try {
		parsed = new URL(text);
	} catch {
		return { error: "The URL is not valid." };
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return { error: "Only http: and https: URLs are accepted." };
	}
	if (parsed.username || parsed.password) {
		return { error: "The URL must not contain a user name or password." };
	}
	if (/[?#]/.test(text)) {
		return { error: "The URL must not contain a query string or fragment." };
	}
	if (!/^(?:(?:[a-z0-9_-]+\.)*[a-z0-9_-]+\.?|\[[0-9a-f:.]+\])$/.test(parsed.hostname)) {
		return { error: "The host name contains characters that are not allowed." };
	}
	return { url: parsed.origin + parsed.pathname.replace(/\/+$/, ""), origin: parsed.origin };
}

/**
 * Builds the image address that asks the renderer for one diagram
 *
 * Only options that differ from the renderer's defaults are sent, so a theme or
 * layout the author sets inside the D2 source is not overridden needlessly.
 * The theme is always sent because it follows the editor.
 *
 * @param {string} baseUrl - Normalized renderer URL from parseRendererUrl()
 * @param {string} source - D2 source text
 * @param {{ theme?: number, sketch?: boolean, layout?: string }} options - Rendering options
 * @returns {string} Absolute image address
 */
function buildD2Url(baseUrl, source, options = {}) {
	const query = [`theme=${options.theme ?? D2_THEME_LIGHT}`];
	if (options.sketch) {
		query.push("sketch=true");
	}
	if (D2_LAYOUTS.includes(options.layout) && options.layout !== "dagre") {
		query.push(`layout=${options.layout}`);
	}
	return `${baseUrl}/d2/svg/${encodeD2Payload(source)}?${query.join("&")}`;
}

/**
 * Tells whether a `marked` code token is a D2 fence
 *
 * The match ignores case and anything after the language, so `D2` and
 * `d2 title="x"` both count.
 *
 * @param {{ type: string, lang?: string }} token - A token from `marked`
 * @returns {boolean} True for a fenced block whose language is d2
 */
function isD2Fence(token) {
	return token.type === "code" && /^d2$/i.test((token.lang || "").split(/\s/)[0]);
}

/**
 * Renders one D2 fence as markup
 *
 * Why an `<img>`: an image cannot run the SVG's scripts and needs no message
 * from the page to the extension. The failure box and the source stay hidden
 * until the page script sees the image fail, because an image cannot expose the
 * compiler message a renderer returns.
 *
 * @param {string} source - D2 source text
 * @param {{ rendererUrl?: string, theme?: number, sketch?: boolean, layout?: string }} d2 - Settings and theme
 * @returns {string} HTML for the block
 */
function renderD2Block(source, d2) {
	const text = source.trim();
	if (!text) {
		return '<div class="d2-notice">This D2 block is empty.</div>\n';
	}
	const sourceBox = `<pre class="d2-source">${escapeHtml(text)}</pre>`;
	const renderer = parseRendererUrl(d2.rendererUrl);
	if (renderer.error) {
		const why =
			d2.rendererUrl && d2.rendererUrl.trim()
				? `The D2 renderer URL is not usable. ${renderer.error}`
				: "No D2 renderer is set.";
		return `<div class="d2-notice"><strong>${escapeHtml(why)}</strong> Run <em>Markdown: Choose D2 Renderer</em> from the Command Palette, or set <code>lightweightMarkdownViewer.d2.rendererUrl</code>.${sourceBox}</div>\n`;
	}
	const url = buildD2Url(renderer.url, text, d2);
	if (url.length > MAX_D2_URL_LENGTH) {
		return `<div class="d2-notice"><strong>This D2 diagram is too large to send in a URL</strong> (${url.length} characters, limit ${MAX_D2_URL_LENGTH}). Split it into smaller diagrams.${sourceBox}</div>\n`;
	}
	return (
		`<figure class="d2-diagram"><img class="d2-img" src="${escapeHtml(url)}" alt="D2 diagram" referrerpolicy="no-referrer">` +
		`<div class="d2-error" role="alert" hidden><strong>This D2 diagram did not render.</strong> The renderer at ${escapeHtml(renderer.origin)} sent no picture. ` +
		`Look for a syntax error in the diagram, and check the renderer URL.</div>${sourceBox.replace("<pre ", "<pre hidden ")}</figure>\n`
	);
}

const markdown = new Marked({
	extensions: [mathBlock, mathInline, mermaidColonFence],
	renderer: {
		code(token) {
			if ((token.lang || "").split(/\s/)[0] !== "mermaid") {
				return false;
			}
			return `<pre class="mermaid">${escapeHtml(token.text.trim())}</pre>\n`;
		},
		heading(token) {
			if (!token.id) {
				return false;
			}
			return `<h${token.depth} id="${token.id}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
		},
	},
});

const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/**
 * Decodes the entities `marked` leaves in inline text tokens
 *
 * Inline `text` tokens keep the source spelling (`&amp;`), but the outline and
 * the heading ID need what the reader sees.
 *
 * @param {string} text - Inline text as written in the Markdown source
 * @returns {string} Text with named and numeric entities decoded
 */
function decodeEntities(text) {
	return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (match, dec, hex, name) => {
		if (name) {
			return NAMED_ENTITIES[name.toLowerCase()] ?? match;
		}
		const code = dec ? parseInt(dec, 10) : parseInt(hex, 16);
		return code <= 0x10ffff ? String.fromCodePoint(code) : match;
	});
}

/**
 * Returns the text a reader sees for a list of inline tokens
 *
 * @param {Array} tokens - Inline tokens from `marked`
 * @returns {string} Plain text without formatting markers
 */
function plainText(tokens) {
	return tokens
		.map((token) => {
			if (token.tokens) {
				return plainText(token.tokens);
			}
			if (token.type === "text") {
				return decodeEntities(token.text);
			}
			// A formula keeps its delimiters, so the outline shows what the author wrote
			return token.type === "mathInline" ? token.raw : (token.text ?? token.raw);
		})
		.join("");
}

/**
 * Builds a GitHub-style anchor from heading text
 *
 * @param {string} text - Plain heading text
 * @returns {string} Lowercase text with punctuation removed and whitespace turned into hyphens
 */
function slugify(text) {
	return text
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
		.replace(/\s/g, "-");
}

/**
 * Collects headings from the token stream and assigns each one its anchor ID
 *
 * The parser decides what a heading is, so fences, setext headings, quotes and
 * list items need no special cases here. The ID is written onto the token, and
 * the heading renderer reads it from there, so the outline and the page cannot
 * disagree.
 *
 * @param {Array} tokens - Block tokens from `marked.lexer`
 * @returns {Array} Heading objects with level, text, id and lineIndex (source line of the enclosing top-level block)
 */
function collectHeadings(tokens) {
	const headings = [];
	const used = new Set();
	let line = 0;

	tokens.forEach((block) => {
		markdown.walkTokens([block], (token) => {
			if (token.type !== "heading") {
				return;
			}
			const text = plainText(token.tokens);
			const base = slugify(text) || "section";
			let id = base;
			for (let n = 1; used.has(id); n++) {
				id = `${base}-${n}`;
			}
			used.add(id);
			token.id = id;
			headings.push({ level: token.depth, text, id, lineIndex: line });
		});
		line += block.raw.split("\n").length - 1;
	});

	return headings;
}

/**
 * Extracts headings from markdown raw text
 *
 * Parses the text with the same parser that renders it, so headings inside
 * code, Mermaid blocks and other containers are never reported.
 *
 * @param {string} raw - The raw markdown text
 * @returns {Array} Array of heading objects with level, text, id and lineIndex
 */
function extractHeadings(raw) {
	return collectHeadings(markdown.lexer(raw));
}

/**
 * Rewrites the `src` of `<img>` tags written as raw HTML in a document
 *
 * Authors use raw tags to size images (`<img src="a.png" width="300">`). The
 * rewrite is confined to HTML tokens, so it never touches code or prose, and a
 * changed address is re-escaped for the attribute it lands in.
 *
 * @param {string} html - Text of one `marked` HTML token
 * @param {(href: string) => string} resolveImage - Maps an image address to the address the page should load
 * @returns {string} The HTML with local image addresses resolved
 */
function resolveHtmlImages(html, resolveImage) {
	return html.replace(/(<img\b[^>]*?\ssrc=)(["'])(.*?)\2/gis, (match, before, quote, href) => {
		const resolved = resolveImage(href);
		return `${before}${quote}${resolved === href ? href : escapeHtml(resolved)}${quote}`;
	});
}

/**
 * Converts markdown source to body HTML plus the heading list for the TOC
 *
 * Pipeline:
 * 1. Lex the source into tokens; math and Mermaid are parser extensions
 * 2. Collect headings and write their IDs onto the tokens
 * 3. Optionally rewrite image addresses on the tokens, in Markdown images and raw `<img>` tags
 * 4. Turn D2 fences into image markup that points at the configured renderer
 * 5. Render the tokens to HTML
 *
 * Why tokens and not text rewriting: the parser already knows what is code, so
 * `$HOME` in a fence or a heading marker in a `~~~` block cannot be mistaken
 * for math or a heading, and no placeholder has to survive a round trip.
 *
 * @param {string} source - Raw markdown text
 * @param {{ resolveImage?: (href: string) => string, d2?: { rendererUrl?: string, theme?: number, sketch?: boolean, layout?: string } }} [options] - `resolveImage` maps each Markdown image address to the address the page should load; `d2` holds the renderer URL and options for D2 fences
 * @returns {{ html: string, headings: Array, d2Origin?: string }} Rendered HTML, extracted headings, and the validated D2 renderer origin that the CSP must admit
 */
function renderMarkdown(source, options = {}) {
	const tokens = markdown.lexer(source);
	const headings = collectHeadings(tokens);

	if (options.resolveImage) {
		markdown.walkTokens(tokens, (token) => {
			if (token.type === "image") {
				token.href = options.resolveImage(token.href);
			} else if (token.type === "html") {
				token.text = resolveHtmlImages(token.text, options.resolveImage);
			}
		});
	}

	// A D2 fence becomes a finished HTML token, so no later pass rewrites its address and the parser emits it as written
	const renderer = parseRendererUrl(options.d2?.rendererUrl);
	markdown.walkTokens(tokens, (token) => {
		if (isD2Fence(token)) {
			token.type = "html";
			token.block = true;
			token.text = renderD2Block(token.text, options.d2 || {});
		}
	});

	return { html: markdown.parser(tokens), headings, d2Origin: renderer.origin };
}

/**
 * Renders a markdown document into the webview
 *
 * Runs renderMarkdown with image paths resolved to webview URIs, then injects the
 * result into the HTML template with a fresh CSP nonce. Errors surface as a
 * VS Code notification, so a failed render is visible.
 *
 * @param {vscode.WebviewPanel} panel - The webview to update
 * @param {vscode.TextDocument} document - The markdown document to render
 */
function updateWebviewContent(panel, document) {
	try {
		const theme = resolveTheme();
		const { html, headings, d2Origin } = renderMarkdown(document.getText(), {
			resolveImage: (href) => resolveImagePath(href, document, panel),
			d2: { ...readD2Settings(), theme: theme.d2Theme },
		});

		panel.webview.html = getWebviewContent(html, getNonce(), headings, theme, document.uri.toString(), d2Origin);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to render markdown: ${error.message}`);
	}
}

/**
 * Builds a parent-child tree from a flat array of headings
 *
 * Uses a stack to track nesting: each heading becomes a child of the most
 * recent heading with a lower level. Handles irregular hierarchies gracefully
 * (e.g., h1 followed by h3 with no h2 makes h3 a child of h1).
 *
 * @param {Array} headings - Array of heading objects with level, text, id
 * @returns {Array} Array of root tree nodes, each with { heading, children }
 */
function buildTOCTree(headings) {
	const root = { children: [] };
	const stack = [{ node: root, level: 0 }];

	headings.forEach((heading) => {
		const newNode = { heading, children: [] };

		// Pop stack until we find a parent with a lower level
		while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
			stack.pop();
		}

		stack[stack.length - 1].node.children.push(newNode);
		stack.push({ node: newNode, level: heading.level });
	});

	return root.children;
}

/**
 * Recursively renders a TOC tree node to HTML
 *
 * Parent nodes (those with children) are wrapped in <details>/<summary> for
 * native collapsibility. Leaf nodes render as plain list items. All nodes
 * include a pound-sign prefix indicating heading depth.
 *
 * @param {Object} node - Tree node with { heading, children }
 * @returns {string} HTML string for this node and its descendants
 */
function renderTOCNode(node) {
	const h = node.heading;
	const prefix = "#".repeat(h.level);
	const hasChildren = node.children.length > 0;

	let html = `<li class="toc-item toc-level-${h.level}${hasChildren ? "" : " toc-leaf"}">`;

	if (hasChildren) {
		const openAttr = h.level <= 1 ? " open" : "";
		html += `<details class="toc-details"${openAttr}>`;
		html += `<summary class="toc-summary"><a href="#${h.id}" class="toc-link"><span class="toc-prefix">${prefix}</span>${escapeHtml(h.text)}</a></summary>`;
		html += '<ul class="toc-list">';
		node.children.forEach((child) => {
			html += renderTOCNode(child);
		});
		html += "</ul>";
		html += "</details>";
	} else {
		html += `<a href="#${h.id}" class="toc-link"><span class="toc-prefix">${prefix}</span>${escapeHtml(h.text)}</a>`;
	}

	html += "</li>";
	return html;
}

/**
 * Generates collapsible TOC HTML from headings array
 *
 * Builds a tree structure from flat headings, then renders recursively.
 * Parent headings with children are collapsible (H1 nodes expanded by default).
 * Each entry shows pound-sign prefixes indicating heading depth.
 *
 * @param {Array} headings - Array of heading objects with level, text, id
 * @returns {string} HTML for the nested, collapsible TOC list
 */
function generateTOC(headings) {
	if (headings.length === 0)
		return '<p style="font-size: 0.9em; color: var(--vscode-descriptionForeground);">No headings found</p>';

	const tree = buildTOCTree(headings);
	let tocHtml = '<ul class="toc-list">';
	tree.forEach((node) => {
		tocHtml += renderTOCNode(node);
	});
	tocHtml += "</ul>";
	return tocHtml;
}

/**
 * Detects VS Code color theme kind and returns appropriate sub-theme names
 *
 * Maps VS Code's active color theme to the Mermaid diagram theme, the D2 theme
 * ID and the highlight.js stylesheet URL for consistent appearance.
 *
 * @returns {{ mermaidTheme: string, hljsTheme: string, d2Theme: number }} Theme configuration
 */
function resolveTheme() {
	const kind = vscode.window.activeColorTheme.kind;
	const isDark = kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast;
	return {
		mermaidTheme: isDark ? "dark" : "default",
		d2Theme: isDark ? D2_THEME_DARK : D2_THEME_LIGHT,
		hljsTheme: `https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@${CDN_VERSIONS.highlightjs}/styles/atom-one-${isDark ? "dark" : "light"}.min.css`,
	};
}

/**
 * Generates the complete HTML content for the webview
 *
 * Loads the HTML template (inlined at build time by webpack) and replaces
 * placeholder tokens with dynamic values in a single pass. A value is never
 * rescanned, so "{{...}}" text in a document or heading cannot trigger a
 * substitution, and "$" sequences in content stay literal.
 *
 * Template placeholders:
 * - {{NONCE}}: CSP nonce token (appears on every inline and CDN script tag)
 * - {{MERMAID_VERSION}}, {{MATHJAX_VERSION}}, {{HLJS_VERSION}}: pinned CDN versions from CDN_VERSIONS
 * - {{HLJS_THEME}}: highlight.js stylesheet URL
 * - {{RENDERER_ORIGIN}}: the D2 renderer origin for `img-src`, with a leading space, or empty
 * - {{MERMAID_THEME}}: Mermaid diagram theme name
 * - {{TOC}}: Generated table of contents HTML
 * - {{CONTENT}}: Rendered markdown HTML
 * - {{DOC_KEY}}: Escaped URI of the previewed document, read by the page to scope its saved scroll position
 *
 * @param {string} markdownHtml - Already-rendered HTML from marked
 * @param {string} nonce - Security token for CSP (random string)
 * @param {Array} headings - Array of heading objects for TOC generation
 * @param {{ mermaidTheme: string, hljsTheme: string }} theme - Theme config from resolveTheme()
 * @param {string} documentKey - URI of the previewed document; the page keys its saved scroll position to it
 * @param {string} [d2Origin] - Validated origin of the D2 renderer, from parseRendererUrl(); added to `img-src` and nowhere else
 * @returns {string} Complete HTML page
 */
function getWebviewContent(markdownHtml, nonce, headings = [], theme = {}, documentKey = "", d2Origin = "") {
	const values = {
		NONCE: nonce,
		MERMAID_VERSION: CDN_VERSIONS.mermaid,
		MATHJAX_VERSION: CDN_VERSIONS.mathjax,
		HLJS_VERSION: CDN_VERSIONS.highlightjs,
		HLJS_THEME: theme.hljsTheme,
		MERMAID_THEME: theme.mermaidTheme,
		RENDERER_ORIGIN: d2Origin ? ` ${d2Origin}` : "",
		DOC_KEY: escapeHtml(documentKey),
		TOC: generateTOC(headings),
		CONTENT: markdownHtml,
	};

	// One pass over the template, so placeholder-like text inside the document or a heading is never substituted
	return webviewTemplate.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => values[key] ?? match);
}

/**
 * Generates a random nonce for Content Security Policy
 *
 * The CSP only runs scripts carrying the nonce of the current render, so the
 * value must be unguessable by markdown content. It comes from the operating
 * system's CSPRNG (`crypto.randomBytes`) because `Math.random` output can be
 * predicted from earlier values.
 *
 * @returns {string} Random 32-character hexadecimal string
 */
function getNonce() {
	return crypto.randomBytes(16).toString("hex");
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
	extractHeadings,
	buildTOCTree,
	generateTOC,
	getNonce,
	escapeHtml,
	renderMarkdown,
	getWebviewContent,
	encodeD2Payload,
	parseRendererUrl,
	buildD2Url,
	CDN_VERSIONS,
};
