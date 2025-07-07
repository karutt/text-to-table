export { CSVParser } from './csv-parser';
export { MarkdownParser, type ColumnAlignment, type MarkdownParseResult } from './markdown-parser';
export { TSVParser } from './tsv-parser';

import type { DataParser } from '../types';
import { CSVParser } from './csv-parser';
import { MarkdownParser } from './markdown-parser';
import { TSVParser } from './tsv-parser';

/**
 * Supported formats
 */
export type SupportedFormat = 'csv' | 'tsv' | 'markdown';

/**
 * Get appropriate parser based on format
 */
export function getParser(format: SupportedFormat): DataParser {
    switch (format) {
        case 'csv':
            return new CSVParser(',');
        case 'tsv':
            return new TSVParser();
        case 'markdown':
            return new MarkdownParser();
        default:
            throw new Error(`Unsupported format: ${format}`);
    }
}

/**
 * Automatically detect format from text
 */
export function detectFormat(text: string): SupportedFormat {
    const trimmed = text.trim();

    if (!trimmed) {
        return 'csv'; // Default
    }

    // Detect Markdown tables (lines starting and ending with pipe characters)
    const lines = trimmed
        .split('')
        .map(line => line.trim())
        .filter(Boolean);
    const hasMarkdownTable = lines.some(
        line => line.startsWith('|') && line.endsWith('|') && line.length > 2,
    );

    if (hasMarkdownTable) {
        return 'markdown';
    }

    // Detect TSV (contains tab characters)
    if (trimmed.includes('	')) {
        return 'tsv';
    }

    // Default to CSV
    return 'csv';
}
