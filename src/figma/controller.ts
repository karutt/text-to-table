import type { MarkdownParseResult, SupportedFormat } from '../parsers';
import { detectFormat, getParser } from '../parsers';
import { MarkdownParser } from '../parsers/markdown-parser';
import type { ParseOptions, ParseResult } from '../types';
import type { TableConfig } from './table-builder';
import { DEFAULT_TABLE_CONFIG, FigmaTableBuilder } from './table-builder';

export interface CreateTableRequest {
    text: string;
    format?: SupportedFormat;
    parseOptions?: ParseOptions;
    tableConfig?: Partial<TableConfig>;
    position?: { x: number; y: number };
    filename?: string; // Filename (used as table node name)
}

export interface CreateTableResponse {
    success: boolean;
    tableNode?: FrameNode;
    parseResult?: ParseResult | MarkdownParseResult;
    errors?: string[];
}

export interface CreateTablesRequest {
    tables: Array<{
        text: string;
        format?: SupportedFormat;
        parseOptions?: ParseOptions;
        filename: string;
    }>;
    tableConfig?: Partial<TableConfig>;
    position?: { x: number; y: number };
}

export interface CreateTablesResponse {
    success: boolean;
    containerNode?: FrameNode;
    tableNodes?: FrameNode[];
    errors?: string[];
}

interface TableMetadata {
    createdBy: string;
    format: SupportedFormat;
    hasHeader: boolean;
    rowCount: number;
    columnCount: number;
    filename: string | null;
    createdAt: string;
}

/**
 * Main controller for table creation
 */
export class TableController {
    private tableBuilder: FigmaTableBuilder;

    constructor(config: TableConfig = DEFAULT_TABLE_CONFIG) {
        this.tableBuilder = new FigmaTableBuilder(config);
    }

    /**
     * Calculate optimal position based on selected nodes or viewport
     * Also returns appropriate parent node
     */
    private calculateOptimalPosition(): {
        x: number;
        y: number;
        parent?: BaseNode & ChildrenMixin;
        isInsideContainer: boolean;
    } {
        const selection = figma.currentPage.selection;

        if (selection.length > 0) {
            // Something is selected
            const selectedNode = selection[0]; // Use first node if multiple are selected

            // Check if selected node is a container that can have children
            if (this.canHaveChildren(selectedNode)) {
                // Place on parent page if nesting is too deep
                const containerDepth = this.getNodeDepth(selectedNode);
                if (containerDepth > 5) {
                    return {
                        x: selectedNode.x + selectedNode.width + 20,
                        y: selectedNode.y,
                        isInsideContainer: false,
                    };
                }

                return {
                    x: 20, // Add some margin
                    y: 20,
                    parent: selectedNode as BaseNode & ChildrenMixin,
                    isInsideContainer: true,
                };
            } else {
                // For INSTANCE or other nodes that can't have children, place to the right
                return {
                    x: selectedNode.x + selectedNode.width + 20, // 20px margin
                    y: selectedNode.y,
                    isInsideContainer: false,
                };
            }
        } else {
            // Nothing selected, place at viewport center
            const center = figma.viewport.center;
            return {
                x: center.x,
                y: center.y,
                isInsideContainer: false,
            };
        }
    }

    /**
     * Calculate node hierarchy depth (counting from root page)
     */
    private getNodeDepth(node: BaseNode): number {
        let depth = 0;
        let currentNode: BaseNode | null = node;

        while (currentNode && currentNode.type !== 'PAGE') {
            depth++;
            currentNode = currentNode.parent;
        }

        return depth;
    }

    /**
     * Check if a node can have children
     */
    private canHaveChildren(node: BaseNode): boolean {
        // List of node types that can have children
        const containerTypes = [
            'FRAME',
            'GROUP',
            'SECTION',
            'COMPONENT',
            'COMPONENT_SET',
            // 'INSTANCE' is excluded (supports appendChild but doesn't actually accept children)
        ];

        return containerTypes.includes(node.type);
    }

