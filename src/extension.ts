import * as vscode from "vscode";
import { TextDecoder } from "util";
import ignore from "ignore";

export function activate(context: vscode.ExtensionContext) {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "extension.createPrompt";
  statusBarItem.text = "$(comment)";
  statusBarItem.tooltip = "Create Prompt";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand("extension.createPrompt", () => {
      const panel = vscode.window.createWebviewPanel(
        "promptCreator",
        "Create Prompt",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [],
        }
      );

      panel.webview.html = getWebviewContent(panel.webview.cspSource);

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

                const savedMainPrompt =
                  context.globalState.get("mainPrompt") || "";
                const savedSelectedFiles =
                  context.globalState.get("selectedFiles") || [];

                panel.webview.postMessage({
                  command: "receiveFiles",
                  files: files.map((file) => ({
                    uri: file.toString(),
                    path: vscode.workspace.asRelativePath(file),
                  })),
                  savedMainPrompt,
                  savedSelectedFiles,
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
                  const fileContent = vscode.workspace.asRelativePath(fileUri);
                  combinedText += `### File ${fileContent}:\n`;
                  combinedText += "```\n";
                  combinedText += new TextDecoder().decode(content) + "\n";
                  combinedText += "```\n\n";
                } catch (error) {
                  vscode.window.showErrorMessage(`Error reading file: ${uri}`);
                }
              }
              vscode.env.clipboard.writeText(combinedText);
              vscode.window.showInformationMessage(
                "Prompt copied to clipboard!"
              );
              break;

            case "saveState":
              context.globalState.update("mainPrompt", message.mainPrompt);
              context.globalState.update(
                "selectedFiles",
                message.selectedFiles
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

function getWebviewContent(cspSource: string) {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline' 'unsafe-eval';">
    <style>
        body { 
            padding: 10px; 
            font-family: var(--vscode-font-family); 
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            height: calc(100vh - 20px);
        }
        #editorContainer { 
            height: 150px; 
            margin-bottom: 15px; 
            border: 1px solid var(--vscode-input-border);
            overflow: auto;
            resize: vertical;
            white-space: pre-wrap;
            line-height: 1.6;
            padding: 4px 8px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            color: var(--vscode-input-foreground);
            background-color: var(--vscode-input-background);
            outline: none;
        }
        .file-list { 
            max-height: 300px; 
            overflow-y: auto; 
            margin: 10px 0; 
        }
        .file-item { 
            margin: 5px 0; 
            padding: 2px 5px;
        }
        .file-item label {
            color: var(--vscode-editor-foreground);
            cursor: pointer;
        }
        .file-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        button { 
            padding: 10px; 
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none; 
            cursor: pointer; 
            width: 100%;
            margin-top: 10px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div id="editorContainer" contenteditable="true"></div>
    <div id="fileList" class="file-list"></div>
    <button onclick="createPrompt()">Create Prompt</button>

    <script>
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ command: 'getFiles' });

        let editor = null;

        window.addEventListener('load', () => {
            editor = document.getElementById('editorContainer');
            document.getElementById('hiddenTextarea').value = editor.innerText;
            
            editor.addEventListener('input', () => {
                document.getElementById('hiddenTextarea').value = editor.innerText;
                saveState();
            });
        });

        window.addEventListener('message', e => {
            if (e.data.command === 'receiveFiles') {
                const filesHtml = e.data.files.map(file => \`
                    <div class="file-item">
                        <label>
                            <input type="checkbox" value="\${file.uri}"> 
                            \${file.path}
                        </label>
                    </div>
                \`).join('');
                
                document.getElementById('fileList').innerHTML = filesHtml;
                editor.innerText = e.data.savedMainPrompt || '';
                document.getElementById('hiddenTextarea').value = e.data.savedMainPrompt || '';

                const savedSelectedFiles = e.data.savedSelectedFiles || [];
                document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                    checkbox.checked = savedSelectedFiles.includes(checkbox.value);
                    checkbox.addEventListener('change', saveState);
                });
            }
        });

        function saveState() {
            const mainPrompt = document.getElementById('hiddenTextarea').value;
            const selectedFiles = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.value);
            
            vscode.postMessage({
                command: 'saveState',
                mainPrompt: mainPrompt,
                selectedFiles: selectedFiles
            });
        }

        function createPrompt() {
            const mainPrompt = document.getElementById('hiddenTextarea').value;
            const files = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.value);
            
            if (!mainPrompt && files.length === 0) {
                vscode.postMessage({ command: 'alert', text: 'Please enter a prompt or select files!' });
                return;
            }
            
            vscode.postMessage({ 
                command: 'createPrompt', 
                mainPrompt: mainPrompt, 
                selectedFiles: files 
            });
        }
    </script>
    <textarea id="hiddenTextarea" style="display: none;"></textarea>
</body>
</html>`;
}
