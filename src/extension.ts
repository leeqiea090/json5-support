'use strict';

import * as vscode from 'vscode';
import { JsonDiagnosticsProvider } from './json/jsonDiagnostics';
import { JsonFormattingProvider } from './json/jsonFormatting';

export function activate(context: vscode.ExtensionContext) {
	const jsonDiagnosticsProvider = new JsonDiagnosticsProvider();
	const jsonFormattingProvider = new JsonFormattingProvider();

	context.subscriptions.push(
		jsonDiagnosticsProvider,
		vscode.languages.registerDocumentFormattingEditProvider({ language: 'json5' }, jsonFormattingProvider)
	);
}
