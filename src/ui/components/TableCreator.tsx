import { Box, Button, Tabs, VStack } from '@chakra-ui/react';
import React from 'react';

import { FileUploadZone, TableEditor, TextInput } from '.';
import { FormatSelector } from './FormatSelector';

import type { SupportedFormat } from '../../parsers';
import { useTableCreator } from './hooks/useTableCreator';
import type { TableCreatorProps } from './types/TableCreator.types';
import { getPlaceholderText } from './utils/PlaceholderText';

export const TableCreator: React.FC<TableCreatorProps> = props => {
    const { isLoading = false } = props;

    const {
        text,
        format,
        uploadedFiles,
        activeTab,
        setText,
        setFormat,
        setActiveTab,
        handleCreate,
        handleCreateMultiple,
        handleCreateFromUpload,
        handleFileUploaded,
        handleFilesRemoved,
        handleFilesSynced,
    } = useTableCreator(props);

    const hasValidText = text.trim().length > 0 || uploadedFiles.length > 0;

    const handleFileContent = (
        content: string,
        detectedFormat: SupportedFormat,
        filename: string,
    ) => {
        handleFileUploaded({ content, format: detectedFormat, filename });
    };

    const handleFormatChange = (newFormat: SupportedFormat) => {
        setFormat(newFormat);
    };

    const handleFilesChange = (files: File[]) => {
        // Sync with FileUpload component state
        if (files.length === 0) {
            // All files were removed
            handleFilesRemoved();
        } else {
            // Some files might have been removed, sync the state
            const currentFileNames = files.map(file => file.name);
            handleFilesSynced(currentFileNames);
        }
    };

    return (
        <Box maxW="container.lg" mx="auto" p={4}>
            <VStack align="stretch" gap={6}>
                {/* Tab Navigation and Content */}
                <Tabs.Root
                    value={activeTab}
                    onValueChange={e => setActiveTab(e.value as 'upload' | 'manual' | 'editor')}
                >
                    <Tabs.List>
                        <Tabs.Trigger px="1em" value="upload">
                            File Upload
                        </Tabs.Trigger>
                        <Tabs.Trigger px="1em" value="manual">
                            Text Input
                        </Tabs.Trigger>
                        <Tabs.Trigger px="1em" value="editor">
                            Table Selector
                        </Tabs.Trigger>
                    </Tabs.List>

                    <Tabs.Content value="upload">
                        <VStack align="stretch" gap={4} mt={4}>
                            <FileUploadZone
                                onFileContent={handleFileContent}
                                onFilesChange={handleFilesChange}
                                uploadedFileNames={uploadedFiles.map(f => f.filename)}
                                disabled={isLoading}
                                showActionButton={true}
                                onActionButtonClick={handleCreateFromUpload}
                                actionButtonText={
                                    uploadedFiles.length > 1 ? 'Create Tables' : 'Create Table'
                                }
                                actionButtonLoading={isLoading}
                                actionButtonLoadingText={
                                    uploadedFiles.length > 1
                                        ? 'Creating tables...'
                                        : 'Creating table...'
                                }
                            />
                        </VStack>
                    </Tabs.Content>

                    <Tabs.Content value="manual">
                        <VStack align="stretch" gap={6} mt={4}>
                            {/* Format Selector - only shown in manual mode */}
                            <FormatSelector value={format} onChange={handleFormatChange} />
                            <TextInput
                                value={text}
                                onChange={setText}
                                format={format}
                                placeholder={getPlaceholderText(format)}
                                disabled={isLoading}
                            />{' '}
                            {/* Create Table Button for manual input */}
                            {format === 'markdown' ? (
                                <Button
                                    w="full"
                                    colorPalette="blue"
                                    disabled={!hasValidText || isLoading}
                                    loading={isLoading}
                                    loadingText="Creating tables..."
                                    onClick={handleCreateMultiple}
                                    size="lg"
                                >
                                    Create Tables
                                </Button>
                            ) : (
                                <Button
                                    w="full"
                                    colorPalette="blue"
                                    disabled={!hasValidText || isLoading}
                                    loading={isLoading}
                                    loadingText="Creating table..."
                                    onClick={handleCreate}
                                    size="lg"
                                >
                                    Create Table
                                </Button>
                            )}
                        </VStack>
                    </Tabs.Content>

                    <Tabs.Content value="editor">
                        <TableEditor isLoading={isLoading} />
                    </Tabs.Content>
                </Tabs.Root>
            </VStack>
        </Box>
    );
};
