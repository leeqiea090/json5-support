import { Formatting, JsonParseError, JsonParser, SourceLocation } from '@croct/json5-parser';

export interface Json5ValidationError {
	readonly message: string;
	readonly location: SourceLocation;
}

export function collectJson5ValidationErrors(source: string, maxErrors = 100): Json5ValidationError[] {
	if (!source.trim()) {
		return [];
	}

	const errors: Json5ValidationError[] = [];
	const seenErrors = new Set<string>();
	let workingSource = source;

	for (let attempt = 0; attempt < maxErrors; attempt++) {
		const error = parseError(workingSource);

		if (!error) {
			break;
		}

		const key = `${error.location.start.index}:${error.location.end.index}:${error.message}`;

		if (seenErrors.has(key)) {
			break;
		}

		seenErrors.add(key);

		if (!hasOverlappingError(errors, error.location)) {
			errors.push({
				message: error.message,
				location: error.location,
			});
		}

		const healedSource = healParseError(workingSource, error);

		if (healedSource === workingSource) {
			break;
		}

		workingSource = healedSource;
	}

	return errors;
}

export function formatJson5(source: string, formatting: Formatting): string {
	const root = JsonParser.parse(source);
	root.reset();
	return root.toString(formatting);
}

function parseError(source: string): JsonParseError | null {
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

function healParseError(source: string, error: JsonParseError): string {
	const { start, end } = getRange(source, error.location);

	if (start >= source.length) {
		return source;
	}

	if (error.message.startsWith('Invalid string at ') || error.message.startsWith("Reserved identifier '")) {
		return replaceWithQuotedPlaceholder(source, start, end);
	}

	if (error.message.startsWith('Expected COMMA')) {
		const insertionIndex = findInsertionWhitespaceBefore(source, start);

		if (insertionIndex !== -1) {
			return replaceCharacter(source, insertionIndex, ',');
		}

		return replaceWithSpaces(source, start, end);
	}

	if (error.message.startsWith('Expected COLON')) {
		const insertionIndex = findInsertionWhitespaceBefore(source, start);

		if (insertionIndex !== -1) {
			return replaceCharacter(source, insertionIndex, ':');
		}

		return neutralizeUnexpectedSegment(source, start, end);
	}

	if (error.message.startsWith('Expected either STRING or IDENTIFIER')
		|| error.message.startsWith('Expected STRING')
		|| error.message.startsWith('Expected IDENTIFIER')) {
		if (source[start] === ',') {
			return replaceWithSpaces(source, start, end);
		}

		return replaceWithQuotedPlaceholder(source, start, end);
	}

	if (error.message.startsWith('Unexpected token')) {
		return neutralizeUnexpectedSegment(source, start, end);
	}

	return replaceWithSpaces(source, start, end);
}

function neutralizeUnexpectedSegment(source: string, start: number, end: number): string {
	const segment = expandUnexpectedSegment(source, start, end);

	switch (segment.strategy) {
		case 'quoted':
			return replaceWithQuotedPlaceholder(source, segment.start, segment.end);
		case 'value':
			return replaceWithValuePlaceholder(source, segment.start, segment.end);
		default:
			return replaceWithSpaces(source, segment.start, segment.end);
	}
}

function expandUnexpectedSegment(source: string, start: number, end: number): RecoverySegment {
	const currentEnd = end > start ? end : Math.min(source.length, start + 1);
	const token = source.slice(start, currentEnd);
	const firstCharacter = source[start] ?? '';

	if (token.startsWith('"') || token.startsWith("'")) {
		return {
			start,
			end: findSegmentEnd(source, start),
			strategy: 'quoted',
		};
	}

	if (token === '/' || firstCharacter === '/') {
		return {
			start,
			end: findSegmentEnd(source, start),
			strategy: 'quoted',
		};
	}

	if (token.length > 0 && /^[A-Za-z0-9+-.]/.test(token[0])) {
		return {
			start,
			end: currentEnd,
			strategy: 'value',
		};
	}

	if (/^[A-Za-z0-9+-.]$/.test(firstCharacter)) {
		return {
			start,
			end: findSegmentEnd(source, start),
			strategy: 'value',
		};
	}

	return {
		start,
		end: currentEnd,
		strategy: 'space',
	};
}

function findSegmentEnd(source: string, start: number): number {
	let index = start;

	while (index < source.length) {
		const character = source[index];

		if (character === ',' || character === '}' || character === ']' || character === '\n' || character === '\r') {
			break;
		}

		index++;
	}

	return index > start ? index : Math.min(source.length, start + 1);
}

function findInsertionWhitespaceBefore(source: string, index: number): number {
	for (let cursor = index - 1; cursor >= 0; cursor--) {
		const character = source[cursor];

		if (!isWhitespace(character)) {
			break;
		}

		if (character !== '\n' && character !== '\r') {
			return cursor;
		}
	}

	return -1;
}

function replaceWithQuotedPlaceholder(source: string, start: number, end: number): string {
	const length = end - start;

	if (length < 2) {
		return replaceWithValuePlaceholder(source, start, end);
	}

	return replaceRange(source, start, end, `"${' '.repeat(length - 2)}"`);
}

function replaceWithValuePlaceholder(source: string, start: number, end: number): string {
	const length = Math.max(1, end - start);
	const token = length >= 4 ? 'null' : '0';
	return replaceRange(source, start, end, token.padEnd(length, ' '));
}

function replaceWithSpaces(source: string, start: number, end: number): string {
	const original = source.slice(start, end);
	const replacement = original.replace(/[^\r\n]/g, ' ');
	return replaceRange(source, start, end, replacement);
}

function replaceCharacter(source: string, index: number, value: string): string {
	return source.slice(0, index) + value + source.slice(index + 1);
}

function replaceRange(source: string, start: number, end: number, replacement: string): string {
	return source.slice(0, start) + replacement + source.slice(end);
}

function hasOverlappingError(errors: readonly Json5ValidationError[], location: SourceLocation): boolean {
	return errors.some(error => rangesOverlap(error.location, location));
}

function rangesOverlap(left: SourceLocation, right: SourceLocation): boolean {
	const leftStart = left.start.index;
	const leftEnd = Math.max(left.end.index, leftStart + 1);
	const rightStart = right.start.index;
	const rightEnd = Math.max(right.end.index, rightStart + 1);

	return leftStart < rightEnd && rightStart < leftEnd;
}

function getRange(source: string, location: SourceLocation): { start: number; end: number } {
	const start = clamp(location.start.index, 0, source.length);
	let end = clamp(location.end.index, 0, source.length);

	if (end <= start && start < source.length) {
		end = start + 1;
	}

	return { start, end };
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function isWhitespace(character: string): boolean {
	return character === ' ' || character === '\t' || character === '\n' || character === '\r';
}

type RecoverySegment = {
	readonly start: number;
	readonly end: number;
	readonly strategy: 'quoted' | 'value' | 'space';
};