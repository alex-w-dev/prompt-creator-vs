import * as vscode from "vscode";
import { TextDecoder } from "util";
import ignore from "ignore";

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "promptCreator.sidebarView";

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this.getWebviewContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "getFiles":
          await this.handleGetFiles();
          break;
        case "createPrompt":
          await this.handleCreatePrompt(message);
          break;
        case "alert":
          vscode.window.showWarningMessage(message.text);
          break;
      }
    });
  }

  private async handleGetFiles() {
    if (!this._view) return;

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
            console.error("Error reading .gitignore file:", uri.path, error);
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

      this._view.webview.postMessage({
        command: "receiveFiles",
        files: files.map((file) => ({
          uri: file.toString(),
          path: vscode.workspace.asRelativePath(file),
        })),
      });
    } catch (error) {
      vscode.window.showErrorMessage("Error fetching files.");
    }
  }

  private async handleCreatePrompt(message: any) {
    let combinedText = message.mainPrompt + "\n\n";
    const changedFiles: string[] = [];

    for (const uri of message.selectedFiles) {
      try {
        const fileUri = vscode.Uri.parse(uri);
        const content = await vscode.workspace.fs.readFile(fileUri);
        const fileContent = vscode.workspace.asRelativePath(fileUri);

        combinedText += `// START File: ${fileContent}\n`;
        combinedText += new TextDecoder().decode(content) + "\n";
        combinedText += `// END File: ${fileContent}\n\n`;
        changedFiles.push(fileContent);
      } catch (error) {
        vscode.window.showErrorMessage(`Error reading file: ${uri}`);
      }
    }

    vscode.env.clipboard.writeText(combinedText);
    vscode.window.showInformationMessage(
      `Prompt copied to clipboard! Files included: ${changedFiles.join(", ")}`
    );
  }

  private getWebviewContent(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-123456789';">
    <style>
        body { padding: 10px; font-family: var(--vscode-font-family); }
        #mainPrompt { 
            width: 100%; 
            height: 150px; 
            margin-bottom: 15px;
            padding: 8px;
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
        }
        .file-list { 
            max-height: 300px; 
            overflow-y: auto; 
            margin: 10px 0; 
        }
        .file-item { 
            margin: 5px 0;
            padding: 5px;
            background-color: var(--vscode-sideBar-background);
        }
        button { 
            padding: 10px; 
            background: var(--vscode-button-background); 
            color: var(--vscode-button-foreground); 
            border: none; 
            cursor: pointer;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <textarea id="mainPrompt" placeholder="Enter your main prompt..."></textarea>
    <div class="file-list" id="fileList"></div>
    <button onclick="createPrompt()">Create Prompt</button>

    <script nonce="123456789">
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ command: 'getFiles' });

        window.addEventListener('message', e => {
            if (e.data.command === 'receiveFiles') {
                document.getElementById('fileList').innerHTML = e.data.files.map(file => \`
                    <div class="file-item">
                        <label>
                            <input type="checkbox" value="\${file.uri}">
                            \${file.path}
                        </label>
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
            
            vscode.postMessage({ 
                command: 'createPrompt', 
                mainPrompt, 
                selectedFiles: files 
            });
        }
    </script>
</body>
</html>`;
  }
}

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("extension.createPrompt", () => {
      vscode.commands.executeCommand(
        "workbench.view.extension.prompt-creator-activitybar"
      );
    })
  );
}
