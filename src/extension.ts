import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { workspace, ExtensionContext } from 'vscode';
import * as yaml from 'yaml';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions
} from 'vscode-languageclient/node';

let client: LanguageClient;
const clientId = "markane";

export function activate(context: ExtensionContext) {
	const restartCmd = vscode.commands.registerCommand(`${clientId}.restart`, async () => {
		await stopClient();
		startClient();
	});

	const logCmd = vscode.commands.registerCommand(`${clientId}.log`, async () => {
		if (!client) return;
		client.outputChannel.show(true);
	});

	const indexCmd = vscode.commands.registerCommand(`${clientId}.index`, async () => {
		if (!client) return;
		client.sendNotification("indexDocuments");
	});

	const processCmd = vscode.commands.registerCommand(`${clientId}.process`, async () => {
		if (!client) return;

		const editor = vscode.window.activeTextEditor;
		if (editor == null) return;

		await editor.document.save();
		await client.sendNotification("processDocument", editor.document.uri.fsPath);
	});

	context.subscriptions.push(restartCmd);
	context.subscriptions.push(logCmd);
	context.subscriptions.push(indexCmd);
	context.subscriptions.push(processCmd);

	startClient();
}

export async function deactivate(): Promise<void> {
	await stopClient();
}

async function startClient() {
	const serverOptions: ServerOptions = {
		run: { command: "markane", args: ["lsp"] },
		debug: { command: "markane", args: ["lsp"] }
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'markdown' }],
		markdown: {
			supportHtml: true
		},
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher('**/*.md'),
		}
	};

	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);

	await client.start();
}

async function stopClient() {
	if (!client) return;
	await client.stop();
	client.outputChannel.dispose();
	client.traceOutputChannel.dispose();
}
