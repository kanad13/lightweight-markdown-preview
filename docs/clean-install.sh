#!/bin/zsh
set -e

# Uninstall the currently installed extension
code-insiders --uninstall-extension KunalPathak.lightweight-markdown-preview || true

# Reload the VS Code window
code-insiders --reload-window

# Remove node_modules for a clean install
rm -rf node_modules

# Install dependencies, lint, and package
npm install
npm run lint
npm run package

# Install the newly built .vsix extension
code-insiders --install-extension $(ls *.vsix | tail -n 1)

# Reload the VS Code window
code-insiders --reload-window

echo "✅ Clean install and extension reload complete."
