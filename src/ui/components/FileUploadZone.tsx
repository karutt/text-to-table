import {
    Button,
    FileUpload,
    Flex,
    Icon,
    Text,
    useFileUploadContext,
    VStack,
} from '@chakra-ui/react';
import React, { useCallback } from 'react';
import { LuFileText, LuTrash2, LuUpload } from 'react-icons/lu';

import { toaster } from '../../components/ui/toaster-instance';
import type { SupportedFormat } from '../../parsers';

interface FileUploadZoneProps {
    onFileContent: (content: string, format: SupportedFormat, filename: string) => void;
    onFilesChange?: (files: File[]) => void;
    uploadedFileNames?: string[];
    disabled?: boolean;
    showActionButton?: boolean;
    onActionButtonClick?: () => void;
    actionButtonText?: string;
    actionButtonLoading?: boolean;
    actionButtonLoadingText?: string;
}

const ACCEPTED_FILE_TYPES = {
    'text/csv': ['.csv'],
    'text/tab-separated-values': ['.tsv'],
    'text/plain': ['.txt', '.md'],
    'text/markdown': ['.md'],
};

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

// Custom FileUpload List component that shows only uploaded files without duplicates
const CustomFileUploadList = ({ uploadedFileNames }: { uploadedFileNames: string[] }) => {
    const fileUpload = useFileUploadContext();

    // Create a unique list that only shows files that are in our uploaded state
    // This prevents duplicate previews and ensures UI consistency
    const uniqueUploadedFiles = uploadedFileNames.reduce((acc: File[], fileName) => {
        const file = fileUpload.acceptedFiles.find(f => f.name === fileName);
        if (file && !acc.some(f => f.name === fileName)) {
            acc.push(file);
        }
        return acc;
    }, []);

    if (uniqueUploadedFiles.length === 0) return null;

    return (
        <FileUpload.ItemGroup gap={2.5}>
            {uniqueUploadedFiles.map(file => (
                <FileUpload.Item
                    key={`uploaded-${file.name}`}
                    file={file}
                    _hover={{ bg: 'bg.subtle' }}
                    py={2}
                >
                    <FileUpload.ItemPreview />
                    <FileUpload.ItemName />
                    <FileUpload.ItemSizeText mr="auto" />
                    <FileUpload.ItemDeleteTrigger />
                </FileUpload.Item>
            ))}
            {uniqueUploadedFiles.length > 0 && (
                <FileUpload.ClearTrigger asChild>
                    <Text
                        alignItems="center"
                        justifyContent="flex-end"
                        gap={1}
                        display="flex"
                        w="100%"
                        mt={2}
                        pr={1}
                        color="red.500"
                        fontSize="sm"
                        _hover={{ textDecoration: 'underline' }}
                        cursor="pointer"
                    >
                        <LuTrash2 />
                        Clear all files
                    </Text>
                </FileUpload.ClearTrigger>
            )}
        </FileUpload.ItemGroup>
    );
};

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
    onFileContent,
    onFilesChange,
    uploadedFileNames = [],
    disabled = false,
    showActionButton = false,
    onActionButtonClick,
    actionButtonText = 'Create Table',
    actionButtonLoading = false,
    actionButtonLoadingText = 'Creating...',
}) => {
    const detectFormatFromContent = useCallback((text: string): SupportedFormat => {
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
                );
            }).length >= 2; // At least 2 rows that look like markdown table

        if (hasMarkdownTableSeparator || hasMarkdownTableRows) return 'markdown';

        // Analyze first few lines for TSV vs CSV
        const sampleLines = lines.slice(0, Math.min(3, lines.length));
        let totalTabCount = 0;
        let totalCommaCount = 0;
        let linesWithTabs = 0;
        let linesWithCommas = 0;

        sampleLines.forEach(line => {
            const tabCount = (line.match(/\t/g) || []).length;
            const commaCount = (line.match(/,/g) || []).length;

            totalTabCount += tabCount;
            totalCommaCount += commaCount;

            if (tabCount > 0) linesWithTabs++;
            if (commaCount > 0) linesWithCommas++;
        });

        // If majority of lines have tabs and tabs outnumber commas significantly, it's TSV
        if (
            linesWithTabs >= linesWithCommas &&
            totalTabCount > 0 &&
            totalTabCount >= totalCommaCount
        ) {
            return 'tsv';
        }

        // Default to CSV
        return 'csv';
    }, []);

    const detectFormat = useCallback(
        (filename: string, content?: string): SupportedFormat => {
            const extension = filename.toLowerCase().split('.').pop();

            // For files with specific extensions, trust the extension
            switch (extension) {
                case 'csv':
                    return 'csv';
                case 'tsv':
                    return 'tsv';
                case 'md':
                case 'markdown':
                    return 'markdown';
                default:
                    // For .txt files or unknown extensions, analyze content if available
                    if (content) {
                        return detectFormatFromContent(content);
                    }
                    // Fallback to CSV if no content analysis possible
                    return 'csv';
            }
        },
        [detectFormatFromContent],
    );

    const handleFileAccept = useCallback(
        async (details: { files: File[] }) => {
            // Process all uploaded files
            for (const file of details.files) {
                const isDuplicate = uploadedFileNames.includes(file.name);

                try {
                    const content = await file.text();
                    const format = detectFormat(file.name, content);
                    onFileContent(content, format, file.name);

                    // Show appropriate notification
                    if (isDuplicate) {
                        toaster.create({
                            title: 'File Updated',
                            description: `${file.name} has been updated`,
                            type: 'info',
                            duration: 2000,
                        });
                    } else {
                        toaster.create({
                            title: 'File Uploaded',
                            description: `${file.name} has been loaded (${format.toUpperCase()} format detected)`,
                            type: 'success',
                            duration: 2000,
                        });
                    }
                } catch (error) {
                    console.error('Error reading file:', error);
                    toaster.create({
                        title: 'Error',
                        description: `There was an error reading the file: ${file.name}`,
                        type: 'error',
                        duration: 3000,
                    });
                }
            }
        },
        [onFileContent, detectFormat, uploadedFileNames],
    );

    const handleFileReject = useCallback(
        (
            details: Parameters<
                NonNullable<React.ComponentProps<typeof FileUpload.Root>['onFileReject']>
            >[0],
        ) => {
            const rejection = details.files?.[0];
            const file = rejection?.file;
            console.warn('File rejected:', file?.name, 'Size:', file?.size);
            toaster.create({
                title: 'File Rejected',
                description: `The file ${file?.name || 'selected file'} is too large or of an unsupported type.`,
                type: 'error',
                duration: 3000,
            });
        },
        [],
    );

    const handleFileChange = useCallback(
        (
            details: Parameters<
                NonNullable<React.ComponentProps<typeof FileUpload.Root>['onFileChange']>
            >[0],
        ) => {
            // Filter accepted files to only include those that are currently uploaded
            const validFiles = details.acceptedFiles.filter(file =>
                uploadedFileNames.includes(file.name),
            );

            // Notify parent component about valid file changes only
            onFilesChange?.(validFiles);
        },
        [onFilesChange, uploadedFileNames],
    );

    return (
        <FileUpload.Root
            accept={ACCEPTED_FILE_TYPES}
            maxFiles={50}
            maxFileSize={MAX_FILE_SIZE}
            onFileAccept={handleFileAccept}
            onFileReject={handleFileReject}
            onFileChange={handleFileChange}
            disabled={disabled}
            cursor="pointer"
            w="100%"
        >
            <FileUpload.HiddenInput />
            <FileUpload.Dropzone w="100%">
                <VStack gap={3} py={8}>
                    <Icon color="fg.muted" size="lg">
                        <LuUpload />
                    </Icon>
                    <VStack gap={1}>
                        <Text color="fg" fontWeight="medium">
                            Drop your files here, or click to browse
                        </Text>
                        <Text color="fg.muted" fontSize="sm" textAlign="center">
                            Supports CSV, TSV, and Markdown files <br /> (up to 1MB each, max 50
                            files)
                        </Text>
                    </VStack>
                    <Flex align="center" gap={2} color="fg.muted" fontSize="sm">
                        <LuFileText />
                        <Text>.csv, .tsv, .md, .txt</Text>
                    </Flex>
                </VStack>
            </FileUpload.Dropzone>

            {/* Action Button - appears between dropzone and file list */}
            {showActionButton && (
                <Button
                    w="full"
                    mt={4}
                    colorPalette="blue"
                    disabled={disabled || actionButtonLoading || uploadedFileNames.length === 0}
                    loading={actionButtonLoading}
                    loadingText={actionButtonLoadingText}
                    onClick={onActionButtonClick}
                    size="lg"
                >
                    {actionButtonText}
                </Button>
            )}

            <CustomFileUploadList uploadedFileNames={uploadedFileNames} />
        </FileUpload.Root>
    );
};
