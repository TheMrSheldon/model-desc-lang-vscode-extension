# VSCode Model Description Language Extension

## Features
Provided by the `mdls` language server of the [model description language](https://github.com/TheMrSheldon/Model-Description-Language):
- Syntax highlighting (TextMate grammar plus semantic tokens, e.g. for the axes of einops patterns)
- Context-aware autocompletion
- Errors and warnings while you type, also for generic modules
- Automatic formatting (style from a `.mdl-format` file)
- Hover on types or members shows their documentation (parsed as Doxygen); formulas (`\f$ ... \f$`, `\f[ ... \f]`) are typeset with MathJax
- Hover over `auto` shows the inferred type
- Go to definition (also into imported files and the standard library) and an outline of modules and structs
- Auto-closing of `/* */` comments and continuation of ` * ` lines

## Settings
| Setting | Description |
|---|---|
| `mdl.server.path` | Path to an `mdls` executable. |
| `mdl.server.preferBundled` | Use the bundled `mdls` even if there is one on the `PATH`. |
| `mdl.importDirs` | Additional directories that are searched for imported files. |
| `mdl.float` | The type `float` stands for (`f32`, `bf16`, `f16`). |

The command `MDL: Restart Language Server` restarts the server.

## Installation
### From Nightly
Each nightly build has one VSIX per platform (`linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `win32-x64`, `win32-arm64`) that already contains the language server. Download the one for your machine from [the nightly release](https://github.com/TheMrSheldon/model-desc-lang-vscode-extension/releases/tag/nightly) and install it through `code --install-extension <path-to-vsix>`. For example, on Linux x64 you may use
```bash
wget https://github.com/TheMrSheldon/model-desc-lang-vscode-extension/releases/download/nightly/mdl-extension-linux-x64.vsix
code --install-extension mdl-extension-linux-x64.vsix
rm mdl-extension-linux-x64.vsix
```

## Development
The extension is a thin client for the `mdls` language server of the [model description language](https://github.com/TheMrSheldon/Model-Description-Language). It looks for the server in this order:
1. the `mdl.server.path` setting,
2. (only with `mdl.server.preferBundled`) `server/bin/mdls` inside the extension,
3. `mdls` on the `PATH`, i.e. a local MDL installation (its standard library is found next to it),
4. `server/bin/mdls` inside the extension (with the standard library in `server/share/mdl/std`).

The chosen server is written to the "MDL Language Server" output channel.

`pnpm run fetch-server` downloads the prebuilt tools of the release pinned in `mdl-version.txt` into `server/` (git-ignored), verifies their checksum and unpacks them; `--target <platform>` selects another platform (e.g. `win32-x64`). To use another MDL version, change `mdl-version.txt`. The nightly workflow does the same per platform and packages one VSIX each (`vsce package --target ...`).
