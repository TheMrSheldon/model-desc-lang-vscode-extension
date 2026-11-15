// Downloads the prebuilt MDL tools (mdls, mdl-format, standard library) of a release into server/.
//   node scripts/fetch-server.mjs [--target <vsce target>] [--version <tag>]
// The target defaults to the current platform; the version to the tag in mdl-version.txt.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = 'TheMrSheldon/Model-Description-Language';
const root = resolve(import.meta.dirname, '..');

function arg(name) {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

const target = arg('target') ?? `${process.platform}-${process.arch}`;
const version = arg('version') ?? readFileSync(join(root, 'mdl-version.txt'), 'utf8').trim();

// vsce target -> release asset (macOS ships one universal build)
const assets = {
    'linux-x64': 'mdl-tools-linux-x64.tar.gz',
    'linux-arm64': 'mdl-tools-linux-arm64.tar.gz',
    'darwin-x64': 'mdl-tools-darwin-universal.tar.gz',
    'darwin-arm64': 'mdl-tools-darwin-universal.tar.gz',
    'win32-x64': 'mdl-tools-win32-x64.zip',
    'win32-arm64': 'mdl-tools-win32-arm64.zip',
};
const asset = assets[target];
if (!asset) {
    console.error(`No MDL tools for target "${target}" (known: ${Object.keys(assets).join(', ')})`);
    process.exit(1);
}

const base = `https://github.com/${REPO}/releases/download/${version}`;
const download = async (name) => {
    const response = await fetch(`${base}/${name}`);
    if (!response.ok) {
        throw new Error(`Downloading ${base}/${name} failed: ${response.status} ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
};

const work = mkdtempSync(join(tmpdir(), 'mdl-tools-'));
try {
    const [archive, sums] = await Promise.all([download(asset), download('SHA256SUMS')]);
    const expected = sums.toString().split(/\r?\n/).map((l) => l.trim().split(/\s+/)).find(([, name]) => name?.replace(/^\*/, '') === asset)?.[0];
    const actual = createHash('sha256').update(archive).digest('hex');
    if (!expected || expected.toLowerCase() !== actual) {
        throw new Error(`Checksum mismatch for ${asset}: expected ${expected}, got ${actual}`);
    }

    const file = join(work, asset);
    writeFileSync(file, archive);
    const unpacked = join(work, 'unpacked');
    mkdirSync(unpacked);
    if (!asset.endsWith('.zip')) {
        execFileSync('tar', ['-xzf', file, '-C', unpacked]);
    } else if (process.platform === 'win32') {
        // (not tar: Git Bash may put GNU tar, which cannot read zip files, first on the PATH)
        execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${file}' -DestinationPath '${unpacked}'`]);
    } else {
        execFileSync('unzip', ['-q', file, '-d', unpacked]);
    }

    // The archive holds <name>/bin and <name>/share (or bin and share directly).
    const dirs = [unpacked, ...readdirSync(unpacked, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => join(unpacked, e.name))];
    const content = dirs.find((d) => existsSync(join(d, 'bin')));
    if (!content) {
        throw new Error(`${asset} has no bin directory`);
    }
    const server = join(root, 'server');
    rmSync(server, { recursive: true, force: true });
    cpSync(content, server, { recursive: true });
    writeFileSync(join(server, 'VERSION'), `${version} ${target}\n`);
    console.log(`MDL tools ${version} (${target}) -> ${server}`);
} finally {
    rmSync(work, { recursive: true, force: true });
}
