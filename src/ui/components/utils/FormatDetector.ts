import type { SupportedFormat } from '../../../parsers';

/**
 * Detect format from text content
 */
export const detectFormatFromText = (text: string): SupportedFormat => {
    if (!text.trim()) return 'csv';

    const lines = text
        .trim()
        .split('\n')
        .filter(line => line.trim().length > 0);
    if (lines.length === 0) return 'csv';

    // Check for Markdown table format
    const hasMarkdownTableSeparator = lines.some(line => {
        const trimmed = line.trim();
        // Header separator line like |---|---|---| or |:--|:--:|--:|
        return /^\s*\|[\s\-:|]+\|\s*$/.test(trimmed);
    });

    const hasMarkdownTableRows =
        lines.filter(line => {
            const trimmed = line.trim();
            // Table row with multiple | separators (at least 2 columns)
            return (
                trimmed.startsWith('|') &&
                trimmed.endsWith('|') &&
                (trimmed.match(/\|/g) || []).length >= 3
            ); // At least |col1|col2|
        }).length >= 2; // At least 2 rows

    if (hasMarkdownTableSeparator && hasMarkdownTableRows) {
        return 'markdown';
    }

    // Check for TSV (tab-separated values)
    const hasTabs = lines.some(line => line.includes('\t'));
    if (hasTabs) {
        const avgTabsPerLine =
            lines.reduce((sum, line) => sum + (line.match(/\t/g) || []).length, 0) / lines.length;
        if (avgTabsPerLine >= 1) {
            return 'tsv';
        }
    }

    // Check for CSV (comma-separated values)
    const hasCommas = lines.some(line => line.includes(','));
    if (hasCommas) {
        const avgCommasPerLine =
            lines.reduce((sum, line) => sum + (line.match(/,/g) || []).length, 0) / lines.length;
        if (avgCommasPerLine >= 1) {
            return 'csv';
        }
    }

    // Default to CSV
    return 'csv';
};
