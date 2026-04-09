'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { collectJson5ValidationErrors, formatJson5 } = require('../out/json/jsonValidation');

const fixturePath = path.resolve(__dirname, '../docs/invalid-json5-sample.json5');
const fixtureSource = fs.readFileSync(fixturePath, 'utf8');
const errors = collectJson5ValidationErrors(fixtureSource);

assert.ok(errors.length >= 20, `Expected at least 20 diagnostics, got ${errors.length}`);

const expectedErrors = [
	{ line: 4, column: 15, message: 'Expected COMMA, but got NUMBER' },
	{ line: 10, column: 5, message: 'Expected COMMA, but got IDENTIFIER' },
	{ line: 26, column: 11, message: 'Invalid string at 26:11' },
	{ line: 39, column: 13, message: "Unexpected token 'admin'" },
	{ line: 48, column: 3, message: 'Expected either STRING or IDENTIFIER, but got COMMA' },
];

for (const expected of expectedErrors) {
	assert.ok(
		errors.some(error => error.location.start.line === expected.line
			&& error.location.start.column === expected.column
			&& error.message.includes(expected.message)),
		`Missing expected diagnostic at ${expected.line}:${expected.column}`
	);
}

const formatted = formatJson5("{foo:'bar',items:[1,2,{baz:true}],note:'ok'}", {
	indentationCharacter: 'space',
	lineEnding: 'lf',
	array: {
		indentationSize: 2,
		entryIndentation: true,
		leadingIndentation: true,
		trailingIndentation: true,
		trailingComma: false,
		commaSpacing: true,
		colonSpacing: true,
	},
	object: {
		indentationSize: 2,
		entryIndentation: true,
		leadingIndentation: true,
		trailingIndentation: true,
		trailingComma: false,
		commaSpacing: true,
		colonSpacing: true,
	},
});

assert.equal(formatted, `{
  foo: 'bar',
  items: [
    1,
    2,
    {
      baz: true
    }
  ],
  note: 'ok'
}`);

console.log(`Smoke test passed for diagnostics (${errors.length} issues) and formatting.`);