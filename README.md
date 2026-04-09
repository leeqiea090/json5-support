# JSON5 Support

JSON5 Support adds language registration, syntax highlighting, syntax diagnostics, and document formatting for `.json5` files in Visual Studio Code.

The extension is built on top of `@croct/json5-parser`, which is used both to validate documents and to format valid JSON5 content.

## Features

- Registers `.json5` files as the `json5` language.
- Highlights JSON5 syntax with a dedicated grammar.
- Reports syntax errors directly in the editor and the Problems panel.
- Formats valid JSON5 documents with `Format Document`.
- Respects editor indentation settings and the current file line endings when formatting.

## Usage

1. Open or create a `.json5` file.
2. Edit as usual and watch diagnostics appear as you type.
3. Run `Format Document` to normalize spacing and indentation.

## Requirements

- VS Code 1.115.0 or newer.
- No additional configuration is required.

## Extension Settings

This extension does not currently contribute custom settings.

## Known Limitations

- Formatting is only applied when the current document is valid JSON5.
- The extension currently focuses on syntax support only. It does not provide JSON schema validation, IntelliSense, or code actions.

## Development

```bash
npm install
npm run watch
```

Useful scripts:

- `npm run package`: run type-checking, linting, and produce the production bundle in `dist`.
- `npm run package:vsix`: build and package the extension into a `.vsix` file.
- `npm run publish:marketplace`: publish the current version with `vsce`.

The packaging helper automatically falls back to Node 20 when the local runtime is newer than the `vsce` dependency chain currently supports.

If you prefer to log in once before publishing manually, run `npx @vscode/vsce login <publisher-id>` and then use `npm run publish:marketplace`.

If you want to publish without storing credentials locally, run `npm run publish:marketplace -- -p <your-token>`.

## Automated Publishing

This repository includes a GitHub Actions workflow that publishes the extension to the Visual Studio Marketplace.

Before using it:

1. Create a Marketplace publisher and confirm that the `publisher` field in `package.json` matches it.
2. Add a repository secret named `VSCE_PAT` with a Visual Studio Marketplace personal access token that has `Marketplace (Manage)` scope.
3. Bump the version in `package.json`.
4. Push a tag in the form `vX.Y.Z` to trigger the release workflow.

You can also trigger the workflow manually from GitHub Actions.

## Release Notes

See `CHANGELOG.md` for published changes.
