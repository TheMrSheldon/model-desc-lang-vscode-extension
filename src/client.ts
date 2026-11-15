import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

import { renderMath } from './math';

const LANGUAGE_ID = 'model-desc-lang';

let client: LanguageClient | undefined;

interface ServerChoice {
    command: string;
    source: string;
}

function bundledServer(context: vscode.ExtensionContext): string | undefined {
    const bundled = context.asAbsolutePath(path.join('server', 'bin', process.platform === 'win32' ? 'mdls.exe' : 'mdls'));
    if (!fs.existsSync(bundled)) {
        return undefined;
    }
    if (process.platform !== 'win32') {
        try {
            fs.chmodSync(bundled, 0o755); // packaging may drop the executable bit
        } catch {
            // read-only installation: the bit is probably set already
        }
    }
    return bundled;
}

/** The first executable called `mdls` in the PATH. */
function serverOnPath(): string | undefined {
    const names = process.platform === 'win32' ? ['mdls.exe', 'mdls.cmd', 'mdls.bat'] : ['mdls'];
    for (const dir of (process.env.PATH ?? '').split(path.delimiter).filter((d) => d !== '')) {
        for (const name of names) {
            const candidate = path.join(dir, name);
            try {
                if (fs.statSync(candidate).isFile()) {
                    fs.accessSync(candidate, fs.constants.X_OK);
                    return candidate;
                }
            } catch {
                // not here
            }
        }
    }
    return undefined;
}

/**
 * Finds the language server executable, in this order:
 *  1. the `mdl.server.path` setting,
 *  2. (with `mdl.server.preferBundled`) the binary bundled with the extension,
 *  3. an `mdls` on the PATH, i.e. a local installation of MDL,
 *  4. the bundled binary.
 */
function resolveServer(context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration): ServerChoice | undefined {
    const configured = config.get<string>('server.path', '').trim();
    if (configured !== '') {
        return { command: configured, source: 'the mdl.server.path setting' };
    }
    const bundled = bundledServer(context);
    if (config.get<boolean>('server.preferBundled', false) && bundled) {
        return { command: bundled, source: 'the bundled server (mdl.server.preferBundled)' };
    }
    const local = serverOnPath();
    if (local) {
        return { command: local, source: 'the mdls on the PATH' };
    }
    return bundled ? { command: bundled, source: 'the bundled server' } : undefined;
}

function isDarkTheme(): boolean {
    const kind = vscode.window.activeColorTheme.kind;
    return kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast;
}

/** Typesets the formulas of a documentation string. */
function withMath<T extends vscode.MarkdownString | vscode.MarkedString | string | undefined>(content: T): T | vscode.MarkdownString {
    if (content instanceof vscode.MarkdownString) {
        const rendered = new vscode.MarkdownString(renderMath(content.value, isDarkTheme()));
        rendered.isTrusted = content.isTrusted;
        return rendered;
    }
    return content;
}

async function startClient(context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('mdl');
    const server = resolveServer(context, config);
    if (!server) {
        void vscode.window.showErrorMessage(
            `No MDL language server found for ${process.platform}-${process.arch}: install MDL (mdls on the PATH) or set "mdl.server.path".`
        );
        return;
    }
    const command = server.command;

    const serverOptions: ServerOptions = {
        command,
        args: ['--stdio'],
        transport: TransportKind.stdio,
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: LANGUAGE_ID }],
        middleware: {
            provideHover: async (document, position, token, next) => {
                const hover = await next(document, position, token);
                if (hover) {
                    hover.contents = hover.contents.map((c) => withMath(c));
                }
                return hover;
            },
            provideCompletionItem: async (document, position, context, token, next) => {
                const result = await next(document, position, context, token);
                const items = Array.isArray(result) ? result : result?.items;
                for (const item of items ?? []) {
                    item.documentation = withMath(item.documentation);
                }
                return result;
            },
        },
        initializationOptions: {
            importDirs: config.get<string[]>('importDirs', []),
            float: config.get<string>('float', 'f32'),
        },
    };

    client = new LanguageClient('mdl', 'MDL Language Server', serverOptions, clientOptions);
    client.outputChannel.appendLine(`Using ${command} (${server.source})`);
    try {
        await client.start();
    } catch (error) {
        client = undefined;
        void vscode.window.showErrorMessage(
            `Could not start the MDL language server (${command}): ${error instanceof Error ? error.message : error}. ` +
                'Set "mdl.server.path" to the mdls executable.'
        );
    }
}

async function stopClient(): Promise<void> {
    const running = client;
    client = undefined;
    await running?.stop();
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    await startClient(context);

    // The server reads its options only when it starts.
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('mdl')) {
                await stopClient();
                await startClient(context);
            }
        }),
        vscode.commands.registerCommand('mdl.restartServer', async () => {
            await stopClient();
            await startClient(context);
        })
    );
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}
