// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import path from 'path';
import * as vscode from 'vscode';

import {TransportKind, LanguageClient, LanguageClientOptions, ServerOptions} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Register language server
    const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    const serverOptions : ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions },
    };

    const clientOptions : LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'model-desc-lang' }],
        synchronize: {
            configurationSection: 'mdlLanguageServer',
            fileEvents: [
                vscode.workspace.createFileSystemWatcher('**/*.dlm'),
            ],
        },
    };
    client = new LanguageClient(
        'mdlLanguageServer',
        'MDL Language Server',
        serverOptions,
        clientOptions
    );

    client.start();

    context.subscriptions.push(client);

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    // console.log('Congratulations, your extension "mdl-language-server" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    //const disposable = vscode.commands.registerCommand('mdl-language-server.helloWorld', () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    //vscode.window.showInformationMessage('Hello World from mdl-language-server!');
    //});

    //context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
