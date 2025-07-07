import { Badge, Box, HStack, Text, Textarea } from '@chakra-ui/react';
import React, { useEffect, useRef } from 'react';
import { LuDownload } from 'react-icons/lu';

import type { SupportedFormat } from '../../parsers';

// Sample data for each format
const getSampleData = (format: SupportedFormat): string => {
    switch (format) {
        case 'csv':
            return `Name,Age,City,Country
John Doe,28,New York,USA
Jane Smith,32,London,UK
Mike Johnson,25,Tokyo,Japan
Sarah Wilson,29,Paris,France`;

        case 'tsv':
            return `Name	Age	City	Country
John Doe	28	New York	USA
Jane Smith	32	London	UK
Mike Johnson	25	Tokyo	Japan
Sarah Wilson	29	Paris	France`;

        case 'markdown':
            return `| Name | Age | City | Country |
|------|-----|------|---------|
| John Doe | 28 | New York | USA |
| Jane Smith | 32 | London | UK |
| Mike Johnson | 25 | Tokyo | Japan |
| Sarah Wilson | 29 | Paris | France |`;

        default:
            return '';
    }
};

// Function to analyze table structure from text content
function analyzeTableStructure(
    text: string,
    format: SupportedFormat,
): { rows: number; columns: number } {
    if (!text.trim()) return { rows: 0, columns: 0 };

    const lines = text
        .trim()
        .split('\n')
        .filter(line => line.trim().length > 0);
    if (lines.length === 0) return { rows: 0, columns: 0 };

    switch (format) {
        case 'markdown': {
            // Filter out markdown table separator lines (|---|---|)
            const dataLines = lines.filter(line => {
                const trimmed = line.trim();
                return !/^\s*\|[\s\-:|]+\|\s*$/.test(trimmed);
            });

            // Only count lines that look like table rows
            const tableRows = dataLines.filter(line => {
                const trimmed = line.trim();
                return trimmed.startsWith('|') && trimmed.endsWith('|');
            });

            if (tableRows.length === 0) return { rows: 0, columns: 0 };

            // Calculate columns from the first row
            const firstRow = tableRows[0].trim();
            const columns = Math.max(0, (firstRow.match(/\|/g) || []).length - 1);

            return { rows: tableRows.length, columns };
        }

        case 'tsv': {
            const rows = lines.length;
            if (rows === 0) return { rows: 0, columns: 0 };

            // Calculate columns from the first line
            const columns = (lines[0].match(/\t/g) || []).length + 1;
            return { rows, columns };
        }

        case 'csv':
        default: {
            const rows = lines.length;
            if (rows === 0) return { rows: 0, columns: 0 };

            // For CSV, parse the first line considering quoted fields
            const firstLine = lines[0];
            let columns = 1;
            let inQuotes = false;

            for (let i = 0; i < firstLine.length; i++) {
                const char = firstLine[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    columns++;
                }
            }

            return { rows, columns };
        }
    }
}

interface TextInputProps {
    value: string;
    onChange: (value: string) => void;
    format: SupportedFormat;
    placeholder?: string;
    disabled?: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({
    value,
    onChange,
    format,
    placeholder,
    disabled = false,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
        }
    }, [value]);

    const { rows, columns } = analyzeTableStructure(value, format);

    const handleLoadSample = () => {
        const sampleData = getSampleData(format);
        onChange(sampleData);
    };

    return (
        <Box>
            <HStack align="center" justify="space-between" mb={3}>
                <Text fontSize="md" fontWeight="semibold">
                    Input Data
                </Text>
                <Badge
                    as="button"
                    p={1}
                    px={2}
                    opacity={disabled ? 0.5 : 0.6}
                    _hover={disabled ? {} : { bg: 'gray.emphasized' }}
                    _disabled={{ cursor: 'not-allowed', opacity: 0.5 }}
                    cursor={disabled ? 'not-allowed' : 'pointer'}
                    colorPalette="gray"
                    onClick={disabled ? undefined : handleLoadSample}
                    size="sm"
                    variant="outline"
                >
                    Load Sample Data <LuDownload />
                </Badge>
            </HStack>

            <Box pos="relative">
                <Textarea
                    ref={textareaRef}
                    minH="160px"
                    maxH="160px"
                    fontSize="sm"
                    resize="none"
                    disabled={disabled}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={e => {
                        // ctrl/cmd + a: force select all
                        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
                            e.preventDefault();
                            textareaRef.current?.select();
                            return;
                        }
                        // ctrl/cmd + z: force undo
                        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                            e.preventDefault();
                            document.execCommand('undo');
                            return;
                        }
                        // Prevent propagation to Figma main app
                        e.stopPropagation();
                    }}
                    placeholder={placeholder}
                    value={value}
                />
            </Box>

            {/* Table Stats */}
            <HStack justify="space-between" mt={2} color="gray.600" fontSize="sm">
                <Text>{rows === 0 ? 'No data' : `${rows} row${rows !== 1 ? 's' : ''}`}</Text>
                <Text>{columns === 0 ? '' : `${columns} column${columns !== 1 ? 's' : ''}`}</Text>
            </HStack>
        </Box>
    );
};
