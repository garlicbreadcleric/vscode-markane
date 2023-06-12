import { spawn } from "child_process";

import * as vscode from "vscode";
import { workspace, ExtensionContext } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";

let client: LanguageClient;
const clientId = "markane";

function getMarkanePath(): string {
  const config = vscode.workspace.getConfiguration("markane");
  return config?.server?.path ?? "markane";
}

export async function activate(context: ExtensionContext) {
  const restartCmd = vscode.commands.registerCommand(
    `${clientId}.restart`,
    async () => {
      await stopClient();
      startClient();
    }
  );

  const logCmd = vscode.commands.registerCommand(
    `${clientId}.log`,
    async () => {
      if (!client) {
        return;
      }
      client.outputChannel.show(true);
    }
  );

  const indexCmd = vscode.commands.registerCommand(
    `${clientId}.index`,
    async () => {
      if (!client) {
        return;
      }
      client.sendNotification("markane/indexDocuments");
    }
  );

  context.subscriptions.push(restartCmd);
  context.subscriptions.push(logCmd);
  context.subscriptions.push(indexCmd);

  const supportedMarkaneVersions = new Set([
    "0.0.3",
    "0.0.4",
    "0.0.5",
    "0.0.6",
  ]);
  const markaneVersion = await getMarkaneVersion();
  if (markaneVersion == null) {
    vscode.window.showErrorMessage(
      `Markane ${markaneVersion} is not installed.`
    );
    return;
  }

  if (!supportedMarkaneVersions.has(markaneVersion)) {
    vscode.window.showErrorMessage(
      `Markane version ${markaneVersion} is not supported.`
    );
    return;
  }

  startClient();
}

export async function deactivate(): Promise<void> {
  await stopClient();
}

async function getMarkaneVersion(): Promise<string | null> {
  const versionOutput: string | null = await new Promise((resolve, reject) => {
    const child = spawn(getMarkanePath(), ["version"]);
    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        resolve(null);
      }
    });
    child.on("error", (err) => {
      resolve(null);
    });
  });

  return versionOutput?.trim() ?? null;
}

async function startClient() {
  const markanePath = getMarkanePath();
  const serverOptions: ServerOptions = {
    run: { command: markanePath, args: ["lsp"] },
    debug: { command: markanePath, args: ["lsp"] },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "markdown" }],
    markdown: {
      supportHtml: true,
    },
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/*.md"),
    },
  };

  client = new LanguageClient(
    "markane",
    "Markane",
    serverOptions,
    clientOptions
  );

  await client.start();

  client.onNotification(
    "markane/showReferences",
    async ([uri, position, locations]) => {
      await vscode.commands.executeCommand(
        "editor.action.showReferences",
        vscode.Uri.parse(uri),
        new vscode.Position(position.line, position.character),
        locations.map(
          (l: any) => new vscode.Location(vscode.Uri.parse(l.uri), l.range)
        )
      );
    }
  );

  client.onNotification(
    "markane/showMentions",
    async ([uri, position, locations]) => {
      await vscode.commands.executeCommand(
        "editor.action.peekLocations",
        vscode.Uri.parse(uri),
        new vscode.Position(position.line, position.character),
        locations.map(
          (l: any) => new vscode.Location(vscode.Uri.parse(l.uri), l.range)
        )
      );
    }
  );
}

async function stopClient() {
  if (!client) {
    return;
  }
  await client.stop();
  client.outputChannel.dispose();
  client.traceOutputChannel.dispose();
}
