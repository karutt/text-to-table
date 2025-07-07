import {
    Badge,
    Box,
    Button,
    Grid,
    HStack,
    InputGroup,
    NumberInput,
    Text,
    VStack,
} from '@chakra-ui/react';
import React, { useCallback, useEffect, useState } from 'react';

interface TableEditorProps {
    isLoading?: boolean;
}

interface TableInfo {
    isPluginTable: boolean;
    metadata?: {
        createdBy: string;
        format: string;
        hasHeader: boolean;
        rowCount: number;
        columnCount: number;
        filename: string | null;
        createdAt: string;
    };
    tableNode?: {
        id: string;
        name: string;
    };
}

interface TableStructure {
    headers: string[];
    indices: string[];
}

export const TableEditor: React.FC<TableEditorProps> = ({ isLoading = false }) => {
    const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
    const [tableStructure, setTableStructure] = useState<TableStructure | null>(null);
    const [selectedColumns, setSelectedColumns] = useState<number[]>([]);
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [tableWidth, setTableWidth] = useState<string>('');
    const [tableHeight, setTableHeight] = useState<string>('');
    const [isSelectingAllCells, setIsSelectingAllCells] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    // Clear UI selection state (maintain Figma selection)
    const clearUISelection = useCallback(() => {
        setSelectedColumns([]);
        setSelectedRows([]);
    }, []);

    // Clear UI selection state on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Clear UI selection when clicking outside buttons or badges
            const target = event.target as HTMLElement;
            if (!target.closest('button') && !target.closest('[data-selection-button]')) {
                clearUISelection();
            }
        };

        const handleBlur = () => {
            // When clicking outside plugin screen
            clearUISelection();
        };

        // Add event listener
        document.addEventListener('click', handleClickOutside);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('click', handleClickOutside);
            window.removeEventListener('blur', handleBlur);
        };
    }, [clearUISelection]);

    // Handle messages from plugin
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const { type, data, error } = event.data.pluginMessage || event.data;

            switch (type) {
                case 'selected-table-info':
                    setTableInfo(data);
                    if (data.isPluginTable && data.tableNode) {
                        // Get table structure
                        parent.postMessage(
                            {
                                pluginMessage: {
                                    type: 'get-table-structure',
                                    data: { nodeId: data.tableNode.id },
                                },
                                pluginId: '*',
                            },
                            '*',
                        );
                    } else {
                        setTableStructure(null);
                    }
                    break;

                case 'table-structure':
                    setTableStructure(data);
                    // Once table structure is obtained, get current size
                    if (tableInfo?.tableNode?.id) {
                        parent.postMessage(
                            {
                                pluginMessage: {
                                    type: 'get-table-size',
                                    data: { nodeId: tableInfo.tableNode.id },
                                },
                                pluginId: '*',
                            },
                            '*',
                        );
                    }
                    break;

                case 'table-size': {
                    const width = Math.round(data.width);
                    const height = Math.round(data.height);
                    setTableWidth(width.toString());
                    setTableHeight(height.toString());
                    break;
                }

                case 'column-selected':
                    if (data.isMultiSelect) {
                        setSelectedColumns(data.columnIndices || []);
                    } else {
                        setSelectedColumns([data.columnIndex]);
                    }
                    break;

                case 'row-selected':
                    if (data.isMultiSelect) {
                        setSelectedRows(data.rowIndices || []);
                    } else {
                        setSelectedRows([data.rowIndex]);
                    }
                    break;

                case 'mixed-cells-selected':
                    setSelectedColumns(data.columnIndices || []);
                    setSelectedRows(data.rowIndices || []);
                    break;

                case 'all-cells-selected':
                    setIsSelectingAllCells(false);
                    // All selection state already set in handleSelectAllCells
                    break;

                case 'table-resized': {
                    setIsResizing(false);
                    const newWidth = Math.round(data.newWidth);
                    const newHeight = Math.round(data.newHeight);
                    setTableWidth(newWidth.toString());
                    setTableHeight(newHeight.toString());
                    break;
                }

                case 'error':
                    console.error('Plugin error:', error);
                    setIsSelectingAllCells(false);
                    setIsResizing(false);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [tableInfo?.tableNode?.id]);

    // Get selection info (initial only, then auto-updated via selectionchange event)
    useEffect(() => {
        const getTableInfo = () => {
            parent.postMessage(
                {
                    pluginMessage: {
                        type: 'get-selected-table-info',
                    },
                    pluginId: '*',
                },
                '*',
            );
        };

        // Initial fetch only (auto-updated by plugin's selectionchange event)
        getTableInfo();
    }, []);

    const handleColumnClick = useCallback(
        (columnIndex: number, event: React.MouseEvent) => {
            if (!tableInfo?.tableNode) return;

            // Stop event propagation
            event.stopPropagation();

            const isMultiSelect = event.metaKey || event.ctrlKey;

            if (isMultiSelect) {
                // Multi-select: Can select across rows and columns
                let newColumnSelection = [...selectedColumns];

                if (newColumnSelection.includes(columnIndex)) {
                    // Remove if already selected
                    newColumnSelection = newColumnSelection.filter(idx => idx !== columnIndex);
                } else {
                    // Add to selection
                    newColumnSelection.push(columnIndex);
                }

                // Unified message for cross-row and column selection
                parent.postMessage(
                    {
                        pluginMessage: {
                            type: 'select-mixed-cells',
                            data: {
                                nodeId: tableInfo.tableNode.id,
                                columnIndices: newColumnSelection,
                                rowIndices: selectedRows,
                            },
                        },
                        pluginId: '*',
                    },
                    '*',
                );
            } else {
                // Single selection: columns only, clear row selection
                setSelectedRows([]);

                parent.postMessage(
                    {
                        pluginMessage: {
                            type: 'select-table-column',
                            data: {
                                nodeId: tableInfo.tableNode.id,
                                columnIndex,
                                isMultiSelect: false,
                                currentSelection: [],
                            },
                        },
                        pluginId: '*',
                    },
                    '*',
                );
            }
        },
        [tableInfo, selectedColumns, selectedRows],
    );

    const handleRowClick = useCallback(
        (rowIndex: number, event: React.MouseEvent) => {
            if (!tableInfo?.tableNode) return;

            // Stop event propagation
            event.stopPropagation();

            const isMultiSelect = event.metaKey || event.ctrlKey;

            if (isMultiSelect) {
                // Multi-select: Can select across rows and columns
                let newRowSelection = [...selectedRows];

                if (newRowSelection.includes(rowIndex)) {
                    // Remove if already selected
                    newRowSelection = newRowSelection.filter(idx => idx !== rowIndex);
                } else {
                    // Add to selection
                    newRowSelection.push(rowIndex);
                }

                // Unified message for cross-row and column selection
                parent.postMessage(
                    {
                        pluginMessage: {
                            type: 'select-mixed-cells',
                            data: {
                                nodeId: tableInfo.tableNode.id,
                                columnIndices: selectedColumns,
                                rowIndices: newRowSelection,
                            },
                        },
                        pluginId: '*',
                    },
                    '*',
                );
            } else {
                // Single selection: rows only, clear column selection
                setSelectedColumns([]);

                parent.postMessage(
                    {
                        pluginMessage: {
                            type: 'select-table-row',
                            data: {
                                nodeId: tableInfo.tableNode.id,
                                rowIndex,
                                isMultiSelect: false,
                                currentSelection: [],
                            },
                        },
                        pluginId: '*',
                    },
                    '*',
                );
            }
        },
        [tableInfo, selectedRows, selectedColumns],
    );

    const handleSelectAllCells = useCallback(() => {
        if (!tableInfo?.tableNode || isSelectingAllCells || !tableStructure) return;

        setIsSelectingAllCells(true);

        // Update UI state: select all rows and columns
        const allColumnIndices = tableStructure.headers.map((_, index) => index);
        const allRowIndices = tableStructure.indices.map((_, index) => index);
        setSelectedColumns(allColumnIndices);
        setSelectedRows(allRowIndices);

        parent.postMessage(
            {
                pluginMessage: {
                    type: 'select-all-table-cells',
                    data: {
                        nodeId: tableInfo.tableNode.id,
                    },
                },
                pluginId: '*',
            },
            '*',
        );
    }, [tableInfo, isSelectingAllCells, tableStructure]);

    const handleSelectAllText = useCallback(() => {
        if (!tableInfo?.tableNode) return;

        parent.postMessage(
            {
                pluginMessage: {
                    type: 'select-all-table-text',
                    data: {
                        nodeId: tableInfo.tableNode.id,
                    },
                },
                pluginId: '*',
            },
            '*',
        );
    }, [tableInfo]);

    const handleSelectOddColumns = useCallback(() => {
        if (!tableInfo?.tableNode || !tableStructure) return;

        // Calculate odd column indices (0-based)
        const oddColumnIndices = tableStructure.headers
            .map((_, index) => index)
            .filter(index => (index + 1) % 2 === 1); // 1-based で奇数

        // UI状態をUpdate
        setSelectedColumns(oddColumnIndices);
        setSelectedRows([]); // Clear row selection

        parent.postMessage(
            {
                pluginMessage: {
                    type: 'select-odd-columns',
                    data: {
                        nodeId: tableInfo.tableNode.id,
                    },
                },
                pluginId: '*',
            },
            '*',
        );
    }, [tableInfo, tableStructure]);

    const handleSelectEvenColumns = useCallback(() => {
        if (!tableInfo?.tableNode || !tableStructure) return;

        // Calculate even column indices (0-based)
        const evenColumnIndices = tableStructure.headers
            .map((_, index) => index)
            .filter(index => (index + 1) % 2 === 0); // 1-based で偶数

        // UI状態をUpdate
        setSelectedColumns(evenColumnIndices);
        setSelectedRows([]); // Clear row selection

        parent.postMessage(
            {
                pluginMessage: {
                    type: 'select-even-columns',
                    data: {
                        nodeId: tableInfo.tableNode.id,
                    },
                },
                pluginId: '*',
            },
            '*',
        );
    }, [tableInfo, tableStructure]);

    const handleSelectOddRows = useCallback(() => {
        if (!tableInfo?.tableNode || !tableStructure) return;

        // Calculate odd row indices (0-based)
        const oddRowIndices = tableStructure.indices
            .map((_, index) => index)
            .filter(index => (index + 1) % 2 === 1); // 1-based で奇数

        // UI状態をUpdate
        setSelectedRows(oddRowIndices);
        setSelectedColumns([]); // Clear column selection

        parent.postMessage(
            {
                pluginMessage: {
                    type: 'select-odd-rows',
                    data: {
                        nodeId: tableInfo.tableNode.id,
                    },
                },
                pluginId: '*',
            },
            '*',
        );
    }, [tableInfo, tableStructure]);

    const handleSelectEvenRows = useCallback(() => {
        if (!tableInfo?.tableNode || !tableStructure) return;

        // Calculate even row indices (0-based)
        const evenRowIndices = tableStructure.indices
            .map((_, index) => index)
            .filter(index => (index + 1) % 2 === 0); // 1-based で偶数

        // UI状態をUpdate
        setSelectedRows(evenRowIndices);
        setSelectedColumns([]); // Clear column selection

        parent.postMessage(
            {
                pluginMessage: {
                    type: 'select-even-rows',
                    data: {
                        nodeId: tableInfo.tableNode.id,
                    },
                },
                pluginId: '*',
            },
            '*',
        );
    }, [tableInfo, tableStructure]);

    const handleResizeTable = useCallback(() => {
        if (!tableInfo?.tableNode || isResizing) return;

        const width = parseFloat(tableWidth);
        const height = parseFloat(tableHeight);

        if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
            alert('Please enter valid positive numbers for width and height.');
            return;
        }

        setIsResizing(true);
        parent.postMessage(
            {
                pluginMessage: {
                    type: 'resize-table',
                    data: {
                        nodeId: tableInfo.tableNode.id,
                        width,
                        height,
                    },
                },
                pluginId: '*',
            },
            '*',
        );
    }, [tableInfo, tableWidth, tableHeight, isResizing]);

    const handleFormSubmit = useCallback(
        (event: React.FormEvent) => {
            event.preventDefault();
            handleResizeTable();
        },
        [handleResizeTable],
    );

    if (!tableInfo?.isPluginTable) {
        return (
            <Box p={4} textAlign="center">
                <Text color="fg.muted" fontSize="sm">
                    No table created by this plugin is selected.
                    <br />
                    Please select a table created with Text to Table plugin.
                </Text>
            </Box>
        );
    }

    if (!tableStructure) {
        return (
            <Box p={4} textAlign="center">
                <Text color="fg.muted" fontSize="sm">
                    Loading table structure...
                </Text>
            </Box>
        );
    }

    return (
        <Box py={4}>
            <VStack align="stretch" gap={4}>
                {/* Table Size Controls */}
                <Box borderRadius="md">
                    <Text mb={3} color="fg" fontSize="sm" fontWeight="medium">
                        Table Size
                    </Text>

                    <form onSubmit={handleFormSubmit}>
                        <VStack align="stretch" gap={3}>
                            <HStack gap={2}>
                                <Box flex={1}>
                                    <NumberInput.Root
                                        disabled={isLoading || isResizing}
                                        min={1}
                                        onValueChange={(details: { value: string }) =>
                                            setTableWidth(details.value)
                                        }
                                        size="sm"
                                        value={tableWidth}
                                    >
                                        <InputGroup endElement="px" startElement="W">
                                            <NumberInput.Input placeholder="Enter width" />
                                        </InputGroup>
                                    </NumberInput.Root>
                                </Box>
                                <Box flex={1}>
                                    <NumberInput.Root
                                        disabled={isLoading || isResizing}
                                        min={1}
                                        onValueChange={(details: { value: string }) =>
                                            setTableHeight(details.value)
                                        }
                                        size="sm"
                                        value={tableHeight}
                                    >
                                        <InputGroup endElement="px" startElement="H">
                                            <NumberInput.Input placeholder="Enter height" />
                                        </InputGroup>
                                    </NumberInput.Root>
                                </Box>
                            </HStack>

                            <Button
                                colorPalette="blue"
                                disabled={isLoading || isResizing || !tableWidth || !tableHeight}
                                onClick={handleResizeTable}
                                size="sm"
                                type="submit"
                                variant="solid"
                            >
                                Apply Size
                            </Button>
                        </VStack>
                    </form>
                </Box>
                {/* Columns */}
                <Box>
                    <HStack align="center" justify="space-between" mb={2}>
                        <VStack align="start" gap={0}>
                            <Text color="fg" fontSize="sm" fontWeight="medium">
                                Columns
                            </Text>
                            <Text color="fg.muted" fontSize="xs">
                                Hold Ctrl to select multiple
                            </Text>
                        </VStack>
                        <HStack gap={1}>
                            <Badge
                                as="button"
                                opacity={isLoading || isSelectingAllCells ? 0.5 : 1}
                                _hover={
                                    isLoading || isSelectingAllCells
                                        ? {}
                                        : { bg: 'green.emphasized' }
                                }
                                cursor={
                                    isLoading || isSelectingAllCells ? 'not-allowed' : 'pointer'
                                }
                                colorPalette="green"
                                data-selection-button
                                onClick={
                                    isLoading || isSelectingAllCells
                                        ? undefined
                                        : handleSelectAllCells
                                }
                                size="sm"
                                variant="outline"
                            >
                                All
                            </Badge>
                            <Badge
                                as="button"
                                opacity={isLoading ? 0.5 : 1}
                                _hover={isLoading ? {} : { bg: 'orange.emphasized' }}
                                cursor={isLoading ? 'not-allowed' : 'pointer'}
                                colorPalette="orange"
                                data-selection-button
                                onClick={isLoading ? undefined : handleSelectAllText}
                                size="sm"
                                variant="outline"
                            >
                                Text
                            </Badge>
                            <Badge
                                as="button"
                                opacity={isLoading ? 0.5 : 1}
                                _hover={isLoading ? {} : { bg: 'blue.emphasized' }}
                                cursor={isLoading ? 'not-allowed' : 'pointer'}
                                colorPalette="blue"
                                data-selection-button
                                onClick={isLoading ? undefined : handleSelectOddColumns}
                                size="sm"
                                variant="outline"
                            >
                                Odd
                            </Badge>
                            <Badge
                                as="button"
                                opacity={isLoading ? 0.5 : 1}
                                _hover={isLoading ? {} : { bg: 'purple.emphasized' }}
                                cursor={isLoading ? 'not-allowed' : 'pointer'}
                                colorPalette="purple"
                                data-selection-button
                                onClick={isLoading ? undefined : handleSelectEvenColumns}
                                size="sm"
                                variant="outline"
                            >
                                Even
                            </Badge>
                        </HStack>
                    </HStack>
                    <Grid gap={1} templateColumns="repeat(auto-fit, minmax(120px, 1fr))">
                        {tableStructure.headers.map((header, index) => {
                            const isSelected = selectedColumns.includes(index);
                            return (
                                <Button
                                    key={index}
                                    justifyContent="flex-start"
                                    h="auto"
                                    p={2}
                                    textAlign="left"
                                    bg={isSelected ? 'blue.600' : undefined}
                                    _hover={
                                        isSelected ? { bg: 'blue.600' } : { bg: 'bg.emphasized' }
                                    }
                                    transition="all 0s"
                                    colorPalette={isSelected ? 'blue' : 'gray'}
                                    data-selection-button
                                    disabled={isLoading}
                                    onClick={event => handleColumnClick(index, event)}
                                    size="sm"
                                    variant={isSelected ? 'solid' : 'outline'}
                                >
                                    <Text
                                        color={isSelected ? 'white' : 'inherit'}
                                        fontSize="xs"
                                        truncate
                                    >
                                        {index + 1}. {header || `Column ${index + 1}`}
                                    </Text>
                                </Button>
                            );
                        })}
                    </Grid>
                </Box>

                {/* Rows */}
                <Box>
                    <HStack align="center" justify="space-between" mb={2}>
                        <VStack align="start" gap={0}>
                            <Text color="fg" fontSize="sm" fontWeight="medium">
                                Rows
                            </Text>
                            <Text color="fg.muted" fontSize="xs">
                                Hold Ctrl to select multiple
                            </Text>
                        </VStack>
                        <HStack gap={1}>
                            <Badge
                                as="button"
                                opacity={isLoading || isSelectingAllCells ? 0.5 : 1}
                                _hover={
                                    isLoading || isSelectingAllCells
                                        ? {}
                                        : { bg: 'green.emphasized' }
                                }
                                cursor={
                                    isLoading || isSelectingAllCells ? 'not-allowed' : 'pointer'
                                }
                                colorPalette="green"
                                data-selection-button
                                onClick={
                                    isLoading || isSelectingAllCells
                                        ? undefined
                                        : handleSelectAllCells
                                }
                                size="sm"
                                variant="outline"
                            >
                                All
                            </Badge>
                            <Badge
                                as="button"
                                opacity={isLoading ? 0.5 : 1}
                                _hover={isLoading ? {} : { bg: 'orange.emphasized' }}
                                cursor={isLoading ? 'not-allowed' : 'pointer'}
                                colorPalette="orange"
                                data-selection-button
                                onClick={isLoading ? undefined : handleSelectAllText}
                                size="sm"
                                variant="outline"
                            >
                                Text
                            </Badge>
                            <Badge
                                as="button"
                                opacity={isLoading ? 0.5 : 1}
                                _hover={isLoading ? {} : { bg: 'blue.emphasized' }}
                                cursor={isLoading ? 'not-allowed' : 'pointer'}
                                colorPalette="blue"
                                data-selection-button
                                onClick={isLoading ? undefined : handleSelectOddRows}
                                size="sm"
                                variant="outline"
                            >
                                Odd
                            </Badge>
                            <Badge
                                as="button"
                                opacity={isLoading ? 0.5 : 1}
                                _hover={isLoading ? {} : { bg: 'purple.emphasized' }}
                                cursor={isLoading ? 'not-allowed' : 'pointer'}
                                colorPalette="purple"
                                data-selection-button
                                onClick={isLoading ? undefined : handleSelectEvenRows}
                                size="sm"
                                variant="outline"
                            >
                                Even
                            </Badge>
                        </HStack>
                    </HStack>
                    <VStack align="stretch" gap={1} overflow="auto" maxH="300px">
                        {tableStructure.indices.map((index, rowIndex) => {
                            const isSelected = selectedRows.includes(rowIndex);
                            return (
                                <Button
                                    key={rowIndex}
                                    justifyContent="flex-start"
                                    w="full"
                                    textAlign="left"
                                    bg={isSelected ? 'blue.600' : undefined}
                                    _hover={
                                        isSelected ? { bg: 'blue.600' } : { bg: 'bg.emphasized' }
                                    }
                                    transition="all 0s"
                                    colorPalette={isSelected ? 'blue' : 'gray'}
                                    data-selection-button
                                    disabled={isLoading}
                                    onClick={event => handleRowClick(rowIndex, event)}
                                    size="sm"
                                    variant={isSelected ? 'solid' : 'outline'}
                                >
                                    <Text
                                        color={isSelected ? 'white' : 'inherit'}
                                        fontSize="xs"
                                        truncate
                                    >
                                        {rowIndex + 1}. {index || `Row ${rowIndex + 1}`}
                                    </Text>
                                </Button>
                            );
                        })}
                    </VStack>
                </Box>
            </VStack>
        </Box>
    );
};
