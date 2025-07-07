import type { DataParser, ParseError, ParseOptions, ParseResult } from '../types';
import { ERROR_CODES } from '../types';

export type ColumnAlignment = 'left' | 'center' | 'right';

export interface MarkdownParseResult extends ParseResult {
    alignments?: ColumnAlignment[];
}

/**
 * Markdown table parser
 * Parse Markdown table and convert to Table structure
 * Supports alignment syntax (:---, :---:, ---:)
 */
export class MarkdownParser implements DataParser {
    parse(text: string, options: ParseOptions = {}): MarkdownParseResult {
        const { hasHeader = true, maxRows = 100, maxColumns = 20, trimWhitespace = true } = options;

        if (!text.trim()) {
            return {
                data: [],
                hasHeader: false,
                errors: [{ line: 1, message: 'Data is empty', code: ERROR_CODES.EMPTY_DATA }],
                metadata: { rowCount: 0, columnCount: 0, format: 'markdown' },
            };
        }

        const lines = text
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);
        const data: string[][] = [];
        const errors: ParseError[] = [];
        let alignments: ColumnAlignment[] = [];
        let separatorLineIndex = -1;

        // Find header and separator lines
        if (hasHeader && lines.length >= 2) {
            const potentialSeparator = lines[1];
            if (this.isSeparatorLine(potentialSeparator)) {
                separatorLineIndex = 1;
                alignments = this.parseAlignments(potentialSeparator);
            }
        }

        // Parse table rows
        for (let i = 0; i < lines.length && data.length < maxRows; i++) {
            // Skip separator line
            if (i === separatorLineIndex) {
                continue;
            }

            const line = lines[i];
            if (!this.isTableRow(line)) {
                continue;
            }

            try {
                const row = this.parseTableRow(line, trimWhitespace);

                if (row.length > maxColumns) {
                    errors.push({
                        line: i + 1,
                        message: `Row exceeds the maximum number of columns (${maxColumns})`,
                        code: ERROR_CODES.COLUMN_LIMIT_EXCEEDED,
                    });
                    continue;
                }

                data.push(row);
            } catch (error) {
                errors.push({
                    line: i + 1,
                    message: `ParseError: ${error instanceof Error ? error.message : String(error)}`,
                    code: ERROR_CODES.PARSE_ERROR,
                });
            }
        }

        // Adjust the length of the alignment array to the number of columns in the first row
        if (data.length > 0 && alignments.length > 0) {
            const expectedColumnCount = data[0].length;
            while (alignments.length < expectedColumnCount) {
                alignments.push('left');
            }
            alignments = alignments.slice(0, expectedColumnCount);
        }

        return {
            data,
            hasHeader: hasHeader && separatorLineIndex >= 0,
            errors,
            alignments,
            metadata: {
                rowCount: data.length,
                columnCount: data[0]?.length || 0,
                format: 'markdown',
            },
        };
    }

    validate(text: string): boolean {
        if (!text.trim()) return false;

        const lines = text
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);

        // Check if at least one table row exists
        return lines.some(line => this.isTableRow(line));
    }

    /**
     * Determine if a line is a table row
     */
    private isTableRow(line: string): boolean {
        const trimmed = line.trim();
        return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
    }

    /**
     * Determine if a line is a separator line
     */
    private isSeparatorLine(line: string): boolean {
        const trimmed = line.trim();
        if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
            return false;
        }

        // Remove pipe characters and check each cell
        const cells = trimmed.slice(1, -1).split('|');
        return cells.every(cell => {
            const cellTrimmed = cell.trim();
            return /^:?-+:?$/.test(cellTrimmed);
        });
    }

    /**
     * Extract alignment information from the separator line
     */
    private parseAlignments(separatorLine: string): ColumnAlignment[] {
        const trimmed = separatorLine.trim();
        const cells = trimmed.slice(1, -1).split('|');

        return cells.map(cell => {
            const cellTrimmed = cell.trim();
            if (cellTrimmed.startsWith(':') && cellTrimmed.endsWith(':')) {
                return 'center';
            } else if (cellTrimmed.endsWith(':')) {
                return 'right';
            } else {
                return 'left';
            }
        });
    }

    /**
     * Parse table rows and split into individual cells
     */
    private parseTableRow(line: string, trimWhitespace: boolean): string[] {
        const trimmed = line.trim();

        // Remove leading and trailing pipe characters
        const content = trimmed.slice(1, -1);

        const cells: string[] = [];
        let current = '';
        let i = 0;

        while (i < content.length) {
            const char = content[i];

            if (char === '|') {
                // Cell delimiter
                const cellContent = trimWhitespace ? current.trim() : current;
                cells.push(this.unescapeMarkdown(cellContent));
                current = '';
            } else if (char === '\\' && i + 1 < content.length) {
                // Process escape characters
                const nextChar = content[i + 1];
                if (nextChar === '|' || nextChar === '\\') {
                    current += nextChar;
                    i += 2;
                    continue;
                } else {
                    current += char;
                }
            }
            else {
                current += char;
            }

            i++;
        }

        // Last cell
        const cellContent = trimWhitespace ? current.trim() : current;
        cells.push(this.unescapeMarkdown(cellContent));

        return cells;
    }

    /**
     * Process Markdown escape characters
     */
    private unescapeMarkdown(text: string): string {
        return text.replace(/\\\|/g, '|').replace(/\\\\/g, '\\');
    }
}