    /**
     * Create table from text (optimized version)
     */
    async createTable(request: CreateTableRequest): Promise<CreateTableResponse> {
        try {
            const {
                text,
                format: providedFormat,
                parseOptions = {},
                tableConfig = {},
                position,
                filename,
            } = request;

            // Use format detection or user specification
            const format = providedFormat || detectFormat(text);

            // Get parser and parse text
            const parser = getParser(format);
            const parseResult = parser.parse(text, parseOptions);

            // Stop processing if there are parsing errors
            if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
                return {
                    success: false,
                    parseResult,
                    errors: parseResult.errors.map(e => e.message),
                };
            }

            // Update table settings
            if (Object.keys(tableConfig).length > 0) {
                this.tableBuilder.updateConfig(tableConfig);
            }

            // Get alignment and cell format information for Markdown
            const alignments =
                format === 'markdown' ? (parseResult as MarkdownParseResult).alignments : undefined;
            const cellFormats =
                format === 'markdown'
                    ? (parseResult as MarkdownParseResult).cellFormats
                    : undefined;

            // Debug log for cellFormats
            if (cellFormats) {
                console.log('📋 Cell formats from parser:', {
                    totalRows: cellFormats.length,
                    sample: cellFormats.slice(0, 3).map((row, rowIndex) => ({
                        row: rowIndex,
                        cells: row.map((cell, cellIndex) => ({
                            cell: cellIndex,
                            text: cell.text,
                            isLink: cell.isLink,
                            linkUrl: cell.linkUrl,
                        })),
                    })),
                });
            }

            // Enable progressive rendering for large tables
            const dataSize = parseResult.data.length;
            const columnCount = parseResult.data[0]?.length || 1;
            const totalCells = dataSize * columnCount;

            // Judgment based on cell count or row count (same logic as table-builder.ts)
            const progressiveRendering = totalCells > 200 || dataSize > 50;

            // Dynamically adjust batch size as well
            let batchSize: number;
            if (totalCells > 2000) {
                batchSize = 15;
            } else if (totalCells >= 1000) {
                batchSize = 25;
            } else if (totalCells >= 500) {
                batchSize = 30;
            } else {
                batchSize = 40;
            }

            // Build table
            const tableNode = await this.tableBuilder.buildTable(
                parseResult.data,
                {
                    config: this.tableBuilder.getConfig(),
                    alignments,
                    hasHeader: parseResult.hasHeader,
                    progressiveRendering,
                    batchSize,
                },
                cellFormats,
            );

            // Save plugin data to make table identifiable
            const tableMetadata = {
                createdBy: 'text-to-table-plugin',
                format,
                hasHeader: parseResult.hasHeader,
                rowCount: parseResult.data.length,
                columnCount: parseResult.data[0]?.length || 0,
                filename: filename || null,
                createdAt: new Date().toISOString(),
            };

            tableNode.setPluginData('metadata', JSON.stringify(tableMetadata));

            // If filename is specified, set it as table name
            if (filename) {
                // Remove extension and use as table name
                const tableName = filename.replace(/\.[^/.]+$/, '');
                tableNode.name = `Table(${tableName})`;
            }

            // Set position
            if (tableNode.removed) {
                throw new Error('Table node was removed before it could be positioned');
            }

            if (position) {
                tableNode.x = position.x;
                tableNode.y = position.y;
            } else {
                // Calculate optimal position based on selection state
                const optimalPlacement = this.calculateOptimalPosition();

                // Consider table size to determine final position
                if (optimalPlacement.isInsideContainer && optimalPlacement.parent) {
                    // When placing inside container
                    try {
                        if (tableNode.removed) {
                            throw new Error('Table node has been removed');
                        }

                        tableNode.x = optimalPlacement.x;
                        tableNode.y = optimalPlacement.y;

                        // Directly appendChild to new parent (automatically moved from current parent)
                        optimalPlacement.parent.appendChild(tableNode);
                    } catch {
                        // If appendChild fails, place next to it
                        // Fallback: Place next to selected node
                        const selectedNode = figma.currentPage.selection[0];

                        if (tableNode.removed) {
                            throw new Error(
                                'Table node no longer exists - unable to position table',
                            );
                        }

                        tableNode.x = selectedNode.x + selectedNode.width + 20;
                        tableNode.y = selectedNode.y;

                        // Only add to page if no parent
                        if (!tableNode.parent) {
                            figma.currentPage.appendChild(tableNode);
                        }
                    }
                } else if (figma.currentPage.selection.length === 0) {
                    // If nothing is selected, place at viewport center
                    if (tableNode.removed) {
                        throw new Error('Table node has been removed');
                    }

                    tableNode.x = optimalPlacement.x - tableNode.width / 2;
                    tableNode.y = optimalPlacement.y - tableNode.height / 2;
                } else {
                    // Place next to selected node
                    if (tableNode.removed) {
                        throw new Error('Table node has been removed');
                    }

                    tableNode.x = optimalPlacement.x;
                    tableNode.y = optimalPlacement.y;
                }
            }

            // Add to current page (only if not already added to container)
            if (!tableNode.parent) {
                if (tableNode.removed) {
                    throw new Error('Table node was removed before it could be added to the page');
                }
                figma.currentPage.appendChild(tableNode);
            }

            // Select table without changing viewport
            if (!tableNode.removed) {
                figma.currentPage.selection = [tableNode];
                // Removed: figma.viewport.scrollAndZoomIntoView([tableNode]);
                // This prevents unwanted viewport position and zoom changes
            }

            return {
                success: true,
                tableNode,
                parseResult,
                errors:
                    parseResult.errors.length > 0
                        ? parseResult.errors.map(e => e.message)
                        : undefined,
            };
        } catch (error) {
            let errorMessage = 'Error occurred while creating table';

            if (error instanceof Error) {
                errorMessage = error.message;

                // Special handling for font-related errors
                if (
                    error.message.includes('unloaded font') ||
                    error.message.includes('loadFontAsync')
                ) {
                    errorMessage =
                        'Font loading failed. Please check available fonts and try again.';
                } else if (
                    error.message.includes('Cannot write to node') ||
                    error.message.includes('node')
                ) {
                    errorMessage =
                        'Node operation error. Please ensure you have write permissions and try again.';
                } else if (error.message.includes('memory') || error.message.includes('Memory')) {
                    errorMessage =
                        'Out of memory. Please reduce table size or enable progressive rendering.';
                } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
                    errorMessage = 'Processing timed out. Please reduce table size and try again.';
                }
            }

