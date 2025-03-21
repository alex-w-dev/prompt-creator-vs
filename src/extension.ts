import * as vscode from "vscode";
import { TextDecoder } from "util";
import ignore from "ignore";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.createPrompt", () => {
      const panel = vscode.window.createWebviewPanel(
        "promptCreator",
        "Create Prompt",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      panel.webview.html = getWebviewContent();

      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.command) {
            case "getFiles":
              try {
                const gitignoreUris = await vscode.workspace.findFiles(
                  "**/.gitignore",
                  "",
                  1024
                );
                const ig = ignore();
                let hasGitignore = false;

                if (gitignoreUris.length > 0) {
                  hasGitignore = true;
                  for (const uri of gitignoreUris) {
                    try {
                      const content = await vscode.workspace.fs.readFile(uri);
                      const contentStr = new TextDecoder().decode(content);
                      ig.add(contentStr);
                    } catch (error) {
                      console.error(
                        "Error reading .gitignore file:",
                        uri.path,
                        error
                      );
                    }
                  }
                }

                let files;
                if (hasGitignore) {
                  const allFiles = await vscode.workspace.findFiles("**/*", "");
                  files = allFiles.filter((file) => {
                    const relativePath = vscode.workspace.asRelativePath(file);
                    return !ig.ignores(relativePath);
                  });
                } else {
                  files = await vscode.workspace.findFiles(
                    "**/*",
                    "**/node_modules/**,**/.git/**"
                  );
                }

                panel.webview.postMessage({
                  command: "receiveFiles",
                  files: files.map((file) => ({
                    uri: file.toString(),
                    path: vscode.workspace.asRelativePath(file),
                  })),
                });
              } catch (error) {
                vscode.window.showErrorMessage("Error fetching files.");
              }
              break;
            case "createPrompt":
              let combinedText = message.mainPrompt + "\n\n";
              for (const uri of message.selectedFiles) {
                try {
                  const fileUri = vscode.Uri.parse(uri);
                  const content = await vscode.workspace.fs.readFile(fileUri);
                  combinedText += `// File: ${vscode.workspace.asRelativePath(
                    fileUri
                  )}\n`;
                  combinedText += new TextDecoder().decode(content) + "\n\n";
                } catch (error) {
                  vscode.window.showErrorMessage(`Error reading file: ${uri}`);
                }
              }
              vscode.env.clipboard.writeText(combinedText);
              vscode.window.showInformationMessage(
                "Prompt copied to clipboard!"
              );
              break;
            case "alert":
              vscode.window.showWarningMessage(message.text);
              break;
          }
        },
        undefined,
        context.subscriptions
      );
    })
  );
}

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
    <textarea id="mainPrompt" placeholder="1 Enter your main prompt..."></textarea>
    <div>ooooo!</div>
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
