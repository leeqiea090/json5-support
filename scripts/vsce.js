'use strict';

const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);

if (args.length === 0) {
	console.error('Usage: node scripts/vsce.js <vsce args...>');
	process.exit(1);
}

const currentMajorVersion = Number.parseInt(process.versions.node.split('.')[0], 10);
const useFallbackNode = ![20, 22].includes(currentMajorVersion);
const vsceEntry = require.resolve('@vscode/vsce/vsce');

const command = useFallbackNode ? 'npx' : process.execPath;
const commandArgs = useFallbackNode
	? ['-y', '-p', 'node@20', 'node', vsceEntry, ...args]
	: [vsceEntry, ...args];

const result = spawnSync(command, commandArgs, {
	cwd: process.cwd(),
	stdio: 'inherit',
	shell: process.platform === 'win32' && useFallbackNode,
});

if (result.error) {
	console.error(result.error.message);
	process.exit(1);
}

process.exit(result.status ?? 1);