import type {
    CreateTableRequest,
    CreateTableResponse,
    CreateTablesRequest,
} from '../figma/controller';
import { TableController } from '../figma/controller';
import { FontManager } from '../figma/font-manager';
import { DEFAULT_TABLE_CONFIG } from '../figma/table-builder';

declare const __DEV__: boolean;
declare const __html__: string;

// Initialize FontManager early in plugin lifecycle
FontManager.initialize(DEFAULT_TABLE_CONFIG).catch(error => {
    console.error('Failed to initialize FontManager:', error);
});

// Plugin UI initialization
if (__DEV__) {
    figma.showUI(`<script>window.location.href = "http://localhost:5173";</script>`, {
        width: 400,
        height: 600,
        themeColors: true,
    });
} else {
    figma.showUI(__html__, {
        width: 400,
        height: 600,
        themeColors: true,
    });
}

// Create table controller instance
const tableController = new TableController(DEFAULT_TABLE_CONFIG);

// Keep track of last selected plugin table
let lastSelectedPluginTable: FrameNode | null = null;

// Flag to prevent selectionchange handling during table editor operations
let isTableEditorSelecting = false;

// Listen to selection change events and notify UI
figma.on('selectionchange', async () => {
    // Skip if table editor is currently processing a selection
    if (isTableEditorSelecting) {
        return;
    }

    // Check current selection to see if there's a plugin table
    const currentTableInfo = tableController.getSelectedTableInfo();

    if (currentTableInfo.isPluginTable && currentTableInfo.tableNode) {
        // Update only when a new plugin table is selected
        lastSelectedPluginTable = currentTableInfo.tableNode;
        handleGetSelectedTableInfo();
    } else if (lastSelectedPluginTable) {
        // Keep the last plugin table even if something else is selected
        // Send the last plugin table info to UI
        try {
            const preservedTableInfo = await tableController.getTableInfoByIdAsync(
                lastSelectedPluginTable.id,
            );
            figma.ui.postMessage({
                type: 'selected-table-info',
                data: preservedTableInfo,
            });
        } catch {
            // If table was deleted, etc.
            lastSelectedPluginTable = null;
            handleGetSelectedTableInfo();
        }
    } else {
        // Initial state or plugin table was deleted
        handleGetSelectedTableInfo();
    }
});