            return {
                success: false,
                errors: [errorMessage],
            };
        }
    }

    /**
     * Update selected table
     */
    async updateSelectedTable(request: CreateTableRequest): Promise<CreateTableResponse> {
        const selection = figma.currentPage.selection;

        if (selection.length !== 1 || selection[0].type !== 'FRAME') {
            return {
                success: false,
                errors: ['Please select a table (select one Frame)'],
            };
        }

        const selectedFrame = selection[0] as FrameNode;

        // Delete existing table
        selectedFrame.remove();

        // Create new table at the same position
        return this.createTable({
            ...request,
            position: { x: selectedFrame.x, y: selectedFrame.y },
        });
    }

    /**
     * Preview table settings (don't actually create)
     */
    async previewTable(request: CreateTableRequest): Promise<CreateTableResponse> {
        try {
            const { text, format: providedFormat, parseOptions = {} } = request;

            // Format detection and parsing
            const format = providedFormat || detectFormat(text);
            const parser = getParser(format);
            const parseResult = parser.parse(text, parseOptions);

            return {
                success: true,
                parseResult,
                errors:
                    parseResult.errors.length > 0
                        ? parseResult.errors.map(e => e.message)
                        : undefined,
            };
        } catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : String(error)],
            };
        }
    }

    /**
     * Get supported formats
     */
    getSupportedFormats(): SupportedFormat[] {
        return ['csv', 'tsv', 'markdown'];
    }

    /**
     * Get current table settings
     */
    getCurrentConfig(): TableConfig {
        return this.tableBuilder.getConfig();
    }

    /**
     * Update table settings
     */
    updateConfig(config: Partial<TableConfig>): void {
        this.tableBuilder.updateConfig(config);
    }

    /**
     * Create multiple tables and store in container
     */
    async createTables(request: CreateTablesRequest): Promise<CreateTablesResponse> {
        try {
            const { tables, tableConfig = {}, position } = request;

            if (tables.length === 0) {
                return {
                    success: false,
                    errors: ['No table data specified'],
                };
            }

            // Update table settings
            if (Object.keys(tableConfig).length > 0) {
                this.tableBuilder.updateConfig(tableConfig);
            }

            // Create container for multiple tables
            const containerNode = figma.createFrame();
            containerNode.name = 'Tables Container';

            // Set up Auto Layout (horizontal placement)
            containerNode.layoutMode = 'HORIZONTAL';
            containerNode.primaryAxisSizingMode = 'AUTO';
            containerNode.counterAxisSizingMode = 'AUTO';
            containerNode.itemSpacing = 20;
            containerNode.paddingTop = 20;
            containerNode.paddingBottom = 20;
            containerNode.paddingLeft = 20;
            containerNode.paddingRight = 20;

            // Set background
            containerNode.fills = [
                {
                    type: 'SOLID',
                    color: { r: 0.98, g: 0.98, b: 0.98 },
                    opacity: 1,
                },
            ];

            const tableNodes: FrameNode[] = [];
            const errors: string[] = [];

            // Create each table
            for (const tableData of tables) {
                try {
                    const response = await this.createTable({
                        text: tableData.text,
                        format: tableData.format,
                        parseOptions: tableData.parseOptions,
                        tableConfig,
                        filename: tableData.filename,
                    });

                    if (response.success && response.tableNode) {
                        // Add table to container
                        containerNode.appendChild(response.tableNode);
                        tableNodes.push(response.tableNode);
                    } else {
                        errors.push(
                            `${tableData.filename}: ${response.errors?.join(', ') || 'Creation failed'}`,
                        );
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`${tableData.filename}: ${errorMessage}`);
                }
            }

            // If at least one table was created
            if (tableNodes.length > 0) {
                // Set container position
                if (position) {
                    containerNode.x = position.x;
                    containerNode.y = position.y;
                } else {
                    // Calculate optimal position based on selection state
                    const optimalPlacement = this.calculateOptimalPosition();

                    if (optimalPlacement.isInsideContainer && optimalPlacement.parent) {
                        // Try to place in container
                        try {
                            containerNode.x = optimalPlacement.x;
                            containerNode.y = optimalPlacement.y;
                            optimalPlacement.parent.appendChild(containerNode);
                        } catch {
                            // If failed, place next to it
                            const selectedNode = figma.currentPage.selection[0];
                            containerNode.x = selectedNode.x + selectedNode.width + 20;
                            containerNode.y = selectedNode.y;
                            figma.currentPage.appendChild(containerNode);
                        }
                    } else if (figma.currentPage.selection.length === 0) {
                        // Place at viewport center
                        containerNode.x = optimalPlacement.x - containerNode.width / 2;
                        containerNode.y = optimalPlacement.y - containerNode.height / 2;
                        figma.currentPage.appendChild(containerNode);
                    } else {
                        // Place next to selected node
                        containerNode.x = optimalPlacement.x;
                        containerNode.y = optimalPlacement.y;
                        figma.currentPage.appendChild(containerNode);
                    }
                }

                // Add container to page if it doesn't have a parent
                if (!containerNode.parent) {
                    figma.currentPage.appendChild(containerNode);
                }

                // Select container without changing viewport
                figma.currentPage.selection = [containerNode];
                // Removed: figma.viewport.scrollAndZoomIntoView([containerNode]);
                // This prevents unwanted viewport position and zoom changes

                return {
                    success: true,
                    containerNode,
                    tableNodes,
                    errors: errors.length > 0 ? errors : undefined,
                };
            } else {
                // If all table creation failed
                containerNode.remove();
                return {
                    success: false,
                    errors: errors.length > 0 ? errors : ['Failed to create all tables'],
                };
            }
        } catch (error) {
            let errorMessage = 'Error occurred while creating multiple tables';

            if (error instanceof Error) {
                errorMessage = error.message;
            }

            return {
                success: false,
                errors: [errorMessage],
            };
        }
    }

    /**
     * Check if the currently selected node is a table created by the plugin
     */
    getSelectedTableInfo(): {
        isPluginTable: boolean;
        metadata?: TableMetadata;
        tableNode?: FrameNode;
    } {
        const selection = figma.currentPage.selection;

        if (selection.length !== 1 || selection[0].type !== 'FRAME') {
            return { isPluginTable: false };
        }

        const selectedNode = selection[0] as FrameNode;
        const metadataString = selectedNode.getPluginData('metadata');

        if (!metadataString) {
            return { isPluginTable: false };
        }

        try {
            const metadata = JSON.parse(metadataString) as TableMetadata;

            if (metadata.createdBy === 'text-to-table-plugin') {
                return {
                    isPluginTable: true,
                    metadata,
                    tableNode: selectedNode,
                };
            }
        } catch (error) {
            console.error('Failed to parse table metadata:', error);
        }

        return { isPluginTable: false };
    }

    /**
     * Check if the node with the specified ID is a table created by the plugin
     */
    getTableInfoById(nodeId: string): {
        isPluginTable: boolean;
        metadata?: TableMetadata;
        tableNode?: FrameNode;
    } {
        try {
            // Check if node still exists
            const node = figma.getNodeById(nodeId);
            if (!node || node.type !== 'FRAME') {
                return { isPluginTable: false };
            }

            const frameNode = node as FrameNode;
            const metadataString = frameNode.getPluginData('metadata');

            if (!metadataString) {
                return { isPluginTable: false };
            }

            const metadata = JSON.parse(metadataString) as TableMetadata;
            if (metadata.createdBy === 'text-to-table-plugin') {
                return {
                    isPluginTable: true,
                    metadata,
                    tableNode: frameNode,
                };
            }
        } catch {
            // If node was deleted or error occurred
        }

        return { isPluginTable: false };
    }

    /**
     * Check if the node with the specified ID is a table created by the plugin (async version)
     */
    async getTableInfoByIdAsync(nodeId: string): Promise<{
        isPluginTable: boolean;
        metadata?: TableMetadata;
        tableNode?: FrameNode;
    }> {
        try {
            // Check if node still exists
            const node = await figma.getNodeByIdAsync(nodeId);
            if (!node || node.type !== 'FRAME') {
                return { isPluginTable: false };
            }

            const frameNode = node as FrameNode;
            const metadataString = frameNode.getPluginData('metadata');

            if (!metadataString) {
                return { isPluginTable: false };
            }

            const metadata = JSON.parse(metadataString) as TableMetadata;
            if (metadata.createdBy === 'text-to-table-plugin') {
                return {
                    isPluginTable: true,
                    metadata,
                    tableNode: frameNode,
                };
            }
        } catch {
            // If node was deleted or error occurred
        }

        return { isPluginTable: false };
    }

    /**
     * Get table header and index information
     */
    getTableStructure(tableNode: FrameNode): { headers: string[]; indices: string[] } | null {
        const metadataString = tableNode.getPluginData('metadata');
        if (!metadataString) return null;

        try {
            // Parse metadata to check validity, but don't use it
            JSON.parse(metadataString);

            // Get actual cell contents from table child nodes
            const headers: string[] = [];
            const indices: string[] = [];

            // Get first row (header) and first column (index) of table
            const children = tableNode.children;

            // Get header row (first row)
            if (children.length > 0 && children[0].type === 'FRAME') {
                const headerRow = children[0] as FrameNode;
                const headerCells = headerRow.children;

                for (const cell of headerCells) {
                    if (cell.type === 'FRAME') {
                        const textNodes = (cell as FrameNode).findAll(
                            node => node.type === 'TEXT',
                        ) as TextNode[];
                        const text = textNodes
                            .map(node => node.characters)
                            .join(' ')
                            .trim();
                        headers.push(text || `Column ${headers.length + 1}`);
                    }
                }
            }

            // Get index column (first cell of each row)
            for (let i = 0; i < children.length; i++) {
                if (children[i].type === 'FRAME') {
                    const row = children[i] as FrameNode;
                    const firstCell = row.children[0];

                    if (firstCell && firstCell.type === 'FRAME') {
                        const textNodes = (firstCell as FrameNode).findAll(
                            node => node.type === 'TEXT',
                        ) as TextNode[];
                        const text = textNodes
                            .map(node => node.characters)
                            .join(' ')
                            .trim();
                        indices.push(text || `Row ${i + 1}`);
                    }
                }
            }

            return { headers, indices };
        } catch (error) {
            console.error('Failed to get table structure:', error);
            return null;
        }
    }

    /**
     * Select all cells in specified column
     */
    selectTableColumn(tableNode: FrameNode, columnIndex: number): void {
        const selectedCells: SceneNode[] = [];

        const rows = tableNode.children.filter(child => child.type === 'FRAME') as FrameNode[];

        for (const row of rows) {
            const cells = row.children.filter(child => child.type === 'FRAME') as FrameNode[];
            if (cells[columnIndex]) {
                selectedCells.push(cells[columnIndex]);
            }
        }

        if (selectedCells.length > 0) {
            figma.currentPage.selection = selectedCells;
            // Don't move viewport (UX improvement)
        }
    }

    /**
     * Select all cells in specified row
     */
    selectTableRow(tableNode: FrameNode, rowIndex: number): void {
        const rows = tableNode.children.filter(child => child.type === 'FRAME') as FrameNode[];

        if (rows[rowIndex]) {
            const cells = rows[rowIndex].children.filter(
                child => child.type === 'FRAME',
            ) as FrameNode[];

            if (cells.length > 0) {
                figma.currentPage.selection = cells;
                // Don't move viewport (UX improvement)
            }
        }
    }

    /**
     * Select all table cells
     */
    selectAllTableCells(tableNode: FrameNode): void {
        const allCells: SceneNode[] = [];

        const rows = tableNode.children.filter(child => child.type === 'FRAME') as FrameNode[];

        for (const row of rows) {
            const cells = row.children.filter(child => child.type === 'FRAME') as FrameNode[];
            allCells.push(...cells);
        }

        if (allCells.length > 0) {
            figma.currentPage.selection = allCells;
            // Don't move viewport (UX improvement)
        }
    }

    /**
     * Select all text nodes in table
     */
    selectAllTableText(tableNode: FrameNode): void {
        const allTextNodes: SceneNode[] = [];

        const rows = tableNode.children.filter(child => child.type === 'FRAME') as FrameNode[];

        for (const row of rows) {
            const cells = row.children.filter(child => child.type === 'FRAME') as FrameNode[];
            for (const cell of cells) {
                const textNodes = (cell as FrameNode).findAll(
                    node => node.type === 'TEXT',
                ) as TextNode[];
                allTextNodes.push(...textNodes);
            }
        }

        if (allTextNodes.length > 0) {
            figma.currentPage.selection = allTextNodes;
            // Don't move viewport (UX improvement)
        }
    }

    /**
     * Select odd-numbered columns
     */
    selectOddColumns(tableNode: FrameNode): void {
        const selectedCells: SceneNode[] = [];
        const rows = tableNode.children.filter(child => child.type === 'FRAME') as FrameNode[];

        for (const row of rows) {
            const cells = row.children.filter(child => child.type === 'FRAME') as FrameNode[];
            for (let i = 0; i < cells.length; i += 2) {
                // 0, 2, 4... (1st, 3rd, 5th...)
                selectedCells.push(cells[i]);
            }
        }

        if (selectedCells.length > 0) {
            figma.currentPage.selection = selectedCells;
        }
    }

    /**
     * Select even-numbered columns
     */
    selectEvenColumns(tableNode: FrameNode): void {
        const selectedCells: SceneNode[] = [];
        const rows = tableNode.children.filter(child => child.type === 'FRAME') as FrameNode[];

        for (const row of rows) {
            const cells = row.children.filter(child => child.type === 'FRAME') as FrameNode[];
            for (let i = 1; i < cells.length; i += 2) {
                // 1, 3, 5... (2nd, 4th, 6th...)
                selectedCells.push(cells[i]);
            }
        }

        if (selectedCells.length > 0) {
            figma.currentPage.selection = selectedCells;
        }
    }

    /**
     * Select odd-numbered rows
     */
    selectOddRows(tableNode: FrameNode): void {
        const selectedCells: SceneNode[] = [];
        const rows = tableNode.children.filter(child => child.type === 'FRAME') as FrameNode[];

        for (let i = 0; i < rows.length; i += 2) {
            // 0, 2, 4... (1st, 3rd, 5th...)
            const cells = rows[i].children.filter(child => child.type === 'FRAME') as FrameNode[];
            selectedCells.push(...cells);
        }

        if (selectedCells.length > 0) {
            figma.currentPage.selection = selectedCells;
        }
    }

    /**
     * Select even-numbered rows
     */
    selectEvenRows(tableNode: FrameNode): void {
        const selectedCells: SceneNode[] = [];
        const rows = tableNode.children.filter(child => child.type === 'FRAME') as FrameNode[];

        for (let i = 1; i < rows.length; i += 2) {
            // 1, 3, 5... (2nd, 4th, 6th...)
            const cells = rows[i].children.filter(child => child.type === 'FRAME') as FrameNode[];
            selectedCells.push(...cells);
        }

        if (selectedCells.length > 0) {
            figma.currentPage.selection = selectedCells;
        }
    }

    /**
     * Select all cells in specified multiple columns
     */
    selectTableColumns(tableNode: FrameNode, columnIndices: number[]): void {
        const selectedCells: SceneNode[] = [];

        const rows = tableNode.children.filter(child => child.type === 'FRAME') as FrameNode[];

        for (const row of rows) {
            const cells = row.children.filter(child => child.type === 'FRAME') as FrameNode[];
            for (const columnIndex of columnIndices) {
                if (cells[columnIndex]) {
                    selectedCells.push(cells[columnIndex]);
                }
            }
        }

        if (selectedCells.length > 0) {
            figma.currentPage.selection = selectedCells;
        }
    }

    /**
     * Select all cells in specified multiple rows
     */
    selectTableRows(tableNode: FrameNode, rowIndices: number[]): void {
        const selectedCells: SceneNode[] = [];

        const rows = tableNode.children.filter(child => child.type === 'FRAME') as FrameNode[];

        for (const rowIndex of rowIndices) {
            if (rows[rowIndex]) {
                const cells = rows[rowIndex].children.filter(
                    child => child.type === 'FRAME',
                ) as FrameNode[];
                selectedCells.push(...cells);
            }
        }

        if (selectedCells.length > 0) {
            figma.currentPage.selection = selectedCells;
        }
    }

    /**
     * Get current table size
     */
    getTableSize(tableNode: FrameNode): { width: number; height: number } {
        return {
            width: Math.round(tableNode.width),
            height: Math.round(tableNode.height),
        };
    }

    /**
     * Resize table
     */
    async resizeTable(tableNode: FrameNode, width?: number, height?: number): Promise<void> {
        try {
            if (width !== undefined) {
                // Adjust horizontal width
                tableNode.resize(width, tableNode.height);
            }

            if (height !== undefined) {
                // Adjust vertical width (by cell padding adjustment)
                await this.adjustTableHeightByPadding(tableNode, height);
            }
        } catch (error) {
            console.error('Failed to resize table:', error);
            throw error;
        }
    }

    /**
     * Change table height by adjusting cell padding
     * Protect user customizations while adjusting (majority approach)
     */
    private async adjustTableHeightByPadding(
        tableNode: FrameNode,
        targetHeight: number,
    ): Promise<void> {
        const rows = tableNode.children.filter(child => child.type === 'FRAME') as FrameNode[];
        if (rows.length === 0) {
            console.error('No rows found in table');
            return;
        }

        // Get current height
        const currentHeight = tableNode.height;
        const heightDiff = targetHeight - currentHeight;

        if (Math.abs(heightDiff) < 1) {
            return;
        }

        // Identify adjustable rows using majority approach
        const adjustableRows = await this.analyzeRowAdjustability(rows);
        const adjustableRowIndices = adjustableRows
            .filter(analysis => analysis.canAdjust)
            .map(analysis => analysis.rowIndex);

        if (adjustableRowIndices.length === 0) {
            return;
        }

        // Distribute height difference only among adjustable rows
        const paddingIncreasePerSide = heightDiff / (2 * adjustableRowIndices.length);

        // Update padding for cells in adjustable rows
        for (const rowIndex of adjustableRowIndices) {
            const row = rows[rowIndex];
            const cells = row.children.filter(child => child.type === 'FRAME') as FrameNode[];

            for (const cell of cells) {
                const newPaddingTop = Math.max(0, cell.paddingTop + paddingIncreasePerSide);
                const newPaddingBottom = Math.max(0, cell.paddingBottom + paddingIncreasePerSide);

                cell.paddingTop = newPaddingTop;
                cell.paddingBottom = newPaddingBottom;
            }
        }
    }

    /**
     * Analyze adjustability of each row (majority approach + fixed height check)
     */
    private async analyzeRowAdjustability(rows: FrameNode[]): Promise<
        Array<{
            rowIndex: number;
            canAdjust: boolean;
            skipReason?: string;
            hasFixedHeight: boolean;
            hasCustomPadding: boolean;
            avgPaddingTop: number;
            avgPaddingBottom: number;
        }>
    > {
        // Get actual plugin default values
        const defaultPaddingTopBottom = 12; // Y方向のpaddingのデフォルト値を12pxに固定

        // 1. Collect padding values for each row
        const paddingStats = rows.map((row, index) => {
            const cells = row.children.filter(child => child.type === 'FRAME') as FrameNode[];
            const avgTop = cells.reduce((sum, cell) => sum + cell.paddingTop, 0) / cells.length;
            const avgBottom =
                cells.reduce((sum, cell) => sum + cell.paddingBottom, 0) / cells.length;

            return {
                rowIndex: index,
                avgPaddingTop: avgTop,
                avgPaddingBottom: avgBottom,
                hasFixedHeight: row.layoutSizingVertical === 'FIXED',
            };
        });

        // 2. Determine standard values by majority
        const topValues = paddingStats.map(stat => Math.round(stat.avgPaddingTop * 2) / 2);
        const bottomValues = paddingStats.map(stat => Math.round(stat.avgPaddingBottom * 2) / 2);

        const majorityTop = this.getMajorityValue(topValues);
        const majorityBottom = this.getMajorityValue(bottomValues);

        // 3. Set dynamic threshold values
        const baseThreshold = Math.max(1, Math.abs(majorityTop - defaultPaddingTopBottom) * 0.1);
        const threshold = Math.max(baseThreshold, 2);

        // 4. Judge adjustability of each row
        const analysis = paddingStats.map(stat => {
            let canAdjust = true;
            let skipReason: string | undefined;

            // Fixed height check (highest priority)
            if (stat.hasFixedHeight) {
                canAdjust = false;
                skipReason = 'Row has fixed height';
            }
            // Deviation from majority check
            else if (
                Math.abs(stat.avgPaddingTop - majorityTop) > threshold ||
                Math.abs(stat.avgPaddingBottom - majorityBottom) > threshold
            ) {
                canAdjust = false;
                skipReason = 'Padding differs significantly from majority (user customization)';
            }

            return {
                rowIndex: stat.rowIndex,
                canAdjust,
                skipReason,
                hasFixedHeight: stat.hasFixedHeight,
                hasCustomPadding: !canAdjust && !stat.hasFixedHeight,
                avgPaddingTop: stat.avgPaddingTop,
                avgPaddingBottom: stat.avgPaddingBottom,
            };
        });

        return analysis;
    }

    /**
     * Create multiple tables from single markdown text containing multiple tables
     */
    async createTablesFromMarkdown(request: CreateTableRequest): Promise<CreateTablesResponse> {
        try {
            const { text, parseOptions = {}, tableConfig = {}, position } = request;

            // Use markdown parser to extract multiple tables
            const parser = getParser('markdown') as MarkdownParser;
            const parseResult = parser.parseMultipleTables(text, parseOptions);

            if (!parseResult.multipleTablesData || parseResult.multipleTablesData.length === 0) {
                return {
                    success: false,
                    errors: ['No tables found in markdown text'],
                };
            }

            // If only one table, use regular createTable method
            if (parseResult.multipleTablesData.length === 1) {
                const singleResult = await this.createTable(request);
                return {
                    success: singleResult.success,
                    tableNodes: singleResult.tableNode ? [singleResult.tableNode] : [],
                    errors: singleResult.errors,
                };
            }

            // Update table settings
            if (Object.keys(tableConfig).length > 0) {
                this.tableBuilder.updateConfig(tableConfig);
            }

            // Create container for multiple tables
            const containerNode = figma.createFrame();
            containerNode.name = 'Markdown Tables';

            // Set up Auto Layout (vertical placement for multiple tables)
            containerNode.layoutMode = 'VERTICAL';
            containerNode.primaryAxisSizingMode = 'AUTO';
            containerNode.counterAxisSizingMode = 'AUTO';
            containerNode.itemSpacing = 40;
            containerNode.paddingTop = 20;
            containerNode.paddingBottom = 20;
            containerNode.paddingLeft = 20;
            containerNode.paddingRight = 20;

            // Set background
            containerNode.fills = [
                {
                    type: 'SOLID',
                    color: { r: 0.99, g: 0.99, b: 0.99 },
                    opacity: 1,
                },
            ];

            const tableNodes: FrameNode[] = [];
            const errors: string[] = [];

            // Create each table
            for (let i = 0; i < parseResult.multipleTablesData.length; i++) {
                const tableData = parseResult.multipleTablesData[i];

                try {
                    const tableNode = await this.tableBuilder.buildTable(
                        tableData.data,
                        {
                            config: this.tableBuilder.getConfig(),
                            alignments: tableData.alignments,
                            hasHeader: tableData.hasHeader,
                        },
                        tableData.cellFormats,
                    );

                    // Set table name
                    tableNode.name = `Table ${i + 1}`;

                    // Add table metadata
                    const tableMetadata = {
                        createdBy: 'text-to-table-plugin',
                        format: 'markdown' as SupportedFormat,
                        hasHeader: tableData.hasHeader,
                        rowCount: tableData.data.length,
                        columnCount: tableData.data[0]?.length || 0,
                        filename: null,
                        createdAt: new Date().toISOString(),
                    };
                    tableNode.setPluginData('metadata', JSON.stringify(tableMetadata));

                    containerNode.appendChild(tableNode);
                    tableNodes.push(tableNode);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Table ${i + 1}: ${errorMessage}`);
                }
            }

            // If at least one table was created
            if (tableNodes.length > 0) {
                // Set container position
                if (position) {
                    containerNode.x = position.x;
                    containerNode.y = position.y;
                } else {
                    const optimalPlacement = this.calculateOptimalPosition();
                    containerNode.x = optimalPlacement.x;
                    containerNode.y = optimalPlacement.y;
                }

                // Add container to page
                figma.currentPage.appendChild(containerNode);

                // Select container without changing viewport
                figma.currentPage.selection = [containerNode];

                return {
                    success: true,
                    containerNode,
                    tableNodes,
                    errors: errors.length > 0 ? errors : undefined,
                };
            } else {
                // If all table creation failed
                containerNode.remove();
                return {
                    success: false,
                    errors: errors.length > 0 ? errors : ['Failed to create all tables'],
                };
            }
        } catch (error) {
            let errorMessage = 'Error occurred while creating multiple tables from markdown';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            return {
                success: false,
                errors: [errorMessage],
            };
        }
    }
    private getMajorityValue(values: number[]): number {
        const counts = new Map<number, number>();

        for (const value of values) {
            counts.set(value, (counts.get(value) || 0) + 1);
        }

        let maxCount = 0;
        let majorityValue = values[0];

        for (const [value, count] of counts) {
            if (count > maxCount) {
                maxCount = count;
                majorityValue = value;
            }
        }

        return majorityValue;
    }
}
