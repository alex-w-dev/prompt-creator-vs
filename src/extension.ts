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
    vscode.commands.registerCommand("extension.createPrompt", async () => {
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

      try {
        const templateUri = vscode.Uri.joinPath(
          context.extensionUri,
          "src",
          "webviewTemplate.html"
        );
        const templateBytes = await vscode.workspace.fs.readFile(templateUri);
        const template = new TextDecoder().decode(templateBytes);
        const html = template.replace(
          /\{\{cspSource\}\}/g,
          panel.webview.cspSource
        );
        panel.webview.html = html;
      } catch (error) {
        vscode.window.showErrorMessage("Failed to load webview template.");
        panel.dispose();
        return;
      }

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
