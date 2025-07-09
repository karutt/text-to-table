import type { DataParser, ParseError, ParseOptions, ParseResult } from '../types';
import { ERROR_CODES } from '../types';

export type ColumnAlignment = 'left' | 'center' | 'right';

export interface CellFormat {
    text: string;
    isBold?: boolean;
    isItalic?: boolean;
    isLink?: boolean;
    linkUrl?: string;
    isImage?: boolean;
    imageUrl?: string;
    imageAlt?: string;
    isNumeric?: boolean;
    currency?: string;
    unit?: string;
    numericValue?: number;
    // 部分的なフォーマット情報
    segments?: Array<{
        text: string;
        start: number;
        end: number;
        isBold?: boolean;
        isItalic?: boolean;
        isLink?: boolean;
        linkUrl?: string;
    }>;
}

export interface MarkdownParseResult extends ParseResult {
    alignments?: ColumnAlignment[];
    cellFormats?: CellFormat[][];
    multipleTablesData?: Array<{
        data: string[][];
        alignments?: ColumnAlignment[];
        cellFormats?: CellFormat[][];
        hasHeader: boolean;
    }>; // 複数テーブルの情報
}

/**
 * Markdown table parser with enhanced features
 * - Auto table detection from mixed content
 * - Bold/italic text formatting support
 * - Parse Markdown table and convert to Table structure
 * - Supports alignment syntax (:---, :---:, ---:)
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

        // Extract table content from mixed markdown text
        const tableText = this.extractTableFromText(text);

        const lines = tableText
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);
        const data: string[][] = [];
        const cellFormats: CellFormat[][] = [];
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
                const { row, formats } = this.parseTableRowWithFormatting(line, trimWhitespace);

                if (row.length > maxColumns) {
                    errors.push({
                        line: i + 1,
                        message: `Row exceeds the maximum number of columns (${maxColumns})`,
                        code: ERROR_CODES.COLUMN_LIMIT_EXCEEDED,
                    });
                    continue;
                }

                data.push(row);
                cellFormats.push(formats);
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
            cellFormats,
            metadata: {
                rowCount: data.length,
                columnCount: data[0]?.length || 0,
                format: 'markdown',
            },
        };
    }

    /**
     * Parse multiple tables from markdown text
     */
    parseMultipleTables(text: string, options: ParseOptions = {}): MarkdownParseResult {
        const tables = this.extractMultipleTablesFromText(text);

        if (tables.length === 0) {
            return {
                data: [],
                hasHeader: false,
                errors: [{ line: 1, message: 'No tables found', code: ERROR_CODES.EMPTY_DATA }],
                metadata: { rowCount: 0, columnCount: 0, format: 'markdown' },
                multipleTablesData: [],
            };
        }

        // If only one table, use regular parse method
        if (tables.length === 1) {
            const result = this.parse(tables[0].content, options);
            return {
                ...result,
                multipleTablesData: [
                    {
                        data: result.data,
                        alignments: (result as MarkdownParseResult).alignments,
                        cellFormats: (result as MarkdownParseResult).cellFormats,
                        hasHeader: result.hasHeader,
                    },
                ],
            };
        }

        // Parse multiple tables
        const multipleTablesData: Array<{
            data: string[][];
            alignments?: ColumnAlignment[];
            cellFormats?: CellFormat[][];
            hasHeader: boolean;
        }> = [];

        const allErrors: ParseError[] = [];
        let totalRows = 0;
        let maxColumns = 0;

        for (const table of tables) {
            const tableResult = this.parse(table.content, options);

            if (tableResult.data.length > 0) {
                multipleTablesData.push({
                    data: tableResult.data,
                    alignments: (tableResult as MarkdownParseResult).alignments,
                    cellFormats: (tableResult as MarkdownParseResult).cellFormats,
                    hasHeader: tableResult.hasHeader,
                });

                totalRows += tableResult.data.length;
                maxColumns = Math.max(maxColumns, tableResult.data[0]?.length || 0);
            }

            allErrors.push(...tableResult.errors);
        }

        return {
            data: [], // 複数テーブルの場合は空
            hasHeader: false,
            errors: allErrors,
            metadata: {
                rowCount: totalRows,
                columnCount: maxColumns,
                format: 'markdown' as const,
            },
            multipleTablesData,
        };
    }

    /**
     * Extract multiple tables with their titles from markdown text
     */
    private extractMultipleTablesFromText(text: string): Array<{
        content: string;
    }> {
        const lines = text.split('\n');
        const tables: Array<{ content: string }> = [];
        let currentTable: string[] = [];
        let inTable = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // If we're in a table and encounter a non-table line
            if (inTable && !this.isTableRow(trimmedLine) && !this.isSeparatorLine(trimmedLine)) {
                // If it's not just an empty line, end the current table
                if (trimmedLine !== '') {
                    // Save current table
                    if (currentTable.length > 0) {
                        tables.push({
                            content: currentTable.join('\n'),
                        });
                    }
                    currentTable = [];
                    inTable = false;
                } else {
                    // Empty line within table - include it
                    currentTable.push(line);
                }
            }
            // Table row detected
            else if (this.isTableRow(trimmedLine) || this.isSeparatorLine(trimmedLine)) {
                if (!inTable) {
                    inTable = true;
                    currentTable = [];
                }
                currentTable.push(line);
            }
            // Empty line when not in table - skip
            else if (!inTable && trimmedLine === '') {
                continue;
            }
            // Non-table content when not in table - skip
            else if (!inTable) {
                continue;
            }
        }

        // Save last table if exists
        if (inTable && currentTable.length > 0) {
            tables.push({
                content: currentTable.join('\n'),
            });
        }

        return tables;
    }

    /**
     * Extract table content from mixed markdown text
     */
    private extractTableFromText(text: string): string {
        const lines = text.split('\n');
        const tableLines: string[] = [];
        let inTable = false;

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (this.isTableRow(trimmedLine) || this.isSeparatorLine(trimmedLine)) {
                if (!inTable) {
                    inTable = true;
                }
                tableLines.push(line);
            } else if (inTable && trimmedLine === '') {
                // Empty line might be part of table formatting
                tableLines.push(line);
            } else if (inTable) {
                // Non-table line encountered, end table extraction
                break;
            }
        }

        return tableLines.join('\n');
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
     * Parse table rows with formatting support (bold, italic)
     */
    private parseTableRowWithFormatting(
        line: string,
        trimWhitespace: boolean,
    ): { row: string[]; formats: CellFormat[] } {
        const trimmed = line.trim();

        // Remove leading and trailing pipe characters
        const content = trimmed.slice(1, -1);

        const row: string[] = [];
        const formats: CellFormat[] = [];
        let current = '';
        let i = 0;

        while (i < content.length) {
            const char = content[i];

            if (char === '|') {
                // Cell delimiter
                const cellContent = trimWhitespace ? current.trim() : current;
                const { text, format } = this.parseTextFormatting(cellContent);
                row.push(text);
                formats.push(format);
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
            } else {
                current += char;
            }

            i++;
        }

        // Last cell
        const cellContent = trimWhitespace ? current.trim() : current;
        const { text, format } = this.parseTextFormatting(cellContent);
        row.push(text);
        formats.push(format);

        return { row, formats };
    }

    /**
     * Parse text formatting (bold, italic) from markdown
     */
    private parseTextFormatting(text: string): { text: string; format: CellFormat } {
        const unescapedText = this.unescapeMarkdown(text);

        // Check for images first (![alt](url))
        const imageMatch = unescapedText.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (imageMatch) {
            return {
                text: imageMatch[1] || 'Image',
                format: {
                    text: imageMatch[1] || 'Image',
                    isImage: true,
                    imageUrl: imageMatch[2],
                    imageAlt: imageMatch[1],
                },
            };
        }

        // Check for links ([text](url)) - strip markdown from link text
        const linkMatch = unescapedText.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
            let displayText = linkMatch[1];
            // Simply remove any markdown formatting from link text
            displayText = displayText.replace(/\*\*\*([^*]+)\*\*\*/g, '$1'); // bold+italic ***text***
            displayText = displayText.replace(/\*\*([^*]+)\*\*/g, '$1'); // bold **text**
            displayText = displayText.replace(/\*([^*]+)\*/g, '$1'); // italic *text*

            return {
                text: displayText,
                format: {
                    text: displayText,
                    isLink: true,
                    linkUrl: linkMatch[2],
                },
            };
        }

        // Check for bold + italic (***text*** or ___text___)
        const boldItalicMatch =
            unescapedText.match(/^\*\*\*(.*)\*\*\*$/) || unescapedText.match(/^___(.*___)$/);
        if (boldItalicMatch) {
            return {
                text: boldItalicMatch[1],
                format: { text: boldItalicMatch[1], isBold: true, isItalic: true },
            };
        }

        // Check for bold formatting (**text** or __text__)
        const boldMatch =
            unescapedText.match(/^\*\*(.*)\*\*$/) || unescapedText.match(/^__(.*__)$/);
        if (boldMatch) {
            return {
                text: boldMatch[1],
                format: { text: boldMatch[1], isBold: true },
            };
        }

        // Check for italic formatting (*text* or _text_)
        const italicMatch = unescapedText.match(/^\*(.*)\*$/) || unescapedText.match(/^_(.*_)$/);
        if (italicMatch) {
            return {
                text: italicMatch[1],
                format: { text: italicMatch[1], isItalic: true },
            };
        }

        // No formatting - check for numeric values
        const numericFormat = this.parseNumericFormat(unescapedText);
        if (numericFormat) {
            return {
                text: unescapedText,
                format: { text: unescapedText, ...numericFormat },
            };
        }

        // Check for partial formatting within the text
        const partialSegments = this.parsePartialFormatting(unescapedText);
        if (
            partialSegments.length > 1 ||
            (partialSegments.length === 1 &&
                (partialSegments[0].isBold ||
                    partialSegments[0].isItalic ||
                    partialSegments[0].isLink))
        ) {
            // Extract plain text for display
            const plainText = partialSegments.map(seg => seg.text).join('');
            return {
                text: plainText,
                format: {
                    text: plainText,
                    segments: partialSegments,
                },
            };
        }

        return {
            text: unescapedText,
            format: { text: unescapedText },
        };
    }

    /**
     * Parse numeric format from text
     */
    private parseNumericFormat(text: string): Partial<CellFormat> | null {
        const trimmed = text.trim();

        // Currency patterns (¥, $, €, etc.)
        const currencyMatch = trimmed.match(/^(¥|￥|\$|€|£|₹|₩|₽)([0-9,]+(?:\.[0-9]+)?)$/);
        if (currencyMatch) {
            const numericValue = parseFloat(currencyMatch[2].replace(/,/g, ''));
            if (!isNaN(numericValue)) {
                return {
                    isNumeric: true,
                    currency: currencyMatch[1],
                    numericValue,
                };
            }
        }

        // Percentage
        const percentMatch = trimmed.match(/^([0-9,]+(?:\.[0-9]+)?)%$/);
        if (percentMatch) {
            const numericValue = parseFloat(percentMatch[1].replace(/,/g, ''));
            if (!isNaN(numericValue)) {
                return {
                    isNumeric: true,
                    unit: '%',
                    numericValue,
                };
            }
        }

        // Units (個, 台, kg, etc.)
        const unitMatch = trimmed.match(
            /^([0-9,]+(?:\.[0-9]+)?)(個|台|本|枚|件|人|回|kg|g|m|cm|mm|L|ml|時間|分|秒)$/,
        );
        if (unitMatch) {
            const numericValue = parseFloat(unitMatch[1].replace(/,/g, ''));
            if (!isNaN(numericValue)) {
                return {
                    isNumeric: true,
                    unit: unitMatch[2],
                    numericValue,
                };
            }
        }

        // Plain numbers
        const numberMatch = trimmed.match(/^([0-9,]+(?:\.[0-9]+)?)$/);
        if (numberMatch) {
            const numericValue = parseFloat(numberMatch[1].replace(/,/g, ''));
            if (!isNaN(numericValue)) {
                return {
                    isNumeric: true,
                    numericValue,
                };
            }
        }

        return null;
    }

    /**
     * Process Markdown escape characters
     */
    private unescapeMarkdown(text: string): string {
        return text.replace(/\\\|/g, '|').replace(/\\\\/g, '\\');
    }

    /**
     * Parse partial formatting within a cell (e.g., **bold** text)
     */
    private parsePartialFormatting(text: string): Array<{
        text: string;
        start: number;
        end: number;
        isBold?: boolean;
        isItalic?: boolean;
        isLink?: boolean;
        linkUrl?: string;
    }> {
        return this.parsePartialFormattingNew(text);
    }

    /**
     * New implementation for parsing partial formatting
     * This implementation properly handles complex cases like:
     * - Multiple links in one cell: "[GitHub](url) ~94k⭐, [npm](url) 3.2M/week"
     * - Links with formatting: "[**Mantine**](url)"
     * - Mixed text and links: "foo [bar](url) baz"
     */
    private parsePartialFormattingNew(text: string): Array<{
        text: string;
        start: number;
        end: number;
        isBold?: boolean;
        isItalic?: boolean;
        isLink?: boolean;
        linkUrl?: string;
    }> {
        const segments: Array<{
            text: string;
            start: number;
            end: number;
            isBold?: boolean;
            isItalic?: boolean;
            isLink?: boolean;
            linkUrl?: string;
        }> = [];

        // Interface for detected patterns
        interface Pattern {
            type: 'link' | 'bolditalic' | 'bold' | 'italic';
            start: number;
            end: number;
            content: string;
            url?: string;
            isBold?: boolean;
            isItalic?: boolean;
            originalLength: number; // Length including markdown syntax
        }

        const patterns: Pattern[] = [];

        // Find all patterns and their positions
        let match: RegExpExecArray | null; // 1. Find links [text](url) - simply strip any markdown formatting from link text
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        while ((match = linkRegex.exec(text)) !== null) {
            const fullMatch = match[0];
            const linkText = match[1];
            const url = match[2];

            // Simply remove any markdown formatting from link text
            let displayText = linkText;
            displayText = displayText.replace(/\*\*\*([^*]+)\*\*\*/g, '$1'); // bold+italic ***text***
            displayText = displayText.replace(/\*\*([^*]+)\*\*/g, '$1'); // bold **text**
            displayText = displayText.replace(/\*([^*]+)\*/g, '$1'); // italic *text*

            patterns.push({
                type: 'link',
                start: match.index,
                end: match.index + fullMatch.length,
                content: displayText,
                url: url,
                originalLength: fullMatch.length,
            });
        }

        // 2. Find non-link formatting patterns (only in areas not covered by links)
        const isInsideLink = (pos: number): boolean => {
            return patterns.some(p => p.type === 'link' && pos >= p.start && pos < p.end);
        };

        // Bold+italic ***text***
        const boldItalicRegex = /\*\*\*([^*]+)\*\*\*/g;
        while ((match = boldItalicRegex.exec(text)) !== null) {
            if (!isInsideLink(match.index)) {
                patterns.push({
                    type: 'bolditalic',
                    start: match.index,
                    end: match.index + match[0].length,
                    content: match[1],
                    isBold: true,
                    isItalic: true,
                    originalLength: match[0].length,
                });
            }
        }

        // Bold **text**
        const boldRegex = /\*\*([^*]+)\*\*/g;
        while ((match = boldRegex.exec(text)) !== null) {
            if (!isInsideLink(match.index)) {
                // Check if overlaps with bold+italic
                const overlaps = patterns.some(
                    p => p.type === 'bolditalic' && match!.index >= p.start && match!.index < p.end,
                );
                if (!overlaps) {
                    patterns.push({
                        type: 'bold',
                        start: match.index,
                        end: match.index + match[0].length,
                        content: match[1],
                        isBold: true,
                        originalLength: match[0].length,
                    });
                }
            }
        }

        // Italic *text* (single asterisk)
        const italicRegex = /\*([^*]+)\*/g;
        while ((match = italicRegex.exec(text)) !== null) {
            if (!isInsideLink(match.index)) {
                // Check if overlaps with other patterns
                const overlaps = patterns.some(
                    p => match!.index >= p.start && match!.index < p.end,
                );
                if (!overlaps) {
                    patterns.push({
                        type: 'italic',
                        start: match.index,
                        end: match.index + match[0].length,
                        content: match[1],
                        isItalic: true,
                        originalLength: match[0].length,
                    });
                }
            }
        }

        // Sort patterns by start position
        patterns.sort((a, b) => a.start - b.start);

        // Build final segments with correct positions
        let currentInputPos = 0;
        let currentOutputPos = 0;

        for (const pattern of patterns) {
            // Add text before this pattern
            if (pattern.start > currentInputPos) {
                const beforeText = text.slice(currentInputPos, pattern.start);
                if (beforeText) {
                    segments.push({
                        text: beforeText,
                        start: currentOutputPos,
                        end: currentOutputPos + beforeText.length,
                    });
                    currentOutputPos += beforeText.length;
                }
            }

            // Add the pattern segment
            segments.push({
                text: pattern.content,
                start: currentOutputPos,
                end: currentOutputPos + pattern.content.length,
                isLink: pattern.type === 'link',
                linkUrl: pattern.url,
                // Only apply bold/italic for non-link patterns
                isBold: pattern.type !== 'link' ? pattern.isBold : undefined,
                isItalic: pattern.type !== 'link' ? pattern.isItalic : undefined,
            });

            currentOutputPos += pattern.content.length;
            currentInputPos = pattern.end;
        }

        // Add remaining text after last pattern
        if (currentInputPos < text.length) {
            const remainingText = text.slice(currentInputPos);
            if (remainingText) {
                segments.push({
                    text: remainingText,
                    start: currentOutputPos,
                    end: currentOutputPos + remainingText.length,
                });
            }
        }

        // Return segments or plain text if no patterns found
        return segments.length > 0 ? segments : [{ text, start: 0, end: text.length }];
    }
}
