'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { JsonParseError, JsonParser } = require('@croct/json5-parser');

const fixturePath = path.resolve(__dirname, '../docs/invalid-json5-sample.json5');

function replaceOnce(source, from, to) {
	assert.ok(source.includes(from), `Missing replacement target: ${from}`);
	return source.replace(from, to);
}

function parseError(source) {
	try {
		JsonParser.parse(source);
		return null;
	} catch (error) {
		if (error instanceof JsonParseError) {
			return error;
		}

		throw error;
	}
}

const checks = [
	{
		label: '初始样例',
		expectedMessage: 'Expected COMMA, but got NUMBER',
		expectedLine: 4,
		expectedColumn: 15,
		apply: source => source,
	},
	{
		label: '修复错误版本号',
		expectedMessage: "Unexpected token 'tru'",
		expectedLine: 5,
		expectedColumn: 12,
		apply: source => replaceOnce(source, 'version: 1.0.0', 'version: 1.0'),
	},
	{
		label: '修复 tru',
		expectedMessage: 'Expected COMMA, but got NUMBER',
		expectedLine: 6,
		expectedColumn: 10,
		apply: source => replaceOnce(source, 'enabled: tru', 'enabled: true'),
	},
	{
		label: '修复前导零端口',
		expectedMessage: 'Expected COMMA, but got IDENTIFIER',
		expectedLine: 10,
		expectedColumn: 5,
		apply: source => replaceOnce(source, 'port: 08', 'port: 8'),
	},
	{
		label: '补上 database.host 后的逗号',
		expectedMessage: "Unexpected token '\"'",
		expectedLine: 11,
		expectedColumn: 11,
		apply: source => replaceOnce(source, "    host: 'localhost'\n", "    host: 'localhost',\n"),
	},
	{
		label: '修复 user 引号',
		expectedMessage: "Unexpected token '''",
		expectedLine: 12,
		expectedColumn: 15,
		apply: source => replaceOnce(source, '    user: "root\',', "    user: 'root',"),
	},
	{
		label: '修复 password 引号',
		expectedMessage: "Unexpected token ','",
		expectedLine: 13,
		expectedColumn: 12,
		apply: source => replaceOnce(source, "    password: '123456,", "    password: '123456',"),
	},
	{
		label: '补上 retry 值',
		expectedMessage: "Unexpected token '''",
		expectedLine: 18,
		expectedColumn: 5,
		apply: source => replaceOnce(source, '    retry: ,', '    retry: 3,'),
	},
	{
		label: '修复 upload 引号',
		expectedMessage: "Unexpected token ','",
		expectedLine: 20,
		expectedColumn: 5,
		apply: source => replaceOnce(source, "    'upload,", "    'upload',"),
	},
	{
		label: '替换空数组元素',
		expectedMessage: "Unexpected token 'NaNN'",
		expectedLine: 21,
		expectedColumn: 5,
		apply: source => replaceOnce(source, '    ,\n    NaNN,', '    null,\n    NaNN,'),
	},
	{
		label: '修复 NaNN',
		expectedMessage: 'Expected either STRING or IDENTIFIER, but got COMMA',
		expectedLine: 22,
		expectedColumn: 20,
		apply: source => replaceOnce(source, '    NaNN,', '    NaN,'),
	},
	{
		label: '修复双逗号对象',
		expectedMessage: 'Invalid string at 26:11',
		expectedLine: 26,
		expectedColumn: 11,
		apply: source => replaceOnce(source, "    { key: 'value',, },", "    { key: 'value' },"),
	},
	{
		label: '修复 home 路径字符串',
		expectedMessage: "Unexpected token '''",
		expectedLine: 27,
		expectedColumn: 11,
		apply: source => replaceOnce(source, "    home: 'C:\\Users\\test',", "    home: 'C:/Users/test',"),
	},
	{
		label: '修复 temp 路径字符串',
		expectedMessage: "Unexpected token '/'",
		expectedLine: 28,
		expectedColumn: 10,
		apply: source => replaceOnce(source, "    temp: 'D:\\temp\\new\\',", "    temp: 'D:/temp/new/',"),
	},
	{
		label: '修复裸路径值',
		expectedMessage: 'Expected COMMA, but got BRACE_LEFT',
		expectedLine: 36,
		expectedColumn: 5,
		apply: source => replaceOnce(source, '    log: /var/log/app,', "    log: '/var/log/app',"),
	},
	{
		label: '补上 users 项之间的逗号',
		expectedMessage: "Unexpected token 'admin'",
		expectedLine: 39,
		expectedColumn: 13,
		apply: source => replaceOnce(source, '    }\n    {', '    },\n    {'),
	},
	{
		label: '修复 admin 裸标识符',
		expectedMessage: 'Expected COMMA, but got IDENTIFIER',
		expectedLine: 44,
		expectedColumn: 16,
		apply: source => replaceOnce(source, '      role: admin,', "      role: 'admin',"),
	},
	{
		label: '修复非法十六进制',
		expectedMessage: "Unexpected token 'Infinityy'",
		expectedLine: 45,
		expectedColumn: 15,
		apply: source => replaceOnce(source, '    hexValue: 0xZZ,', '    hexValue: 0xFF,'),
	},
	{
		label: '修复 Infinityy',
		expectedMessage: "Unexpected token ':'",
		expectedLine: 46,
		expectedColumn: 14,
		apply: source => replaceOnce(source, '    infinity: Infinityy,', '    infinity: Infinity,'),
	},
	{
		label: '修复双冒号',
		expectedMessage: 'Expected COMMA, but got NUMBER',
		expectedLine: 47,
		expectedColumn: 24,
		apply: source => replaceOnce(source, "    emptyKey:: 'oops',", "    emptyKey: 'oops',"),
	},
	{
		label: '修复 broken-array 缺逗号',
		expectedMessage: 'Expected either STRING or IDENTIFIER, but got COMMA',
		expectedLine: 48,
		expectedColumn: 3,
		apply: source => replaceOnce(source, "    'broken-array': [1 2 3],", "    'broken-array': [1, 2, 3],"),
	},
	{
		label: '补上 misc 结束花括号',
		expectedMessage: "Unexpected token '}'",
		expectedLine: 51,
		expectedColumn: 2,
		apply: source => replaceOnce(source, '  ,\n\n  trailing:', '  },\n\n  trailing:'),
	},
	{
		label: '移除多余结尾花括号',
		apply: source => source.replace(/\}\}\s*$/, '}\n'),
	},
];

let source = fs.readFileSync(fixturePath, 'utf8');

checks.forEach((check, index) => {
	source = check.apply(source);
	const error = parseError(source);

	if (!check.expectedMessage) {
		assert.equal(error, null, `${check.label} 后仍然存在语法错误: ${error?.message}`);
		console.log(`[ok ${index + 1}] ${check.label}: valid`);
		return;
	}

	assert.ok(error, `${check.label} 后应该仍然存在一个语法错误`);
	assert.ok(error.message.includes(check.expectedMessage), `${check.label} 期望错误包含 ${check.expectedMessage}，实际为 ${error.message}`);
	assert.equal(error.location.start.line, check.expectedLine, `${check.label} 的错误行号不符合预期`);
	assert.equal(error.location.start.column, check.expectedColumn, `${check.label} 的错误列号不符合预期`);
	console.log(`[ok ${index + 1}] ${check.label}: ${error.message}`);
});

console.log(`Smoke test passed for ${path.relative(process.cwd(), fixturePath)}.`);