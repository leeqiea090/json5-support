import * as vscode from 'vscode';
import { Formatting } from '@croct/json5-parser';
import { formatJson5 } from './jsonValidation';

export class JsonFormattingProvider implements vscode.DocumentFormattingEditProvider {
	provideDocumentFormattingEdits(
		document: vscode.TextDocument,
		options: vscode.FormattingOptions
	): vscode.TextEdit[] {
		const source = document.getText();

		if (!source.trim()) {
			return [];
		}

		const formatted = formatJson5(source, toFormattingOptions(document, options));

		if (formatted === source) {
			return [];
		}

		return [vscode.TextEdit.replace(fullDocumentRange(document, source), formatted)];
	}
}

function toFormattingOptions(document: vscode.TextDocument, options: vscode.FormattingOptions): Formatting {
	const indentationSize = options.insertSpaces ? options.tabSize : 1;

	return {
		indentationCharacter: options.insertSpaces ? 'space' : 'tab',
		lineEnding: document.eol === vscode.EndOfLine.CRLF ? 'crlf' : 'lf',
		array: {
			indentationSize,
			entryIndentation: true,
			leadingIndentation: true,
			trailingIndentation: true,
			trailingComma: false,
			commaSpacing: true,
			colonSpacing: true,
		},
		object: {
			indentationSize,
			entryIndentation: true,
			leadingIndentation: true,
			trailingIndentation: true,
			trailingComma: false,
			commaSpacing: true,
			colonSpacing: true,
		},
	};
}

function fullDocumentRange(document: vscode.TextDocument, source: string): vscode.Range {
	return new vscode.Range(document.positionAt(0), document.positionAt(source.length));
}