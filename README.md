# Prompt Creator - VS Code Extension

A powerful VS Code extension for creating AI prompts with contextual code snippets. Organize your prompts, select relevant files, and generate perfectly formatted context-rich prompts in seconds.

## Features ✨

- **Multi-Tab Interface**  
  Organize multiple prompts in separate tabs with persistent workspace state.

- **Smart File Selection**  
  - Interactive file tree with folder navigation
  - Checkbox system with automatic .gitignore respect
  - Multi-select files/folders with intelligent parent-child selection

- **Rich Content Generation**  
  - Combines text prompt with selected file contents
  - Automatic Markdown code fence formatting
  - Clipboard copy with success notification

- **Professional Tooling**  
  - VS Code theme integration
  - Persistent state management
  - Error handling with user feedback
  - Configurable through standard VS Code settings

## Installation 🛠️

### Marketplace Installation
1. Open VS Code Extensions panel (`Ctrl+Shift+X`)
2. Search for "Prompt Creator"
3. Click Install

### Manual Installation
```bash
git clone https://github.com/alex-w-dev/prompt-creator-vs.git
cd prompt-creator-vs
npm install
npm run compile:ts
code --install-extension out/prompt-extension-1.0.26.vsix
```

## Usage 📖

1. **Open Interface**  
   Click the comment icon in status bar or run `Create Prompt` command

2. **Tab Management**  
   - Create new tabs with `+` button
   - Switch between tabs with single click
   - Close unnecessary tabs (minimum 1 tab maintained)

3. **Prompt Composition**  
   - Type main prompt in the editable content area
   - Expand folders with ▶ arrows
   - Select files using checkboxes
   - Folder checkboxes support:
     - ✓ = All files selected
     - ⬜ = No files selected
     - ▨ = Partial selection

4. **Generate Prompt**  
   Click "Create Prompt" to:
   - Combine text input with selected files
   - Format as Markdown with code fences
   - Copy to clipboard automatically
   - Show success notification

## Configuration ⚙️

The extension automatically:
- Respects `.gitignore` rules
- Excludes `node_modules` and `.git` by default
- Persists workspace state between sessions

To customize behavior:
1. Add/update `.gitignore` files in your project
2. Use VS Code settings (coming in future versions)

## Development 🧑💻

### Building from Source
```bash
npm install         # Install dependencies
npm run compile     # Increment version & create VSIX
npm run watch       # Development watch mode
```

### Architecture
```
src/
├── extension.ts        # Main extension logic
├── webviewTemplate.html # Interactive UI component
test/                   # Test directory (to implement)
package.json            # Extension manifest
```

### Contributing
PRs welcome! Please:
1. Fork repository
2. Create feature branch
3. Add tests for new functionality
4. Submit PR with detailed description

## License 📄
[MIT License](LICENSE.txt) © 2025 Alex W. Dev

---

**Pro Tip:** Combine with GitHub Copilot or ChatGPT for enhanced AI pair-programming experience!