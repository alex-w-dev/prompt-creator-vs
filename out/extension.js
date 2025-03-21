"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const util_1 = require("util");
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand("extension.createPrompt", () => {
        const panel = vscode.window.createWebviewPanel("promptCreator", "Create Prompt", vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        panel.webview.html = getWebviewContent();
        panel.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
            switch (message.command) {
                case "getFiles":
                    const files = yield vscode.workspace.findFiles("**/*", "**/node_modules/**,**/.git/**");
                    panel.webview.postMessage({
                        command: "receiveFiles",
                        files: files.map((file) => ({
                            uri: file.toString(),
                            path: vscode.workspace.asRelativePath(file),
                        })),
                    });
                    break;
                case "createPrompt":
                    let combinedText = message.mainPrompt + "\n\n";
                    for (const uri of message.selectedFiles) {
                        try {
                            const fileUri = vscode.Uri.parse(uri);
                            const content = yield vscode.workspace.fs.readFile(fileUri);
                            combinedText += `// File: ${vscode.workspace.asRelativePath(fileUri)}\n`;
                            combinedText += new util_1.TextDecoder().decode(content) + "\n\n";
                        }
                        catch (error) {
                            vscode.window.showErrorMessage(`Error reading file: ${uri}`);
                        }
                    }
                    vscode.env.clipboard.writeText(combinedText);
                    vscode.window.showInformationMessage("Prompt copied to clipboard!");
                    break;
                case "alert":
                    vscode.window.showWarningMessage(message.text);
                    break;
            }
        }), undefined, context.subscriptions);
    }));
}
exports.activate = activate;
function getWebviewContent() {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <style>
        body { padding: 10px; font-family: Arial; }
        #mainPrompt { width: 100%; height: 150px; margin-bottom: 15px; }
        .file-list { max-height: 300px; overflow-y: auto; margin: 10px 0; }
        .file-item { margin: 5px 0; }
        button { padding: 10px; background: #007acc; color: white; border: none; cursor: pointer; }
    </style>
</head>
<body>
    <textarea id="mainPrompt" placeholder="Enter your main prompt..."></textarea>
    <div id="fileList" class="file-list"></div>
    <button onclick="createPrompt()">Create Prompt</button>

    <script>
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ command: 'getFiles' });

        window.addEventListener('message', e => {
            if (e.data.command === 'receiveFiles') {
                document.getElementById('fileList').innerHTML = e.data.files.map(file => \`
                    <div class="file-item">
                        <label><input type="checkbox" value="\${file.uri}"> \${file.path}</label>
                    </div>
                \`).join('');
            }
        });

        function createPrompt() {
            const mainPrompt = document.getElementById('mainPrompt').value;
            const files = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.value);
            
            if (!mainPrompt && files.length === 0) {
                vscode.postMessage({ command: 'alert', text: 'Please enter a prompt or select files!' });
                return;
            }
            
            vscode.postMessage({ command: 'createPrompt', mainPrompt, selectedFiles: files });
        }
    </script>
</body>
</html>`;
}
//# sourceMappingURL=extension.js.map