import * as vscode from 'vscode';
import { SourceLocation } from '@croct/json5-parser';
import { Json5ValidationError, collectJson5ValidationErrors } from './jsonValidation';

export class JsonDiagnosticsProvider implements vscode.Disposable {

	private readonly collection = vscode.languages.createDiagnosticCollection('json5');
	private readonly disposables: vscode.Disposable[] = [];

	constructor() {
		this.disposables.push(
			this.collection,
			vscode.workspace.onDidOpenTextDocument(document => this.refresh(document)),
			vscode.workspace.onDidChangeTextDocument(event => this.refresh(event.document)),
			vscode.workspace.onDidCloseTextDocument(document => this.collection.delete(document.uri))
		);

		for (const document of vscode.workspace.textDocuments) {
			this.refresh(document);
		}
	}

	dispose(): void {
		vscode.Disposable.from(...this.disposables).dispose();
	}

	refresh(document: vscode.TextDocument): void {
		if (document.languageId !== 'json5') {
			this.collection.delete(document.uri);
			return;
		}

		const text = document.getText();

		if (!text.trim()) {
			this.collection.set(document.uri, []);
			return;
		}

		const errors = collectJson5ValidationErrors(text);
		this.collection.set(document.uri, errors.map(error => this.createDiagnostic(document, error)));
	}

	private createDiagnostic(document: vscode.TextDocument, error: Json5ValidationError): vscode.Diagnostic {
		const range = this.toRange(document, error.location);
		const diagnostic = new vscode.Diagnostic(range, error.message, vscode.DiagnosticSeverity.Error);
		diagnostic.source = 'json5';
		diagnostic.code = 'syntax';
		return diagnostic;
	}

	private toRange(document: vscode.TextDocument, location: SourceLocation): vscode.Range {
		const startOffset = this.clampOffset(document, location.start.index);
		let endOffset = this.clampOffset(document, location.end.index);

		if (endOffset <= startOffset) {
			endOffset = Math.min(document.getText().length, startOffset + 1);
		}

		return new vscode.Range(
			document.positionAt(startOffset),
			document.positionAt(endOffset)
		);
	}

	private clampOffset(document: vscode.TextDocument, offset: number): number {
		return Math.max(0, Math.min(document.getText().length, offset));
	}
}