// Listen for messages from the UI
figma.ui.onmessage = async msg => {
    try {
        switch (msg.type) {
            case 'create-table':
                await handleCreateTable(msg.data);
                break;

            case 'create-tables':
                await handleCreateTables(msg.data);
                break;

            case 'create-tables-from-markdown':
                await handleCreateTablesFromMarkdown(msg.data);
                break;

            case 'preview-table':
                await handlePreviewTable(msg.data);
                break;

            case 'update-table':
                await handleUpdateTable(msg.data);
                break;

            case 'get-supported-formats':
                handleGetSupportedFormats();
                break;

            case 'get-current-config':
                handleGetCurrentConfig();
                break;

            case 'get-selected-table-info':
                handleGetSelectedTableInfo();
                break;

            case 'SAVE_TAB':
                handleSaveTab(msg.tab);
                break;

            case 'GET_SAVED_TAB':
                handleGetSavedTab();
                break;

            case 'get-table-structure':
                await handleGetTableStructure(msg.data);
                break;

            case 'get-table-size':
                await handleGetTableSize(msg.data);
                break;

            case 'select-table-column':
                await handleSelectTableColumn(msg.data);
                break;

            case 'select-table-row':
                await handleSelectTableRow(msg.data);
                break;

            case 'select-mixed-cells':
                await handleSelectMixedCells(msg.data);
                break;

            case 'select-all-table-cells':
                await handleSelectAllTableCells(msg.data);
                break;

            case 'select-all-table-text':
                await handleSelectAllTableText(msg.data);
                break;

            case 'select-odd-columns':
                await handleSelectOddColumns(msg.data);
                break;

            case 'select-even-columns':
                await handleSelectEvenColumns(msg.data);
                break;

            case 'select-odd-rows':
                await handleSelectOddRows(msg.data);
                break;

            case 'select-even-rows':
                await handleSelectEvenRows(msg.data);
                break;

            case 'resize-table':
                await handleResizeTable(msg.data);
                break;

            case 'close-plugin':
                figma.closePlugin();
                break;

            default:
                console.warn('Unknown message type:', msg.type);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
    }
};

/**
 * Table creation process
 */
async function handleCreateTable(request: CreateTableRequest): Promise<void> {
    try {
        const response = await tableController.createTable(request);

        figma.ui.postMessage({
            type: 'create-table-response',
            data: response,
        });

        if (response.success) {
            // Notify success
            figma.notify('Table created successfully', { timeout: 2000 });
        } else {
            // Notify error
            const errorMsg = response.errors?.[0] || 'Unknown error occurred';
            figma.notify(`Error: ${errorMsg}`, { error: true });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.notify(`Error: ${errorMessage}`, { error: true });

        figma.ui.postMessage({
            type: 'create-table-response',
            data: {
                success: false,
                errors: [errorMessage],
            } as CreateTableResponse,
        });
    }
}

/**
 * Create multiple tables process
 */
async function handleCreateTables(request: CreateTablesRequest): Promise<void> {
    try {
        const response = await tableController.createTables(request);

        figma.ui.postMessage({
            type: 'create-tables-response',
            data: response,
        });

        if (response.success) {
            // Notify success
            const tableCount = response.tableNodes?.length || 0;
            figma.notify(`${tableCount} tables created in container`, { timeout: 2000 });
        } else {
            // Notify error
            const errorMsg = response.errors?.[0] || 'Unknown error occurred';
            figma.notify(`Error: ${errorMsg}`, { error: true });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
        figma.notify(`Error: ${errorMessage}`, { error: true });
    }
}

/**
 * Create multiple tables from markdown process
 */
async function handleCreateTablesFromMarkdown(request: CreateTableRequest): Promise<void> {
    try {
        const response = await tableController.createTablesFromMarkdown(request);

        figma.ui.postMessage({
            type: 'create-tables-from-markdown-response',
            data: response,
        });

        if (response.success) {
            // Notify success
            const tableCount = response.tableNodes?.length || 0;
            if (tableCount > 1) {
                figma.notify(`${tableCount} tables created from markdown`, { timeout: 2000 });
            } else {
                figma.notify('Table created from markdown', { timeout: 2000 });
            }
        } else {
            // Notify error
            const errorMsg = response.errors?.[0] || 'Unknown error occurred';
            figma.notify(`Error: ${errorMsg}`, { error: true });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
        figma.notify(`Error: ${errorMessage}`, { error: true });
    }
}

/**
 * Table preview process
 */
async function handlePreviewTable(request: CreateTableRequest): Promise<void> {
    try {
        const response = await tableController.previewTable(request);

        figma.ui.postMessage({
            type: 'preview-table-response',
            data: response,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        figma.ui.postMessage({
            type: 'preview-table-response',
            data: {
                success: false,
                errors: [errorMessage],
            } as CreateTableResponse,
        });
    }
}

/**
 * Table update process
 */
async function handleUpdateTable(request: CreateTableRequest): Promise<void> {
    try {
        const response = await tableController.updateSelectedTable(request);

        figma.ui.postMessage({
            type: 'update-table-response',
            data: response,
        });

        if (response.success) {
            figma.notify('Table updated successfully', { timeout: 2000 });
        } else {
            const errorMsg = response.errors?.[0] || 'Unknown error occurred';
            figma.notify(`Error: ${errorMsg}`, { error: true });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.notify(`Error: ${errorMessage}`, { error: true });

        figma.ui.postMessage({
            type: 'update-table-response',
            data: {
                success: false,
                errors: [errorMessage],
            } as CreateTableResponse,
        });
    }
}

/**
 * Get supported formats
 */
function handleGetSupportedFormats(): void {
    // List of supported formats
    const formats = ['csv', 'tsv', 'markdown'] as const;

    figma.ui.postMessage({
        type: 'supported-formats-response',
        data: formats,
    });
}

/**
 * Get current settings
 */
function handleGetCurrentConfig(): void {
    // Return default settings if TableController does not have getConfig method
    const config = DEFAULT_TABLE_CONFIG;

    figma.ui.postMessage({
        type: 'current-config-response',
        data: config,
    });
}

/**
 * Get selected table info process
 */
function handleGetSelectedTableInfo(): void {
    const tableInfo = tableController.getSelectedTableInfo();
    figma.ui.postMessage({
        type: 'selected-table-info',
        data: tableInfo,
    });
}

/**
 * Get table structure process
 */
async function handleGetTableStructure(data: { nodeId: string }): Promise<void> {
    try {
        const node = await figma.getNodeByIdAsync(data.nodeId);
        if (!node || node.type !== 'FRAME') {
            throw new Error('Invalid table node');
        }

        const structure = tableController.getTableStructure(node as FrameNode);
        figma.ui.postMessage({
            type: 'table-structure',
            data: structure,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
    }
}

/**
 * Get table size process
 */
async function handleGetTableSize(data: { nodeId: string }): Promise<void> {
    try {
        const node = await figma.getNodeByIdAsync(data.nodeId);
        if (!node || node.type !== 'FRAME') {
            throw new Error('Invalid table node');
        }

        const size = tableController.getTableSize(node as FrameNode);
        figma.ui.postMessage({
            type: 'table-size',
            data: size,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
    }
}

/**
 * Table column selection process
 */
async function handleSelectTableColumn(data: {
    nodeId: string;
    columnIndex: number;
    isMultiSelect?: boolean;
    currentSelection?: number[];
}): Promise<void> {
    try {
        // Set flag to prevent selectionchange handling
        isTableEditorSelecting = true;

        const node = await figma.getNodeByIdAsync(data.nodeId);
        if (!node || node.type !== 'FRAME') {
            throw new Error('Invalid table node');
        }

        if (data.isMultiSelect && data.currentSelection) {
            // Multi-select case
            let newSelection = [...data.currentSelection];

            if (newSelection.includes(data.columnIndex)) {
                // Remove from selection
                newSelection = newSelection.filter(idx => idx !== data.columnIndex);
            } else {
                // Add to selection
                newSelection.push(data.columnIndex);
            }

            tableController.selectTableColumns(node as FrameNode, newSelection);
            figma.ui.postMessage({
                type: 'column-selected',
                data: { columnIndices: newSelection, isMultiSelect: true },
            });
        } else {
            // Single select case
            tableController.selectTableColumn(node as FrameNode, data.columnIndex);
            figma.ui.postMessage({
                type: 'column-selected',
                data: { columnIndex: data.columnIndex, isMultiSelect: false },
            });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
    } finally {
        // Reset flag after operation
        setTimeout(() => {
            isTableEditorSelecting = false;
        }, 100);
    }
}

/**
 * Table row selection process
 */
async function handleSelectTableRow(data: {
    nodeId: string;
    rowIndex: number;
    isMultiSelect?: boolean;
    currentSelection?: number[];
}): Promise<void> {
    try {
        // Set flag to prevent selectionchange handling
        isTableEditorSelecting = true;

        const node = await figma.getNodeByIdAsync(data.nodeId);
        if (!node || node.type !== 'FRAME') {
            throw new Error('Invalid table node');
        }

        if (data.isMultiSelect && data.currentSelection) {
            // Multi-select case
            let newSelection = [...data.currentSelection];

            if (newSelection.includes(data.rowIndex)) {
                // Remove from selection
                newSelection = newSelection.filter(idx => idx !== data.rowIndex);
            } else {
                // Add to selection
                newSelection.push(data.rowIndex);
            }

            tableController.selectTableRows(node as FrameNode, newSelection);
            figma.ui.postMessage({
                type: 'row-selected',
                data: { rowIndices: newSelection, isMultiSelect: true },
            });
        } else {
            // Single select case
            tableController.selectTableRow(node as FrameNode, data.rowIndex);
            figma.ui.postMessage({
                type: 'row-selected',
                data: { rowIndex: data.rowIndex, isMultiSelect: false },
            });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
    } finally {
        // Reset flag after operation
        setTimeout(() => {
            isTableEditorSelecting = false;
        }, 100);
    }
}

/**
 * Mixed cell selection process
 */
async function handleSelectMixedCells(data: {
    nodeId: string;
    columnIndices?: number[];
    rowIndices?: number[];
}): Promise<void> {
    try {
        // Set flag to prevent selectionchange handling
        isTableEditorSelecting = true;

        const node = await figma.getNodeByIdAsync(data.nodeId);
        if (!node || node.type !== 'FRAME') {
            throw new Error('Invalid table node');
        }

        const selectedCells: SceneNode[] = [];
        const rows = node.children.filter(child => child.type === 'FRAME') as FrameNode[];

        // Column selection
        if (data.columnIndices && data.columnIndices.length > 0) {
            for (const row of rows) {
                const cells = row.children.filter(child => child.type === 'FRAME') as FrameNode[];
                for (const columnIndex of data.columnIndices) {
                    if (cells[columnIndex]) {
                        selectedCells.push(cells[columnIndex]);
                    }
                }
            }
        }

        // Row selection
        if (data.rowIndices && data.rowIndices.length > 0) {
            for (const rowIndex of data.rowIndices) {
                if (rows[rowIndex]) {
                    const cells = rows[rowIndex].children.filter(
                        child => child.type === 'FRAME',
                    ) as FrameNode[];
                    selectedCells.push(...cells);
                }
            }
        }

        if (selectedCells.length > 0) {
            figma.currentPage.selection = selectedCells;
        }

        figma.ui.postMessage({
            type: 'mixed-cells-selected',
            data: {
                success: true,
                columnIndices: data.columnIndices || [],
                rowIndices: data.rowIndices || [],
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
    } finally {
        // Reset flag after operation
        setTimeout(() => {
            isTableEditorSelecting = false;
        }, 100);
    }
}

/**
 * Select all table cells process
 */
async function handleSelectAllTableCells(data: { nodeId: string }): Promise<void> {
    try {
        // Set flag to prevent selectionchange handling
        isTableEditorSelecting = true;

        const node = await figma.getNodeByIdAsync(data.nodeId);
        if (!node || node.type !== 'FRAME') {
            throw new Error('Invalid table node');
        }

        tableController.selectAllTableCells(node as FrameNode);
        figma.ui.postMessage({
            type: 'all-cells-selected',
            data: { success: true },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
    } finally {
        // Reset flag after operation
        setTimeout(() => {
            isTableEditorSelecting = false;
        }, 100);
    }
}

/**
 * Select all table text process
 */
async function handleSelectAllTableText(data: { nodeId: string }): Promise<void> {
    try {
        // Set flag to prevent selectionchange handling
        isTableEditorSelecting = true;

        const node = await figma.getNodeByIdAsync(data.nodeId);
        if (!node || node.type !== 'FRAME') {
            throw new Error('Invalid table node');
        }

        tableController.selectAllTableText(node as FrameNode);
        figma.ui.postMessage({
            type: 'all-text-selected',
            data: { success: true },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
    } finally {
        // Reset flag after operation
        setTimeout(() => {
            isTableEditorSelecting = false;
        }, 100);
    }
}

/**
 * Odd column selection process
 */
async function handleSelectOddColumns(data: { nodeId: string }): Promise<void> {
    try {
        // Set flag to prevent selectionchange handling
        isTableEditorSelecting = true;

        const node = await figma.getNodeByIdAsync(data.nodeId);
        if (!node || node.type !== 'FRAME') {
            throw new Error('Invalid table node');
        }

        tableController.selectOddColumns(node as FrameNode);
        figma.ui.postMessage({
            type: 'odd-columns-selected',
            data: { success: true },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
    } finally {
        // Reset flag after operation
        setTimeout(() => {
            isTableEditorSelecting = false;
        }, 100);
    }
}

/**
 * Even column selection process
 */
async function handleSelectEvenColumns(data: { nodeId: string }): Promise<void> {
    try {
        // Set flag to prevent selectionchange handling
        isTableEditorSelecting = true;

        const node = await figma.getNodeByIdAsync(data.nodeId);
        if (!node || node.type !== 'FRAME') {
            throw new Error('Invalid table node');
        }

        tableController.selectEvenColumns(node as FrameNode);
        figma.ui.postMessage({
            type: 'even-columns-selected',
            data: { success: true },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
    } finally {
        // Reset flag after operation
        setTimeout(() => {
            isTableEditorSelecting = false;
        }, 100);
    }
}

/**
 * Select odd rows process
 */
async function handleSelectOddRows(data: { nodeId: string }): Promise<void> {
    try {
        // Set flag to prevent selectionchange handling
        isTableEditorSelecting = true;

        const node = await figma.getNodeByIdAsync(data.nodeId);
        if (!node || node.type !== 'FRAME') {
            throw new Error('Invalid table node');
        }

        tableController.selectOddRows(node as FrameNode);
        figma.ui.postMessage({
            type: 'odd-rows-selected',
            data: { success: true },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
    } finally {
        // Reset flag after operation
        setTimeout(() => {
            isTableEditorSelecting = false;
        }, 100);
    }
}

/**
 * Select even rows process
 */
async function handleSelectEvenRows(data: { nodeId: string }): Promise<void> {
    try {
        // Set flag to prevent selectionchange handling
        isTableEditorSelecting = true;

        const node = await figma.getNodeByIdAsync(data.nodeId);
        if (!node || node.type !== 'FRAME') {
            throw new Error('Invalid table node');
        }

        tableController.selectEvenRows(node as FrameNode);
        figma.ui.postMessage({
            type: 'even-rows-selected',
            data: { success: true },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
    } finally {
        // Reset flag after operation
        setTimeout(() => {
            isTableEditorSelecting = false;
        }, 100);
    }
}

/**
 * Table resize process
 */
async function handleResizeTable(data: {
    nodeId: string;
    width?: number;
    height?: number;
}): Promise<void> {
    try {
        const node = await figma.getNodeByIdAsync(data.nodeId);
        if (!node || node.type !== 'FRAME') {
            throw new Error('Invalid table node');
        }

        await tableController.resizeTable(node as FrameNode, data.width, data.height);
        figma.ui.postMessage({
            type: 'table-resized',
            data: {
                success: true,
                newWidth: (node as FrameNode).width,
                newHeight: (node as FrameNode).height,
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'error',
            error: errorMessage,
        });
    }
}

/**
 * Tab state management
 */
const TAB_DATA_KEY = 'lastActiveTab';

function handleSaveTab(tab: string): void {
    try {
        // Save tab to current document using setPluginData
        figma.currentPage.setPluginData(TAB_DATA_KEY, tab);
    } catch (error) {
        console.error('Failed to save tab:', error);
    }
}

function handleGetSavedTab(): void {
    try {
        // Get saved tab from current document using getPluginData
        const savedTab = figma.currentPage.getPluginData(TAB_DATA_KEY);

        figma.ui.postMessage({
            type: 'SAVED_TAB_LOADED',
            tab: savedTab || 'upload', // Default to 'upload' if no saved tab
        });
    } catch (error) {
        console.error('Failed to get saved tab:', error);
        // Send default tab on error
        figma.ui.postMessage({
            type: 'SAVED_TAB_LOADED',
            tab: 'upload',
        });
    }
}
