import type { DataParser, ParseError, ParseOptions, ParseResult } from '../types';
import { ERROR_CODES } from '../types';

export class CSVParser implements DataParser {
    private delimiter: string;

    constructor(delimiter: string = ',') {
        this.delimiter = delimiter;
    }

    parse(text: string, options: ParseOptions = {}): ParseResult {
        const { hasHeader = true, maxRows = 100, maxColumns = 20, trimWhitespace = true } = options;

        if (!text.trim()) {
            return {
                data: [],
                hasHeader: false,
                errors: [{ line: 1, message: 'Data is empty', code: ERROR_CODES.EMPTY_DATA }],
                metadata: {
                    rowCount: 0,
                    columnCount: 0,
                    format: this.delimiter === '\t' ? 'tsv' : 'csv',
                },
            };
        }

        const lines = text.split('\n').filter(line => line.trim());
        const data: string[][] = [];
        const errors: ParseError[] = [];

        for (let i = 0; i < lines.length && i < maxRows; i++) {
            try {
                const row = this.parseLine(lines[i], trimWhitespace);

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

        return {
            data,
            hasHeader,
            errors,
            metadata: {
                rowCount: data.length,
                columnCount: data[0]?.length || 0,
                format: this.delimiter === '	' ? 'tsv' : 'csv',
            },
        };
    }

    validate(text: string): boolean {
        if (!text.trim()) return false;

        const lines = text.split('').filter(line => line.trim());
        return lines.length > 0 && lines.some(line => line.includes(this.delimiter));
    }

    private parseLine(line: string, trimWhitespace: boolean): string[] {
        const cells: string[] = [];
        let current = '';
        let inQuotes = false;
        let i = 0;

        while (i < line.length) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i += 2;
                } else {
                    // Start/End of quote
                    inQuotes = !inQuotes;
                    i++;
                }
            } else if (char === this.delimiter && !inQuotes) {
                // Cell delimiter
                cells.push(trimWhitespace ? current.trim() : current);
                current = '';
                i++;
            } else {
                current += char;
                i++;
            }
        }

        // Add the last cell
        cells.push(trimWhitespace ? current.trim() : current);
        return cells;
    }
}
