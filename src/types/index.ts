// Common type definitions
export interface ParseResult {
    data: string[][];
    hasHeader: boolean;
    errors: ParseError[];
    metadata: {
        rowCount: number;
        columnCount: number;
        format: 'csv' | 'tsv' | 'markdown';
    };
}

export interface ParseError {
    line: number;
    message: string;
    code: string;
}

export interface ParseOptions {
    hasHeader?: boolean;
    maxRows?: number;
    maxColumns?: number;
    trimWhitespace?: boolean;
}

export interface MarkdownParseResult extends ParseResult {
    alignments: ('left' | 'center' | 'right')[];
}

// Parser interface
export interface DataParser {
    parse(text: string, options?: ParseOptions): ParseResult;
    validate(text: string): boolean;
}

// Figma-related type definitions
export interface TableConfig {
    cellPadding: number;
    borderWidth: number;
    borderColor: RGB;
    headerBackground: RGB;
    fontSize: number;
    fontFamily: string;
    hasHeader: boolean;
}

export interface RGB {
    r: number;
    g: number;
    b: number;
}

// Error code definitions
export const ERROR_CODES = {
    INVALID_FORMAT: 'INVALID_FORMAT',
    EMPTY_DATA: 'EMPTY_DATA',
    TOO_LARGE: 'TOO_LARGE',
    FONT_LOAD_FAILED: 'FONT_LOAD_FAILED',
    NO_TABLE_FOUND: 'NO_TABLE_FOUND',
    ALIGNMENT_MISMATCH: 'ALIGNMENT_MISMATCH',
    COLUMN_LIMIT_EXCEEDED: 'COLUMN_LIMIT_EXCEEDED',
    PARSE_ERROR: 'PARSE_ERROR',
    ROW_PARSE_ERROR: 'ROW_PARSE_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
