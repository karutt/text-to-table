import { useCallback, useEffect, useState } from 'react';
import type { CreateTableRequest, CreateTablesRequest } from '../../../figma/controller';
import type { SupportedFormat } from '../../../parsers';
import type { TableCreatorProps, UploadedFile } from '../types/TableCreator.types';
import { detectFormatFromText } from '../utils/FormatDetector';
import { useToastHelpers } from './useToastHelpers';

export const useTableCreator = ({ onCreateTable, onCreateTables }: TableCreatorProps) => {
    const [text, setText] = useState('');
    const [format, setFormat] = useState<SupportedFormat>('csv');
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [activeTab, setActiveTab] = useState<'upload' | 'manual' | 'editor'>('upload');
    const [autoDetectionTimeout, setAutoDetectionTimeout] = useState<NodeJS.Timeout | null>(null);

    const { showError, showErrors, showSuccess } = useToastHelpers();

    // Load saved tab on initialization
    useEffect(() => {
        const loadSavedTab = async () => {
            try {
                // Request the saved tab from the plugin main thread
                parent.postMessage({ pluginMessage: { type: 'GET_SAVED_TAB' } }, '*');
            } catch (error) {
                console.warn('Failed to load saved tab:', error);
            }
        };

        loadSavedTab();

        // Listen for messages from the plugin main thread
        const handleMessage = (event: MessageEvent) => {
            if (event.data.pluginMessage?.type === 'SAVED_TAB_LOADED') {
                const savedTab = event.data.pluginMessage.tab;
                if (savedTab && ['upload', 'manual', 'editor'].includes(savedTab)) {
                    setActiveTab(savedTab as 'upload' | 'manual' | 'editor');
                }
            }
        };

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    // Save tab when it changes
    const handleSetActiveTab = useCallback((newTab: 'upload' | 'manual' | 'editor') => {
        setActiveTab(newTab);

        try {
            // Send the new tab to the plugin main thread to save it
            parent.postMessage(
                {
                    pluginMessage: {
                        type: 'SAVE_TAB',
                        tab: newTab,
                    },
                },
                '*',
            );
        } catch (error) {
            console.warn('Failed to save tab:', error);
        }
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (autoDetectionTimeout) {
                clearTimeout(autoDetectionTimeout);
            }
        };
    }, [autoDetectionTimeout]);

    const handleCreate = useCallback(async () => {
        // Check active tab to determine which data source to use
        if (activeTab === 'upload' && uploadedFiles.length > 0) {
            // Handle file upload tab - create tables from uploaded files
            if (uploadedFiles.length > 1) {
                // Use the new createTables method for multiple files
                try {
                    const request: CreateTablesRequest = {
                        tables: uploadedFiles.map(file => ({
                            text: file.content,
                            format: file.format,
                            filename: file.filename,
                        })),
                    };

                    const response = await onCreateTables(request);

                    if (response.success) {
                        showSuccess(
                            'Tables Created',
                            `${response.tableNodes?.length || 0} tables created successfully in a container`,
                            4000,
                        );
                        // Note: Don't clear uploaded files here to allow re-use
                    } else {
                        showErrors(response.errors || ['Failed to create tables']);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Creation error';
                    showError(errorMessage);
                }
            } else {
                // Single file upload - use existing method but with filename
                const uploadedFile = uploadedFiles[0];
                try {
                    const request: CreateTableRequest = {
                        text: uploadedFile.content,
                        format: uploadedFile.format,
                        filename: uploadedFile.filename,
                    };

                    const response = await onCreateTable(request);

                    if (response.success) {
                        showSuccess(
                            'Table Created',
                            `Table "${uploadedFile.filename}" created successfully`,
                        );
                        // Note: Don't clear uploaded files here to allow re-use
                    } else {
                        showErrors(response.errors || ['Failed to create table']);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Creation error';
                    showError(errorMessage);
                }
            }
        } else if (activeTab === 'manual') {
            // Handle manual input tab - use text input and format
            if (!text.trim()) {
                showError('Please enter text');
                return;
            }

            try {
                const request: CreateTableRequest = {
                    text,
                    format,
                };

                const response = await onCreateTable(request);

                if (response.success) {
                    showSuccess('Table Created', 'Table created successfully');
                } else {
                    showErrors(response.errors || ['Failed to create table']);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Creation error';
                showError(errorMessage);
            }
        } else {
            // No valid input
            showError('Please upload files or enter text');
        }
    }, [
        activeTab,
        text,
        format,
        onCreateTable,
        onCreateTables,
        uploadedFiles,
        showError,
        showErrors,
        showSuccess,
    ]);

    const handleFilesUploaded = useCallback(
        (files: UploadedFile[]) => {
            setUploadedFiles(files);

            // Auto-detect format if a single file is uploaded and text input is empty
            if (files.length === 1 && !text.trim()) {
                const detectedFormat = detectFormatFromText(files[0].content);
                if (detectedFormat !== format) {
                    // Clear any existing timeout
                    if (autoDetectionTimeout) {
                        clearTimeout(autoDetectionTimeout);
                    }

                    // Set format after a short delay
                    const timeout = setTimeout(() => {
                        setFormat(detectedFormat);
                    }, 300);

                    setAutoDetectionTimeout(timeout);
                }
            }
        },
        [text, format, autoDetectionTimeout],
    );

    const handleFileUploaded = useCallback(
        (file: UploadedFile) => {
            setUploadedFiles(prev => {
                // Check if file with same name already exists
                const existingIndex = prev.findIndex(f => f.filename === file.filename);

                if (existingIndex !== -1) {
                    // Replace existing file
                    const updated = [...prev];
                    updated[existingIndex] = file;
                    return updated;
                } else {
                    // Add new file
                    return [...prev, file];
                }
            });

            // Auto-detect format if it's the first file and text input is empty
            if (uploadedFiles.length === 0 && !text.trim()) {
                const detectedFormat = detectFormatFromText(file.content);
                if (detectedFormat !== format) {
                    // Clear any existing timeout
                    if (autoDetectionTimeout) {
                        clearTimeout(autoDetectionTimeout);
                    }

                    // Set format after a short delay
                    const timeout = setTimeout(() => {
                        setFormat(detectedFormat);
                    }, 300);

                    setAutoDetectionTimeout(timeout);
                }
            }
        },
        [text, format, autoDetectionTimeout, uploadedFiles.length],
    );

    const handleFilesRemoved = useCallback(() => {
        setUploadedFiles([]);
    }, []);

    const handleFilesSynced = useCallback((fileNames: string[]) => {
        // Sync uploaded files with FileUpload component state
        setUploadedFiles(prev =>
            prev.filter(uploadedFile => fileNames.includes(uploadedFile.filename)),
        );
    }, []);

    const handleTextChange = useCallback(
        (newText: string) => {
            setText(newText);

            // Auto-detect format based on text content if no files are uploaded
            if (uploadedFiles.length === 0 && newText.trim()) {
                const detectedFormat = detectFormatFromText(newText);
                if (detectedFormat !== format) {
                    // Clear any existing timeout
                    if (autoDetectionTimeout) {
                        clearTimeout(autoDetectionTimeout);
                    }

                    // Set format after a short delay to avoid rapid changes
                    const timeout = setTimeout(() => {
                        setFormat(detectedFormat);
                    }, 500);

                    setAutoDetectionTimeout(timeout);
                }
            }
        },
        [uploadedFiles.length, format, autoDetectionTimeout],
    );

    return {
        // State
        text,
        format,
        uploadedFiles,
        activeTab,

        // Actions
        setText: handleTextChange,
        setFormat,
        setActiveTab: handleSetActiveTab,
        handleCreate,
        handleFilesUploaded,
        handleFileUploaded,
        handleFilesRemoved,
        handleFilesSynced,
    };
};
