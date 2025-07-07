import type { DataParser, ParseOptions, ParseResult } from '../types';
import { CSVParser } from './csv-parser';

/**
 * TSV (Tab-Separated Values) parser
 * Implemented as a wrapper around the CSV parser, using tabs as the delimiter
 */
export class TSVParser implements DataParser {
    private csvParser: CSVParser;

    constructor() {
        // Initialize the CSV parser with a tab delimiter
        this.csvParser = new CSVParser('\t');
    }


    parse(text: string, options: ParseOptions = {}): ParseResult {
        const result = this.csvParser.parse(text, options);

        // Change metadata format to TSV
        return {
            ...result,
            metadata: {
                ...result.metadata,
                format: 'tsv',
            },
        };
    }

    validate(text: string): boolean {
        if (!text.trim()) return false;

        const lines = text.split('\n').filter(line => line.trim());
        return lines.length > 0 && lines.some(line => line.includes('\t'));
    }
}
