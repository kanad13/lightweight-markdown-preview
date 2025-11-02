This is an excellent architecture document. It’s clear, well-reasoned, and effectively communicates the "why" behind key decisions, which is often missing in technical documentation. It correctly prioritizes security and performance for its specific use case.

The document is strong as-is, but if the goal is to make it even more scannable and accessible for a future developer (or an AI agent) who needs to get up to speed quickly, here are a few minor refinements. These changes focus on improving readability and structure rather than altering the core content.

### Suggested Refinements

Here are a few sections with suggested tweaks to enhance clarity.

---

### **1. Security Model (Revised)**

**Reasoning:** The original is very thorough but dense. Starting with a high-level summary of the defense-in-depth strategy makes the detailed points easier to digest.

**(Suggested Version)**

## Security Model

Our security model assumes that any markdown file could be malicious. We use a defense-in-depth strategy to mitigate risks, primarily Cross-Site Scripting (XSS).

Our defense is built on four key layers:
1.  **Strict Content Security Policy (CSP):** Only scripts we explicitly trust are allowed to execute.
2.  **HTML Sanitization:** The `marked` library escapes dangerous HTML tags by default.
3.  **Trusted Third Parties:** We only load rendering libraries from reputable, verified CDNs.
4.  **VS Code Sandbox:** The webview itself runs in a restricted environment with no access to the local file system.

#### Layer 1: Content Security Policy (CSP) with Nonces

We enforce a strict CSP that only allows scripts with a unique, randomly-generated `nonce` (number used once) to run.

*   **How it works:** A new cryptographic nonce is generated for every preview render. This nonce is included in the CSP `meta` tag and in every legitimate `<script>` tag.
*   **Effect:** Any malicious `<script>` tag injected within the markdown will not have the correct nonce and will be blocked by the browser from executing.

#### Layer 2: Safe HTML Parsing

The `marked` parser sanitizes input by escaping HTML, turning potentially executable code into inert text.
*   **Example:** `<script>alert('xss')</script>` becomes `&lt;script&gt;alert('xss')&lt;/script&gt;`.

#### Layer 3 & 4: Trusted Scripts and VS Code Sandbox

*   Mermaid and MathJax are loaded from trusted CDNs, not from user-controlled content.
*   The entire preview is sandboxed by VS Code, preventing access to the file system or other sensitive resources.

---

### **2. State Management (Revised)**

**Reasoning:** The original arrow-based flow is creative but can be hard to read in some markdown renderers. A standard numbered list is more conventional and scannable. Changing the title to be more specific ("In-Memory State") immediately clarifies that nothing is persisted.

**(Suggested Version)**

## In-Memory State Management

The extension's state is managed entirely in memory and is reset every time the extension is reloaded. It follows a simple lifecycle:

1.  **Initialization:** When the user runs the "Show Preview" command, the extension creates a single webview panel.
2.  **State Variables:** Two key variables are set in a closure:
    *   `currentPanel`: Holds the reference to the active webview.
    *   `currentDocument`: Holds the reference to the text document being previewed.
3.  **Event Listening:** An `onDidChangeTextDocument` listener is registered to watch for edits.
4.  **Update Cycle:** When the document changes, the listener triggers an update:
    *   A new CSP `nonce` is generated.
    *   The markdown content is parsed and rendered into a full HTML document.
    *   The webview's HTML is replaced with the new content.
5.  **Disposal:** When the user closes the panel, the listener is removed and the `currentPanel` variable is set to `null`, releasing its resources.

---

### **3. Guidelines for Future Changes (Revised)**

**Reasoning:** Combining "What Can Be Extended Safely" and "What Should NOT Be Modified" under a single, actionable heading improves the document's flow. It reframes the "don't touch this" section into a more collaborative "this requires review," which is better for maintainability.

**(Suggested Version)**

## Guidelines for Future Changes

To maintain the extension's stability and security, please follow these guidelines.

### Safe to Modify
The following areas are generally safe for modification and extension:
*   **Styling:** Adjusting CSS for elements like the body, code blocks, and tables.
*   **Markdown Options:** Passing new configuration options to the `marked()` parser.
*   **VS Code Settings:** Adding new user-configurable settings in `package.json`.
*   **New Commands:** Adding new commands in `package.json` and implementing them in `extension.js`.

### Requires Security Review
Changes to the following areas are high-risk and **must undergo a security review**. They form the core of the extension's security and stability.
*   **Content Security Policy (CSP):** Modifying the CSP header can instantly create security vulnerabilities.
*   **Nonce Generation:** The cryptographic token logic is critical for preventing XSS.
*   **Mermaid Preprocessing:** The regex logic is delicate and handles untrusted input.
*   **State Management:** Altering the data flow could introduce bugs or race conditions.

### Conclusion

The document is already excellent. These suggested refinements are minor polishes aimed at making an already great piece of documentation even clearer and more accessible for its intended audience. It looks good as it is, but these changes could make it slightly better.
