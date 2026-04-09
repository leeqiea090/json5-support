import * as vscode from 'vscode';
import {
	JsonArrayNode,
	JsonIdentifierNode,
	JsonObjectNode,
	JsonParser,
	JsonPropertyNode,
	JsonValueNode,
	SourceLocation
} from '@croct/json5-parser';
import * as path from 'path';

interface TreeNodeEntry {
	node: JsonValueNode;
	property?: JsonPropertyNode;
	parentArray?: JsonArrayNode;
	index?: number;
}

export class JsonTreeProvider implements vscode.TreeDataProvider<number> {

	private _onDidChangeTreeData: vscode.EventEmitter<number | undefined> = new vscode.EventEmitter<number | undefined>();
	readonly onDidChangeTreeData: vscode.Event<number | undefined> = this._onDidChangeTreeData.event;

	private tree: JsonValueNode | undefined;
	private text = '';
	private editor: vscode.TextEditor | undefined;
	private autoRefresh = true;
	private readonly nodeMap = new Map<number, TreeNodeEntry>();

	constructor(private context: vscode.ExtensionContext) {
		vscode.window.onDidChangeActiveTextEditor(() => this.onActiveEditorChanged());
		vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e));
		this.parseTree();
		this.autoRefresh = vscode.workspace.getConfiguration('JSON-zain.json5').get('autorefresh', false);
		vscode.workspace.onDidChangeConfiguration(() => {
			this.autoRefresh = vscode.workspace.getConfiguration('JSON-zain.json5').get('autorefresh', false);
		});
		this.onActiveEditorChanged();
	}

	refresh(offset?: number): void {
		this.parseTree();
		if (offset !== undefined) {
			this._onDidChangeTreeData.fire(offset);
		} else {
			this._onDidChangeTreeData.fire(undefined);
		}
	}

	rename(offset: number): void {
		const entry = this.nodeMap.get(offset);
		const property = entry?.property;
		if (!property) {
			return;
		}

		vscode.window.showInputBox({
			placeHolder: 'Enter the new label',
			value: String(property.key.toJSON())
		})
			.then(value => {
				const editor = this.editor;
				if (value !== null && value !== undefined && editor) {
					editor.edit(editBuilder => {
						const range = this.getRange(property.key.location);
						editBuilder.replace(range, this.formatPropertyName(value, property.key));
						setTimeout(() => {
							this.parseTree();
							this.refresh(offset);
						}, 100);
					});
				}
			});
	}

	private onActiveEditorChanged(): void {
		if (vscode.window.activeTextEditor) {
			if (vscode.window.activeTextEditor.document.uri.scheme === 'file') {
				const enabled = vscode.window.activeTextEditor.document.languageId === 'json5';
				vscode.commands.executeCommand('setContext', 'jsonTreeEnabled', enabled);
				// if (enabled) {
				// 	this.refresh();
				// }
			}
		} else {
			vscode.commands.executeCommand('setContext', 'jsonTreeEnabled', false);
		}
		// 切换文件，刷新
		this.refresh();
	}

	private onDocumentChanged(changeEvent: vscode.TextDocumentChangeEvent): void {
		if (this.autoRefresh && changeEvent.document.uri.toString() === this.editor?.document.uri.toString()) {
			this.parseTree();
			this._onDidChangeTreeData.fire(undefined);
		}
	}

	private parseTree(): void {
		this.text = '';
		this.tree = undefined;
		this.editor = vscode.window.activeTextEditor;
		this.nodeMap.clear();
		if (this.editor && this.editor.document) {
			if (this.editor.document.languageId !== 'json5') {
				return;
			}
			this.text = this.editor.document.getText();
			try {
				this.tree = JsonParser.parse(this.text);
				this.indexNode(this.tree);
			} catch {
				this.tree = undefined;
			}
		}
	}

	getChildren(offset?: number): Thenable<number[]> {
		if (offset !== undefined) {
			const node = this.nodeMap.get(offset)?.node;
			return Promise.resolve(node ? this.getChildrenOffsets(node) : []);
		} else {
			return Promise.resolve(this.tree ? this.getChildrenOffsets(this.tree) : []);
		}
	}

	private getChildrenOffsets(node: JsonValueNode): number[] {
		if (node instanceof JsonObjectNode) {
			return node.properties.map(property => property.value.location.start.index);
		}

		if (node instanceof JsonArrayNode) {
			return node.elements.map(child => child.location.start.index);
		}

		return [];
	}

	getTreeItem(offset: number): vscode.TreeItem {
		if (!this.editor) {
			throw new Error('Invalid editor');
		}

		const entry = this.nodeMap.get(offset);
		const valueNode = entry?.node;
		if (valueNode) {
			const hasChildren = valueNode instanceof JsonObjectNode || valueNode instanceof JsonArrayNode;
			const collapsibleState = hasChildren
				? valueNode instanceof JsonObjectNode
					? vscode.TreeItemCollapsibleState.Expanded
					: vscode.TreeItemCollapsibleState.Collapsed
				: vscode.TreeItemCollapsibleState.None;
			const treeItem: vscode.TreeItem = new vscode.TreeItem(this.getLabel(valueNode), collapsibleState);
			treeItem.command = {
				command: 'extension.openJsonSelection',
				title: '',
				arguments: [this.getRange(valueNode.location)]
			};
			treeItem.iconPath = this.getIcon(valueNode);
			treeItem.contextValue = entry?.property ? 'renameable' : 'value';
			return treeItem;
		}
		throw (new Error(`Could not find json5 node at ${offset}`));
	}

	select(range: vscode.Range) {
		if (this.editor) {
			this.editor.selection = new vscode.Selection(range.start, range.end);
			// 编辑窗跳转到指定范围
			this.editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
		}
	}

	private getIcon(node: JsonValueNode): vscode.ThemeIcon | { light: string; dark: string } | undefined {
		if (this.isBooleanNode(node)) {
			return {
				light: this.context.asAbsolutePath(path.join('resources', 'light', 'boolean.svg')),
				dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'boolean.svg'))
			};
		}
		if (this.isStringNode(node)) {
			return {
				light: this.context.asAbsolutePath(path.join('resources', 'light', 'string.svg')),
				dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'string.svg'))
			};
		}
		if (this.isNumberNode(node)) {
			return {
				light: this.context.asAbsolutePath(path.join('resources', 'light', 'number.svg')),
				dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'number.svg'))
			};
		}
		return undefined;
	}

	private getLabel(node: JsonValueNode): string {
		const entry = this.nodeMap.get(node.location.start.index);
		if (entry?.parentArray) {
			const prefix = entry.index?.toString() ?? '';
			if (node instanceof JsonObjectNode) {
				return `${prefix}: { ${this.getNodeChildrenCount(node)} }`;
			}
			if (node instanceof JsonArrayNode) {
				return `${prefix}: [ ${this.getNodeChildrenCount(node)} ]`;
			}
			return `${prefix}: ${this.getNodeText(node)}`;
		}

		const property = entry?.property ? String(entry.property.key.toJSON()) : '';
		if (node instanceof JsonObjectNode) {
			return `{ ${this.getNodeChildrenCount(node)} } ${property}`.trim();
		}
		if (node instanceof JsonArrayNode) {
			return `[ ${this.getNodeChildrenCount(node)} ] ${property}`.trim();
		}
		return `${property}: ${this.getNodeText(node)}`;
	}

	private getNodeChildrenCount(node: JsonValueNode): string {
		if (node instanceof JsonObjectNode) {
			return String(node.properties.length);
		}

		if (node instanceof JsonArrayNode) {
			return String(node.elements.length);
		}

		return '0';
	}

	private indexNode(node: JsonValueNode, property?: JsonPropertyNode, parentArray?: JsonArrayNode, index?: number): void {
		this.nodeMap.set(node.location.start.index, { node, property, parentArray, index });

		if (node instanceof JsonObjectNode) {
			for (const childProperty of node.properties) {
				this.indexNode(childProperty.value, childProperty);
			}
		}

		if (node instanceof JsonArrayNode) {
			node.elements.forEach((element, elementIndex) => {
				this.indexNode(element, undefined, node, elementIndex);
			});
		}
	}

	private getNodeText(node: JsonValueNode): string {
		if (!this.editor) {
			return node.toString();
		}

		return this.editor.document.getText(this.getRange(node.location));
	}

	private getRange(location: SourceLocation): vscode.Range {
		if (!this.editor) {
			throw new Error('Invalid editor');
		}

		return new vscode.Range(
			this.editor.document.positionAt(location.start.index),
			this.editor.document.positionAt(location.end.index)
		);
	}

	private formatPropertyName(value: string, key: JsonPropertyNode['key']): string {
		if (key instanceof JsonIdentifierNode && this.isValidJson5Identifier(value)) {
			return value;
		}

		return JSON.stringify(value);
	}

	private isValidJson5Identifier(value: string): boolean {
		return /^[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*$/u.test(value);
	}

	private isBooleanNode(node: JsonValueNode): boolean {
		return node.toJSON() === true || node.toJSON() === false;
	}

	private isStringNode(node: JsonValueNode): boolean {
		return typeof node.toJSON() === 'string';
	}

	private isNumberNode(node: JsonValueNode): boolean {
		return typeof node.toJSON() === 'number';
	}
}